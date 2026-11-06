/**
 * Fail-closed route tests (aoi-lane-swap-v0, invariant I-2 / DoD #3).
 *
 * With no AOI_LLM_* env configured, every API route must answer the
 * machine-readable 501 shape - no default endpoint, no silent fallback.
 * Zero network: the lane check fails before any fetch is attempted.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

/**
 * Shared upstream-failure shape (PR #3 review cycle 1): a LaneUpstreamError
 * - including one raised mid-continuation in the chat route's attempt loop -
 * must surface as the same machine-readable 502 on all three routes, not a
 * generic 500. Zero network: global fetch is stubbed.
 */
describe('api routes share the lane upstream failure shape', () => {
	const ORIG_FETCH = globalThis.fetch;

	beforeEach(() => {
		process.env.AOI_LLM_BASE_URL = 'https://lane.invalid/v1';
		process.env.AOI_LLM_MODEL = 'test-model';
	});

	afterEach(() => {
		globalThis.fetch = ORIG_FETCH;
		delete process.env.AOI_LLM_BASE_URL;
		delete process.env.AOI_LLM_MODEL;
	});

	function failingUpstreamFetch(detailText) {
		globalThis.fetch = vi.fn(async () => ({
			ok: false,
			status: 503,
			text: async () => detailText,
			json: async () => {
				throw new Error('not json');
			}
		}));
	}

	async function expectUpstream502(response, detailText) {
		expect(response.status).toBe(502);
		const body = await response.json();
		expect(body.error).toBe('llm_lane_upstream');
		expect(body.upstream_status).toBe(503);
		expect(body.details).toContain(detailText);
	}

	it('POST /api/chat -> 502 llm_lane_upstream', async () => {
		failingUpstreamFetch('lane said no');
		const res = await chatPOST({
			request: request({ messages: [{ role: 'user', content: 'hi' }], cards: [] })
		});
		await expectUpstream502(res, 'lane said no');
	});

	it('POST /api/arrange -> 502 llm_lane_upstream', async () => {
		failingUpstreamFetch('arrange refused');
		const res = await arrangePOST({
			request: request({
				cards: [
					{ name: 'The Locked Door', essence: 'readiness not yet claimed' },
					{ name: 'Weight of Waiting', essence: 'patience under load' }
				],
				context: 'meeting'
			})
		});
		await expectUpstream502(res, 'arrange refused');
	});

	it('POST /api/synopsis -> 502 llm_lane_upstream', async () => {
		failingUpstreamFetch('synopsis refused');
		const res = await synopsisPOST({
			request: request({
				cards: [{ name: 'The Locked Door' }],
				context: { label: 'first meeting' },
				narrative: 'A door holds; a hand hovers.'
			})
		});
		await expectUpstream502(res, 'synopsis refused');
	});

	it('chat continuation attempt 2..3 failure -> 502 llm_lane_upstream, not a generic 500', async () => {
		let call = 0;
		globalThis.fetch = vi.fn(async () => {
			call++;
			if (call === 1) {
				return {
					ok: true,
					status: 200,
					text: async () => '',
					json: async () => ({
						choices: [
							{
								message: {
									content: '',
									tool_calls: [
										{
											id: 'call_1',
											type: 'function',
											function: {
												name: 'detect_forming_card',
												arguments:
													'{"type":"theme","hint":"a shape","depth":0.3,"excerpt":"stir"}'
											}
										}
									]
								}
							}
						]
					})
				};
			}
			return {
				ok: false,
				status: 503,
				text: async () => 'continuation hiccup',
				json: async () => {
					throw new Error('not json');
				}
			};
		});
		const res = await chatPOST({
			request: request({ messages: [{ role: 'user', content: 'hi' }], cards: [] })
		});
		await expectUpstream502(res, 'continuation hiccup');
		expect(call).toBe(2);
	});
});
