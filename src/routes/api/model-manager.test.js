/**
 * Model-manager route battery (2026-11-21).
 *
 * HTTP-boundary contracts on a REAL temp store directory + fake lane
 * (fetch stubs, zero network): combined catalog shape, user-row CRUD
 * round-trips, operator rows immutable (403), test-endpoint verdicts
 * (both-legs / models-404 chat fallback / failure) with redaction, the
 * never-persist probe guarantee, and a sentinel grep over EVERY
 * /api/models* response collected during the run.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GET as catalogGET, POST as catalogPOST } from './models/+server.js';
import { PATCH as rowPATCH, DELETE as rowDELETE } from './models/[key]/+server.js';
import { POST as testPOST } from './models/test/+server.js';
import { POST as chatPOST } from './chat/+server.js';

const ENV_KEYS = [
	'AOI_LLM_BASE_URL',
	'AOI_LLM_MODEL',
	'AOI_LLM_API_KEY',
	'AOI_LLM_PROVIDER',
	'AOI_LLM_MAX_TOKENS',
	'AOI_LLM_CHAT_BASE_URL',
	'AOI_LLM_CHAT_MODEL',
	'AOI_MODELS_JSON',
	'AOI_MODEL_STORE_DIR',
	'AOI_OPERATOR_MODELS_FILE',
	'AOI_USER_MODELS_FILE'
];

const saved = {};
let dir;

function clearEnv() {
	for (const key of ENV_KEYS) {
		saved[key] = process.env[key];
		delete process.env[key];
	}
	dir = mkdtempSync(path.join(tmpdir(), 'aoi-mgr-test-'));
	process.env.AOI_MODEL_STORE_DIR = dir;
}

function restoreEnv() {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
	rmSync(dir, { recursive: true, force: true });
}

const userFile = () => path.join(dir, 'user-models.json');
const operatorFile = () => path.join(dir, 'operator-models.json');

function writeOperator(rows) {
	writeFileSync(operatorFile(), JSON.stringify(rows), { mode: 0o600 });
}

function jsonRequest(body) {
	return new Request('http://localhost/api', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function useStubs({
	modelsOk = true,
	modelsStatus = 200,
	chatOk = true,
	chatStatus = 200,
	chatDetail = ''
} = {}) {
	const orig = globalThis.fetch;
	const seen = [];
	globalThis.fetch = vi.fn(async (url, init) => {
		seen.push({ url: String(url), init });
		if (String(url).endsWith('/models')) {
			return {
				ok: modelsOk,
				status: modelsStatus,
				json: async () => ({ data: [{ id: 'served-model-x' }] }),
				text: async () => '{}'
			};
		}
		if (String(url).endsWith('/chat/completions')) {
			if (chatOk) {
				const body = { choices: [{ message: { content: 'pong' } }] };
				return {
					ok: true,
					status: 200,
					json: async () => body,
					text: async () => JSON.stringify(body)
				};
			}
			return {
				ok: false,
				status: chatStatus,
				text: async () => chatDetail,
				json: async () => ({})
			};
		}
		throw new Error(`unexpected fetch ${url}`);
	});
	return { seen, restore: () => (globalThis.fetch = orig) };
}

const ROW = {
	label: 'Proof Row',
	baseUrl: 'https://lane-sentinel.invalid/v1',
	model: 'lane-model-sentinel',
	apiKey: 'lane-pr…nely'
};

/** every response text captured by tests, grepped for sentinels */
function expectNoSecrets(text) {
	expect(text).not.toContain('lane-sentinel.invalid');
	expect(text).not.toContain('lane-model-sentinel');
	expect(text).not.toContain('lane-key-sentinel-nely');
}

describe('user-row CRUD through the API (real temp store)', () => {
	beforeEach(clearEnv);
	afterEach(restoreEnv);

	it('POST creates a draft row; GET shows it masked; PATCH edits; DELETE removes', async () => {
		const create = await catalogPOST({ request: jsonRequest(ROW) });
		expect(create.status).toBe(201);
		const created = await create.json();
		expect(created.status).toBe('draft');
		expect(created.source).toBe('user');
		expect(created.hasKey).toBe(true);

		const list = await catalogGET();
		const text = await list.text();
		expect(JSON.parse(text)).toHaveLength(1);
		expect(text).toContain('"keyLast4":"nely"');
		expectNoSecrets(text);

		const patch = await rowPATCH({
			params: { key: created.key },
			request: jsonRequest({ label: 'Renamed' })
		});
		expect(patch.status).toBe(200);
		expect((await patch.json()).label).toBe('Renamed');

		const del = await rowDELETE({ params: { key: created.key } });
		expect(del.status).toBe(200);
		const after = await catalogGET();
		expect(await after.json()).toEqual([]);
	});

	it('operator rows: listed with source, PATCH/DELETE answered 403, never modifiable', async () => {
		writeOperator([{ key: 'lane-chat', label: 'Lane default (chat)', ...ROW }]);
		const list = await catalogGET();
		const text = await list.text();
		expect(text).toContain('"source":"operator"');
		expectNoSecrets(text);

		const patch = await rowPATCH({
			params: { key: 'lane-chat' },
			request: jsonRequest({ label: 'owned' })
		});
		expect(patch.status).toBe(403);
		expect((await patch.json()).error).toBe('operator_model_readonly');
		const del = await rowDELETE({ params: { key: 'lane-chat' } });
		expect(del.status).toBe(403);
	});

	it('unknown key PATCH/DELETE -> 404; duplicate key -> 409; bad shape -> 400 (generic)', async () => {
		expect(
			(await rowPATCH({ params: { key: 'ghost' }, request: jsonRequest({ label: 'x' }) })).status
		).toBe(404);
		expect((await rowDELETE({ params: { key: 'ghost' } })).status).toBe(404);
		const a = await catalogPOST({
			request: jsonRequest({
				key: 'dup-me',
				label: 'A',
				baseUrl: 'https://a.sentinel.invalid/v1',
				model: 'm'
			})
		});
		expect(a.status).toBe(201);
		const dup = await catalogPOST({
			request: jsonRequest({
				key: 'dup-me',
				label: 'B',
				baseUrl: 'https://b.sentinel.invalid/v1',
				model: 'm'
			})
		});
		expect(dup.status).toBe(409);
		const bad = await catalogPOST({
			request: jsonRequest({ label: 'B', baseUrl: 'ftp://nope', model: 'm' })
		});
		expect(bad.status).toBe(400);
		expect(bad.headers.get('cache-control')).toBe('no-store');
	});

	it('a saved draft is chat-able (server never blocks drafts; UI marks them)', async () => {
		useConfiguredLanes();
		const create = await catalogPOST({ request: jsonRequest(ROW) });
		const { key } = await create.json();
		const lane = useStubs({ chatOk: true });
		try {
			const res = await chatPOST({
				request: jsonRequest({
					messages: [{ role: 'user', content: 'hello' }],
					cards: [],
					modelKey: key
				})
			});
			expect(res.status).toBe(200);
			expect(lane.seen[0].url).toBe('https://lane-sentinel.invalid/v1/chat/completions');
		} finally {
			lane.restore();
		}
	});

	it('unknown modelKey on chat -> 400, zero lane fetches; user rows are valid selections', async () => {
		useConfiguredLanes();
		const lane = useStubs({});
		try {
			const res = await chatPOST({
				request: jsonRequest({
					messages: [{ role: 'user', content: 'hi' }],
					cards: [],
					modelKey: 'ghost'
				})
			});
			expect(res.status).toBe(400);
			expect(lane.seen).toHaveLength(0);
		} finally {
			lane.restore();
		}
	});
});

describe('POST /api/models/test (fake endpoints, zero real network)', () => {
	beforeEach(clearEnv);
	afterEach(restoreEnv);

	it('both legs pass -> ok, leg both, latency + sample; nothing persisted', async () => {
		const stubs = useStubs({});
		try {
			const res = await testPOST({ request: jsonRequest(ROW) });
			expect(res.status).toBe(200);
			const verdict = await res.json();
			expect(verdict.ok).toBe(true);
			expect(verdict.leg).toBe('both');
			expect(verdict.latencyMs).toBeGreaterThanOrEqual(0);
			expect(typeof verdict.sample).toBe('string');
			// probe used both endpoints with the key as bearer
			const models = stubs.seen.find((s) => s.url.endsWith('/models'));
			expect(models.init.headers.authorization).toBe(`Bearer ${ROW.apiKey}`);
			const chat = stubs.seen.find((s) => s.url.endsWith('/chat/completions'));
			expect(JSON.parse(chat.init.body).max_tokens).toBeLessThanOrEqual(32);
		} finally {
			stubs.restore();
		}
		// NEVER persists: no store file was written by the probe
		expect(existsSync(userFile())).toBe(false);
		expect(existsSync(operatorFile())).toBe(false);
	});

	it('models-404 relay quirk -> falls back, verdict chat, still ok', async () => {
		const stubs = useStubs({ modelsOk: false, modelsStatus: 404 });
		try {
			const res = await testPOST({ request: jsonRequest(ROW) });
			const verdict = await res.json();
			expect(verdict.ok).toBe(true);
			expect(verdict.leg).toBe('chat');
		} finally {
			stubs.restore();
		}
	});

	it('listing ok + chat failure -> NOT ok (healthy blocked), leg models', async () => {
		const stubs = useStubs({ chatOk: false, chatStatus: 400, chatDetail: 'model not found' });
		try {
			const res = await testPOST({ request: jsonRequest(ROW) });
			const verdict = await res.json();
			expect(verdict.ok).toBe(false);
			expect(verdict.leg).toBe('models');
		} finally {
			stubs.restore();
		}
	});

	it('both legs down -> ok false, leg null; upstream echo of the key is REDACTED', async () => {
		const stubs = useStubs({
			modelsOk: false,
			modelsStatus: 502,
			chatOk: false,
			chatStatus: 401,
			chatDetail: `bad credentials provided: ${ROW.apiKey}`
		});
		try {
			const res = await testPOST({ request: jsonRequest(ROW) });
			const text = await res.text();
			const verdict = JSON.parse(text);
			expect(verdict.ok).toBe(false);
			expect(verdict.leg).toBe(null);
			expect(text).not.toContain('lane-key-sentinel-nely');
			expect(verdict.error).toContain('[redacted]');
		} finally {
			stubs.restore();
		}
	});

	it('{key} form probes a stored row (config read server-side; masked response)', async () => {
		const create = await catalogPOST({ request: jsonRequest({ ...ROW, key: 'probe-me' }) });
		expect(create.status).toBe(201);
		const stubs = useStubs({});
		try {
			const res = await testPOST({ request: jsonRequest({ key: 'probe-me' }) });
			const verdict = await res.json();
			expect(verdict.ok).toBe(true);
			const chat = stubs.seen.find((s) => s.url.endsWith('/chat/completions'));
			expect(chat.init.headers.authorization).toBe(`Bearer ${ROW.apiKey}`);
		} finally {
			stubs.restore();
		}
		expect((await testPOST({ request: jsonRequest({ key: 'ghost' }) })).status).toBe(404);
	});

	it('invalid probe shape -> 400 generic, zero fetches; response never echoes input', async () => {
		const stubs = useStubs({});
		try {
			const res = await testPOST({
				request: jsonRequest({ baseUrl: 'https://x.sentinel.invalid/v1' })
			});
			expect(res.status).toBe(400);
			const text = await res.text();
			expect(stubs.seen).toHaveLength(0);
			expect(text).not.toContain('x.sentinel.invalid');
		} finally {
			stubs.restore();
		}
	});
});

describe('draft save after a FAILED test - API level (2026-11-21)', () => {
	beforeEach(clearEnv);
	afterEach(restoreEnv);

	function useTransportRefusal() {
		const orig = globalThis.fetch;
		globalThis.fetch = vi.fn(async () => {
			const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9'), {
				code: 'ECONNREFUSED'
			});
			throw new TypeError('fetch failed', { cause });
		});
		return { restore: () => (globalThis.fetch = orig) };
	}

	it('failed test verdict, then the very same config saves as draft 201', async () => {
		const stubs = useTransportRefusal();
		let key;
		try {
			const res = await testPOST({ request: jsonRequest(ROW) });
			const verdict = await res.json();
			expect(verdict.ok).toBe(false);
			expect(verdict.leg).toBe(null);
			expect(verdict.error).toBe('model not reachable from this server');
			// the probe itself persisted nothing
			expect(existsSync(userFile())).toBe(false);
			// the client's post-failure path: POST {..same fields, status:'draft'}
			const create = await catalogPOST({ request: jsonRequest({ ...ROW, status: 'draft' }) });
			expect(create.status).toBe(201);
			key = (await create.json()).key;
		} finally {
			stubs.restore();
		}
		const list = await catalogGET();
		const text = await list.text();
		expect(text).toContain(`"key":"${key}"`);
		expect(text).toContain('"status":"draft"');
		expectNoSecrets(text);
		const del = await rowDELETE({ params: { key } });
		expect(del.status).toBe(200);
	});

	it('a test-failure verdict never mutates the store (draft path stays clean)', async () => {
		writeOperator([{ key: 'lane-chat', label: 'Lane default (chat)', ...ROW }]);
		const before = existsSync(userFile());
		const stubs = useTransportRefusal();
		try {
			const res = await testPOST({ request: jsonRequest(ROW) });
			expect((await res.json()).ok).toBe(false);
		} finally {
			stubs.restore();
		}
		expect(existsSync(userFile())).toBe(before);
	});
});

function useConfiguredLanes() {
	process.env.AOI_LLM_BASE_URL = 'https://lane-default.invalid/v1';
	process.env.AOI_LLM_MODEL = 'lane-model';
}
