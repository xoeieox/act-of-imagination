/**
 * Arrange route lane tests (aoi-arrangement-play-v0).
 *
 * Route-level lock for the ARRANGE lane reuse: with a per-lane env override
 * the route must call the arrange endpoint (not the shared default), send
 * the design prompt shape, make exactly one lane call with no tools, and
 * keep the >=2-card validation. Zero network (fake fetch at the seam).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as arrangePOST } from './arrange/+server.js';

const LANE_KEYS = [
	'AOI_LLM_BASE_URL',
	'AOI_LLM_MODEL',
	'AOI_LLM_API_KEY',
	'AOI_LLM_PROVIDER',
	'AOI_LLM_CHAT_BASE_URL',
	'AOI_LLM_CHAT_MODEL',
	'AOI_LLM_ARRANGE_BASE_URL',
	'AOI_LLM_ARRANGE_MODEL',
	'AOI_LLM_ARRANGE_API_KEY',
	'AOI_LLM_SYNOPSIS_BASE_URL',
	'AOI_LLM_SYNOPSIS_MODEL'
];

const saved = {};

function request(body) {
	return new Request('http://localhost/api/arrange', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('POST /api/arrange - arrange lane', () => {
	let seen = [];
	let origFetch;

	beforeEach(() => {
		for (const key of LANE_KEYS) {
			saved[key] = process.env[key];
			delete process.env[key];
		}
		// Shared default (decoy) + arrange-specific lane
		process.env.AOI_LLM_BASE_URL = 'https://default.invalid/v1';
		process.env.AOI_LLM_MODEL = 'default-model';
		process.env.AOI_LLM_ARRANGE_BASE_URL = 'https://arrange.invalid/v1';
		process.env.AOI_LLM_ARRANGE_MODEL = 'arrange-model';

		seen = [];
		origFetch = globalThis.fetch;
		globalThis.fetch = async (url, init) => {
			seen.push({ url, body: JSON.parse(init.body) });
			return {
				ok: true,
				status: 200,
				text: async () =>
					JSON.stringify({ choices: [{ message: { content: 'The door holds.' } }] }),
				json: async () => ({ choices: [{ message: { content: 'The door holds.' } }] })
			};
		};
	});

	afterEach(() => {
		globalThis.fetch = origFetch;
		for (const key of LANE_KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	});

	it('routes through the per-lane arrange endpoint with the design prompt', async () => {
		const res = await arrangePOST({
			request: request({
				slots: [
					{ name: 'The Locked Door', essence: 'Readiness not yet claimed', depth: 0.9 },
					null,
					{ name: 'Hallway', essence: 'Everything left mid-construction', depth: 0.2 }
				],
				context: { id: 'system-meeting', name: 'meeting', prompt: 'First contact lens.' }
			})
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.narrative).toBe('The door holds.');

		// Exactly one lane call, to the ARRANGE lane endpoint, not the default
		expect(seen.length).toBe(1);
		expect(seen[0].url).toBe('https://arrange.invalid/v1/chat/completions');
		expect(seen[0].body.model).toBe('arrange-model');

		// Design prompt shape reaches the lane
		const [sys, user] = seen[0].body.messages;
		expect(sys.role).toBe('system');
		expect(sys.content).toContain('You are a narrator witnessing an interaction');
		expect(user.content).toContain('Slot 1: "The Locked Door"');
		expect(user.content).toContain('Slot 2: empty');
		expect(user.content).toContain('heavy presence');
		expect(user.content).toContain('Context: First contact lens.');
		expect(user.content).toContain('gravitational pull');

		// No tools on the arrange lane call
		expect(seen[0].body.tools).toBeUndefined();
	});

	it('still accepts the legacy cards-array body', async () => {
		const res = await arrangePOST({
			request: request({
				cards: [
					{ name: 'A', essence: 'first essence' },
					{ name: 'B', essence: 'second essence' }
				],
				context: 'meeting'
			})
		});
		expect(res.status).toBe(200);
		expect(seen[0].body.messages[1].content).toContain('Slot 1: "A"');
	});

	it('rejects fewer than 2 placed cards before touching the lane', async () => {
		const res = await arrangePOST({
			request: request({
				slots: [{ name: 'Solo', essence: 'alone' }, null, null],
				context: 'meeting'
			})
		});
		expect(res.status).toBe(400);
		expect(seen.length).toBe(0);
	});
});
