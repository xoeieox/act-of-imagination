/**
 * modelProbe error classes (fixed 2026-11-21).
 *
 * A loopback-bound endpoint that is down fails from the server
 * with a refused connection (curl-7 class), and the OLD catch line
 * 'chat probe failed (timeout or transport error)' blurred three
 * different failure classes into one shrug. probeModelConfig now
 * classifies every thrown fetch error (classifyProbeError) and the
 * verdict line must match the real class:
 *   transport (ECONNREFUSED/EHOSTUNREACH/...) -> 'model not reachable
 *   from this server'; abort/AbortError -> a timeout line; an HTTP
 *   response that answers badly stays the 'responded <status>' line
 *   (never mislabeled as unreachable).
 * Direct probeModelConfig unit tests with injected fetchImpl - zero
 * network, no fs involvement (I-9 posture: this file imports nothing
 * but the probe).
 */
import { describe, it, expect, vi } from 'vitest';
import { probeModelConfig } from './modelProbe.js';

const CONFIG = {
	baseUrl: 'https://probe-class.invalid/v1',
	model: 'probe-model',
	apiKey: '***'
};

function transportError() {
	const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9'), {
		code: 'ECONNREFUSED'
	});
	return new TypeError('fetch failed', { cause });
}

function abortError() {
	return Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
}

describe('probeModelConfig failure classes (draftfix 2026-11-21)', () => {
	it('refused connection both legs -> honest transport line, leg null', async () => {
		const fetchImpl = vi.fn(async () => {
			throw transportError();
		});
		const verdict = await probeModelConfig(CONFIG, { fetchImpl });
		expect(verdict.ok).toBe(false);
		expect(verdict.leg).toBe(null);
		expect(verdict.error).toBe('model not reachable from this server');
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('abort/AbortError -> honest timeout line, not the transport line', async () => {
		const fetchImpl = vi.fn(async () => {
			throw abortError();
		});
		const verdict = await probeModelConfig(CONFIG, { fetchImpl });
		expect(verdict.ok).toBe(false);
		expect(verdict.error).toBe('connection test timed out - no answer in time');
	});

	it('HTTP answer that fails shape stays the responded-line, never called unreachable', async () => {
		const fetchImpl = vi.fn(async (url) => {
			if (String(url).endsWith('/models')) {
				return {
					ok: true,
					status: 200,
					json: async () => ({ data: [{ id: 'x' }] }),
					text: async () => '{}'
				};
			}
			return {
				ok: false,
				status: 503,
				text: async () => 'upstream exploded',
				json: async () => ({})
			};
		});
		const verdict = await probeModelConfig(CONFIG, { fetchImpl });
		expect(verdict.ok).toBe(false);
		expect(verdict.leg).toBe('models');
		expect(verdict.error).toContain('chat probe responded 503');
		expect(verdict.error).not.toContain('not reachable');
	});

	it('transport line never carries the api key (redaction posture intact)', async () => {
		const fetchImpl = vi.fn(async () => {
			throw Object.assign(transportError(), {
				message: `fetch failed for sk-${CONFIG.apiKey}`
			});
		});
		const verdict = await probeModelConfig(CONFIG, { fetchImpl });
		expect(verdict.error).toBe('model not reachable from this server');
		expect(verdict.error).not.toContain(CONFIG.apiKey);
	});
});
