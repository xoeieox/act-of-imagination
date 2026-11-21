/**
 * Model selector route tests (aoi-model-selector-v0, 2026-11-21).
 *
 * The three fail-closed contracts that live at the HTTP boundary, on a
 * fake lane (fetch stub, zero network) the way route-smoke.test.js does:
 *
 *   1. GET /api/models answers [{key,label}] ONLY - sentinel base url,
 *      model id and key VALUES must not appear anywhere in the response
 *      (Kyma catalog rule).
 *   2. A modelKey the registry does not know is a 400 - before any fetch
 *      is attempted (the stub counts calls; an unknown key must reach the
 *      lane zero times, i.e. no silent fallback).
 *   3. A valid modelKey re-targets the lane call: the stub must see the
 *      registry entry's endpoint + model id + bearer key. Without a
 *      modelKey the lane request keeps today's exact shape.
 *
 * Registry env is process.env-injected (request-time read is the whole
 * point of the registry); the same save/restore idiom as the lane env.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET as modelsGET } from './models/+server.js';
import { POST as chatPOST } from './chat/+server.js';
import { POST as arrangePOST } from './arrange/+server.js';
import { POST as synopsisPOST } from './synopsis/+server.js';

const ENV_KEYS = [
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
	'AOI_LLM_SYNOPSIS_MODEL',
	'AOI_MODELS_JSON'
];

const saved = {};

function clearEnv() {
	for (const key of ENV_KEYS) {
		saved[key] = process.env[key];
		delete process.env[key];
	}
}

function restoreEnv() {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
}

// Operator lane (fallback path) and registry entry carry distinct
// sentinels so the stub can tell which config served the request.
function useConfiguredLanes() {
	process.env.AOI_LLM_BASE_URL = 'https://lane-default.invalid/v1';
	process.env.AOI_LLM_MODEL = 'lane-model';
}

function useRegistry() {
	process.env.AOI_MODELS_JSON = JSON.stringify([
		{
			key: 'reg-one',
			label: 'Registry One',
			baseUrl: 'https://registry-entry.invalid/v1',
			model: 'registry-model-sentinel',
			apiKey: 'registry-key-sentinel'
		}
	]);
}

function request(body) {
	return new Request('http://localhost/api', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

const completion = (content) => ({ choices: [{ message: { content } }] });

function useFakeLane() {
	const orig = globalThis.fetch;
	const seen = [];
	globalThis.fetch = vi.fn(async (url, init) => {
		seen.push({ url, body: JSON.parse(init.body), headers: init.headers || {} });
		return {
			ok: true,
			status: 200,
			text: async () => JSON.stringify(completion('A shape stirs beneath the water.')),
			json: async () => completion('A shape stirs beneath the water.')
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

describe('GET /api/models', () => {
	beforeEach(clearEnv);
	afterEach(restoreEnv);

	it('unset registry -> 200 [] (selector hidden, no error)', async () => {
		const res = await modelsGET();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it('valid registry -> [{key,label}] ONLY; no baseUrl/model/apiKey values leak', async () => {
		useRegistry();
		const res = await modelsGET();
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(JSON.parse(text)).toEqual([{ key: 'reg-one', label: 'Registry One' }]);
		expect(text).not.toContain('registry-entry.invalid');
		expect(text).not.toContain('registry-model-sentinel');
		expect(text).not.toContain('registry-key-sentinel');
	});

	it('malformed registry -> generic 500 shape, registry content never echoed', async () => {
		process.env.AOI_MODELS_JSON = '[{"key":"reg-one","label":"secret-label-sentinel"';
		const res = await modelsGET();
		expect(res.status).toBe(500);
		const text = await res.text();
		expect(JSON.parse(text)).toEqual({ error: 'model_registry_invalid' });
		expect(text).not.toContain('secret-label-sentinel');
	});
});

describe('modelKey selection on the three lanes (fake lane, zero network)', () => {
	beforeEach(clearEnv);
	afterEach(restoreEnv);

	it('POST /api/chat unknown modelKey -> 400 and ZERO lane fetches', async () => {
		useConfiguredLanes();
		useRegistry();
		const lane = useFakeLane();
		try {
			const res = await chatPOST({ request: request({ ...CHAT_BODY, modelKey: 'ghost' }) });
			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'unknown_model_key' });
			expect(lane.seen).toHaveLength(0);
		} finally {
			lane.restore();
		}
	});

	it('POST /api/chat malformed registry + modelKey -> 400 model_registry_invalid, no fallback fetch', async () => {
		useConfiguredLanes();
		process.env.AOI_MODELS_JSON = '{oops';
		const lane = useFakeLane();
		try {
			const res = await chatPOST({ request: request({ ...CHAT_BODY, modelKey: 'reg-one' }) });
			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'model_registry_invalid' });
			expect(lane.seen).toHaveLength(0);
		} finally {
			lane.restore();
		}
	});

	it('POST /api/chat valid modelKey -> lane call on the registry endpoint, model + bearer from the entry', async () => {
		useConfiguredLanes();
		useRegistry();
		const lane = useFakeLane();
		try {
			const res = await chatPOST({ request: request({ ...CHAT_BODY, modelKey: 'reg-one' }) });
			expect(res.status).toBe(200);
			expect(lane.seen.length).toBeGreaterThan(0);
			for (const call of lane.seen) {
				expect(call.url).toBe('https://registry-entry.invalid/v1/chat/completions');
				expect(call.body.model).toBe('registry-model-sentinel');
				expect(call.headers.authorization).toBe('Bearer registry-key-sentinel');
			}
		} finally {
			lane.restore();
		}
	});

	it('POST /api/chat WITHOUT modelKey -> lane defaults, byte-identical posture (no override)', async () => {
		useConfiguredLanes();
		useRegistry(); // present but unselected: must not affect lane requests
		const lane = useFakeLane();
		try {
			const res = await chatPOST({ request: request(CHAT_BODY) });
			expect(res.status).toBe(200);
			expect(lane.seen[0].url).toBe('https://lane-default.invalid/v1/chat/completions');
			expect(lane.seen[0].body.model).toBe('lane-model');
			expect(lane.seen[0].headers.authorization).toBeUndefined();
		} finally {
			lane.restore();
		}
	});

	it('POST /api/arrange valid modelKey -> registry endpoint serves the narrative call', async () => {
		useConfiguredLanes();
		useRegistry();
		const lane = useFakeLane();
		try {
			const res = await arrangePOST({ request: request({ ...ARRANGE_BODY, modelKey: 'reg-one' }) });
			expect(res.status).toBe(200);
			expect(lane.seen[0].url).toBe('https://registry-entry.invalid/v1/chat/completions');
			expect(lane.seen[0].body.model).toBe('registry-model-sentinel');
		} finally {
			lane.restore();
		}
	});

	it('POST /api/synopsis unknown modelKey -> 400 before any fetch', async () => {
		useConfiguredLanes();
		useRegistry();
		const lane = useFakeLane();
		try {
			const res = await synopsisPOST({
				request: request({ ...SYNOPSIS_BODY, modelKey: 'ghost' })
			});
			expect(res.status).toBe(400);
			expect(lane.seen).toHaveLength(0);
		} finally {
			lane.restore();
		}
	});
});
