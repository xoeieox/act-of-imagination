/**
 * Fail-closed route tests (aoi-lane-swap-v0, invariant I-2 / DoD #3).
 *
 * With no AOI_LLM_* env configured, every API route must answer the
 * machine-readable 501 shape - no default endpoint, no silent fallback.
 * Zero network: the lane check fails before any fetch is attempted.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as chatPOST } from './chat/+server.js';
import { POST as arrangePOST } from './arrange/+server.js';
import { POST as synopsisPOST } from './synopsis/+server.js';

const LANE_VARS = [
	'AOI_LLM_BASE_URL',
	'AOI_LLM_MODEL',
	'AOI_LLM_API_KEY',
	'AOI_LLM_PROVIDER',
	'AOI_LLM_MAX_TOKENS',
	'AOI_LLM_CHAT_BASE_URL',
	'AOI_LLM_CHAT_MODEL',
	'AOI_LLM_ARRANGE_BASE_URL',
	'AOI_LLM_ARRANGE_MODEL',
	'AOI_LLM_SYNOPSIS_BASE_URL',
	'AOI_LLM_SYNOPSIS_MODEL'
];

const saved = {};

beforeEach(() => {
	for (const key of LANE_VARS) {
		saved[key] = process.env[key];
		delete process.env[key];
	}
});

afterEach(() => {
	for (const key of LANE_VARS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
});

function request(body) {
	return new Request('http://localhost/api', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

async function expectUnconfigured501(response) {
	expect(response.status).toBe(501);
	const body = await response.json();
	expect(body.error).toBe('llm_lane_unconfigured');
	expect(body.hint).toContain('AOI_LLM_BASE_URL');
	expect(body.hint).toContain('AOI_LLM_MODEL');
}

describe('api routes fail closed with no lane configured', () => {
	it('POST /api/chat -> 501 llm_lane_unconfigured', async () => {
		const res = await chatPOST({
			request: request({ messages: [{ role: 'user', content: 'something stirring' }], cards: [] })
		});
		await expectUnconfigured501(res);
	});

	it('POST /api/arrange -> 501 llm_lane_unconfigured', async () => {
		const res = await arrangePOST({
			request: request({
				cards: [
					{ name: 'The Locked Door', essence: 'readiness not yet claimed' },
					{ name: 'Weight of Waiting', essence: 'patience under load' }
				],
				context: 'meeting'
			})
		});
		await expectUnconfigured501(res);
	});

	it('POST /api/synopsis -> 501 llm_lane_unconfigured', async () => {
		const res = await synopsisPOST({
			request: request({
				cards: [{ name: 'The Locked Door' }],
				context: { label: 'first meeting' },
				narrative: 'A door holds; a hand hovers.'
			})
		});
		await expectUnconfigured501(res);
	});
});
