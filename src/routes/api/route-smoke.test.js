/**
 * Route smoke tests.
 *
 * All three API routes against a fake lane (canned OpenAI-compatible
 * responses at the fetch seam, zero network): the happy-path shape for each
 * route, and the missing-lane 501 fail-closed shape (I-2) with no fetch ever
 * attempted. Complements src/routes/api/fail-closed.test.js (upstream 502
 * shape + continuation-loop 502) - together they are the route-level lock
 * for the fail-closed and response-format invariants.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as chatPOST } from './chat/+server.js';
import { POST as arrangePOST } from './arrange/+server.js';
import { POST as synopsisPOST } from './synopsis/+server.js';

const LANE_KEYS = [
	'AOI_LLM_BASE_URL',
	'AOI_LLM_MODEL',
	'AOI_LLM_API_KEY',
	'AOI_LLM_PROVIDER',
	'AOI_LLM_CHAT_BASE_URL',
	'AOI_LLM_CHAT_MODEL',
	'AOI_LLM_ARRANGE_BASE_URL',
	'AOI_LLM_ARRANGE_MODEL',
	'AOI_LLM_SYNOPSIS_BASE_URL',
	'AOI_LLM_SYNOPSIS_MODEL'
];

const saved = {};

function clearLaneEnv() {
	for (const key of LANE_KEYS) {
		saved[key] = process.env[key];
		delete process.env[key];
	}
}

function restoreLaneEnv() {
	for (const key of LANE_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
}

function request(body) {
	return new Request('http://localhost/api', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

const completion = (content, toolCalls) => ({
	choices: [{ message: { content, ...(toolCalls ? { tool_calls: toolCalls } : {}) } }]
});

/** Fake lane over global fetch: serves the canned completions in order. */
function useFakeLane(responses) {
	const orig = globalThis.fetch;
	const seen = [];
	globalThis.fetch = vi.fn(async (url, init) => {
		const body = JSON.parse(init.body);
		seen.push({ url, body });
		const canned = responses.shift();
		if (!canned) throw new Error('smoke lane: queue drained');
		return {
			ok: true,
			status: 200,
			text: async () => JSON.stringify(canned),
			json: async () => canned
		};
	});
	return { seen, restore: () => (globalThis.fetch = orig) };
}

const CHAT_BODY = {
	messages: [{ role: 'user', content: 'there is a shape I keep circling' }],
	cards: []
};
const ARRANGE_BODY = {
	cards: [
		{ name: 'The Locked Door', essence: 'readiness not yet claimed' },
		{ name: 'Weight of Waiting', essence: 'patience under load' }
	],
	context: 'meeting'
};
const SYNOPSIS_BODY = {
	cards: [{ name: 'The Locked Door' }],
	context: { label: 'first meeting' },
	narrative: 'A door holds; a hand hovers.'
};

describe('route smoke: happy path on a fake lane (zero network)', () => {
	beforeEach(() => {
		clearLaneEnv();
		process.env.AOI_LLM_BASE_URL = 'https://smoke-lane.invalid/v1';
		process.env.AOI_LLM_MODEL = 'smoke-model';
	});
	afterEach(restoreLaneEnv);

	it('POST /api/chat -> 200 {content, cardEvents} with a plain reply', async () => {
		const lane = useFakeLane([completion('What do you think is circling?')]);
		try {
			const res = await chatPOST({ request: request(CHAT_BODY) });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.content).toBe('What do you think is circling?');
			expect(json.cardEvents).toEqual([]);
		} finally {
			lane.restore();
		}
	});

	it('POST /api/chat -> 200 with tool-call continuation (assistant echo + tool turn)', async () => {
		const lane = useFakeLane([
			completion('', [
				{
					id: 'call_smoke_1',
					type: 'function',
					function: {
						name: 'detect_forming_card',
						arguments:
							'{"type":"theme","hint":"a circling shape","depth":0.3,"excerpt":"keep circling"}'
					}
				}
			]),
			completion('Something here is asking to be seen.')
		]);
		try {
			const res = await chatPOST({ request: request(CHAT_BODY) });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.cardEvents).toEqual([
				{
					event: 'detected',
					type: 'theme',
					hint: 'a circling shape',
					depth: 0.3,
					excerpt: 'keep circling'
				}
			]);
			expect(json.content).toBe('Something here is asking to be seen.');
			expect(lane.seen.length).toBe(2);
			const cont = lane.seen[1].body.messages;
			expect(cont.filter((m) => m.role === 'tool').length).toBe(1);
			expect(cont.some((m) => m.role === 'assistant' && m.tool_calls)).toBe(true);
		} finally {
			lane.restore();
		}
	});

	it('POST /api/arrange -> 200 {narrative}', async () => {
		const lane = useFakeLane([completion('Two doors recognize each other in the dark.')]);
		try {
			const res = await arrangePOST({ request: request(ARRANGE_BODY) });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.narrative).toBe('Two doors recognize each other in the dark.');
		} finally {
			lane.restore();
		}
	});

	it('POST /api/synopsis -> 200 {synopsis}', async () => {
		const lane = useFakeLane([completion('Patience at the threshold.')]);
		try {
			const res = await synopsisPOST({ request: request(SYNOPSIS_BODY) });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.synopsis).toBe('Patience at the threshold.');
		} finally {
			lane.restore();
		}
	});
});

describe('route smoke: missing lane fails closed with 501 (I-2)', () => {
	beforeEach(clearLaneEnv);
	afterEach(restoreLaneEnv);

	it('all three routes answer the machine-readable 501 shape with zero fetch', async () => {
		const noFetch = vi.fn(() => {
			throw new Error('fail closed must not reach the network');
		});
		const orig = globalThis.fetch;
		globalThis.fetch = noFetch;
		try {
			for (const [name, route, body] of [
				['chat', chatPOST, CHAT_BODY],
				['arrange', arrangePOST, ARRANGE_BODY],
				['synopsis', synopsisPOST, SYNOPSIS_BODY]
			]) {
				const res = await route({ request: request(body) });
				expect(res.status, `${name} status`).toBe(501);
				const json = await res.json();
				expect(json.error, `${name} error field`).toBe('llm_lane_unconfigured');
				expect(json.hint, `${name} env-var hint`).toContain('AOI_LLM_BASE_URL');
				expect(json.hint, `${name} env-var hint`).toContain('AOI_LLM_MODEL');
			}
			expect(noFetch.mock.calls.length, 'fail-closed must not reach the network').toBe(0);
		} finally {
			globalThis.fetch = orig;
		}
	});
});
