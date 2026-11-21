/**
 * Advanced-auth battery (aoi-advanced-auth-v0, 2026-11-21).
 *
 * Wire-shape + redaction contracts for the row-level auth fields
 * {authMode:'bearer'|'raw', extraHeaders:{name:value}, userAgent:'...'}:
 *   - save-time enum validation (unknown authMode = 400, never silently
 *     ignored at chat time); forbidden/duplicate names rejected;
 *   - raw mode ships the key VERBATIM (no 'Bearer ' prefix) and extra
 *     headers / UA ride every outbound request - asserted on the EXACT
 *     header objects the fetch stubs captured (OpenCode Go shape:
 *     raw Authorization + x-opencode-session + custom UA, Kyma
 *     investigation 2026-11-02; the chat POST is the leg that matters);
 *   - masked serialization: extraHeader NAMES may ship to the client,
 *     header VALUES and the UA value never do (sentinels below);
 *   - the probe runs the row's FULL auth config (Test validates the
 *     exotic shape on both legs) and redacts every advanced VALUE from
 *     upstream echoes;
 *   - combined-store selection still 400s on unknown keys; a plain
 *     bearer row stays byte-identical to the historic wire shape.
 * All fixtures synthetic; zero real network (fetch stubs everywhere).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GET as catalogGET, POST as catalogPOST } from './models/+server.js';
import { PATCH as rowPATCH } from './models/[key]/+server.js';
import { POST as testPOST } from './models/test/+server.js';
import { POST as chatPOST } from './chat/+server.js';
import { probeModelConfig } from '$lib/server/modelProbe.js';

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
	dir = mkdtempSync(path.join(tmpdir(), 'aoi-adv-test-'));
	process.env.AOI_MODEL_STORE_DIR = dir;
	process.env.AOI_LLM_BASE_URL = 'https://lane-default.invalid/v1';
	process.env.AOI_LLM_MODEL = 'lane-model';
}

function restoreEnv() {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
	rmSync(dir, { recursive: true, force: true });
}

const userFile = () => path.join(dir, 'user-models.json');

function jsonRequest(body) {
	return new Request('http://localhost/api', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

/** Stubs every fetch the probe/chat paths make; records exact inits. */
function useStubs({ chatOk = true, chatStatus = 200, chatDetail = '' } = {}) {
	const orig = globalThis.fetch;
	const seen = [];
	globalThis.fetch = vi.fn(async (url, init) => {
		seen.push({ url: String(url), init: init ?? {} });
		if (String(url).endsWith('/models')) {
			return {
				ok: true,
				status: 200,
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

// ---- synthetic sentinels (check-secrets safe: no sk- prefix, no Bearer- shape) ----
const RAW_KEY = 'go-re…ey-9';
const SESSION_VALUE = 'sess-secret-alpha';
const CLIENT_VALUE = 'clie…ta-3';
const UA_VALUE = 'aoi-go-agent-7';

const EXOTIC = {
	label: 'OpenCode Go (synthetic)',
	baseUrl: 'https://go-relay-sentinel.invalid/v1',
	model: 'go-relay-model-sentinel',
	apiKey: RAW_KEY,
	authMode: 'raw',
	extraHeaders: {
		'X-Opencode-Session': SESSION_VALUE, // mixed case on input: stored lowercase
		'x-opencode-client': CLIENT_VALUE
	},
	userAgent: UA_VALUE
};

const ADV_SENTINELS = [
	RAW_KEY,
	SESSION_VALUE,
	CLIENT_VALUE,
	UA_VALUE,
	'go-relay-sentinel.invalid',
	'go-relay-model-sentinel'
];

function expectNoSecrets(text) {
	for (const s of ADV_SENTINELS) expect(text).not.toContain(s);
}

describe('advanced-auth save-time validation (generic 400s, no echo)', () => {
	beforeEach(clearEnv);
	afterEach(restoreEnv);

	it('unknown authMode value -> 400 invalid_model_config at save time', async () => {
		const stubs = useStubs({});
		try {
			const bad = await catalogPOST({
				request: jsonRequest({ ...EXOTIC, authMode: 'definitely-bogus' })
			});
			expect(bad.status).toBe(400);
			const text = await bad.text();
			expect(JSON.parse(text)).toEqual({ error: 'invalid_model_config' });
			expectNoSecrets(text);
			expect(stubs.seen).toHaveLength(0); // nothing left the process
		} finally {
			stubs.restore();
		}
	});

	it('authorization/content-type/host are forbidden extra-header names -> 400', async () => {
		for (const name of ['authorization', 'content-type', 'host']) {
			const bad = await catalogPOST({
				request: jsonRequest({ ...EXOTIC, extraHeaders: { [name]: 'nope-nope-1234' } })
			});
			expect(bad.status).toBe(400);
			expect((await bad.json()).error).toBe('invalid_model_config');
		}
	});

	it('valid exotic row stores VERBATIM (lowercased names) and ships masked hints only', async () => {
		const create = await catalogPOST({ request: jsonRequest(EXOTIC) });
		expect(create.status).toBe(201);
		const created = await create.json();
		expect(created.source).toBe('user');
		expect(created.hasKey).toBe(true);
		expect(created.authMode).toBe('raw');
		expect(created.extraHeaderNames).toEqual(['x-opencode-session', 'x-opencode-client']);
		expect(created.hasUserAgent).toBe(true);
		// masked create response never carries a value
		expectNoSecrets(JSON.stringify(created));

		// stored raw, exactly as typed (names normalized lowercase)
		const stored = JSON.parse(readFileSync(userFile(), 'utf8'))[0];
		expect(stored.authMode).toBe('raw');
		expect(stored.extraHeaders['x-opencode-session']).toBe(SESSION_VALUE);
		expect(stored.extraHeaders['x-opencode-client']).toBe(CLIENT_VALUE);
		expect(stored.userAgent).toBe(UA_VALUE);
		expect(stored.apiKey).toBe(RAW_KEY);

		// catalog: NAMES + flags ship, values never
		const list = await catalogGET();
		const text = await list.text();
		expect(text).toContain('"authMode":"raw"');
		expect(text).toContain('x-opencode-session');
		expect(text).toContain('"hasUserAgent":true');
		expectNoSecrets(text);
	});

	it('a plain row keeps the historic masked shape (no advanced fields at all)', async () => {
		const create = await catalogPOST({
			request: jsonRequest({
				label: 'Plain',
				baseUrl: 'https://plain-sentinel.invalid/v1',
				model: 'plain-model',
				apiKey: 'plain-key-sentinel-5'
			})
		});
		expect(create.status).toBe(201);
		const created = await create.json();
		expect(created.authMode).toBeUndefined();
		expect(created.extraHeaderNames).toBeUndefined();
		expect(created.hasUserAgent).toBeUndefined();
		const stored = JSON.parse(readFileSync(userFile(), 'utf8'))[0];
		expect('authMode' in stored).toBe(false);
		expect('extraHeaders' in stored).toBe(false);
		expect('userAgent' in stored).toBe(false);
	});

	it('PATCH preserves stored auth fields when untouched; explicit clear works', async () => {
		const create = await catalogPOST({ request: jsonRequest(EXOTIC) });
		const key = (await create.json()).key;

		const rename = await rowPATCH({ params: { key }, request: jsonRequest({ label: 'Renamed' }) });
		expect(rename.status).toBe(200);
		const kept = JSON.parse(readFileSync(userFile(), 'utf8'))[0];
		expect(kept.authMode).toBe('raw');
		expect(kept.extraHeaders['x-opencode-session']).toBe(SESSION_VALUE);
		expect(kept.userAgent).toBe(UA_VALUE);

		const bad = await rowPATCH({ params: { key }, request: jsonRequest({ authMode: 'sideways' }) });
		expect(bad.status).toBe(400);
		expect((await JSON.parse(readFileSync(userFile(), 'utf8'))[0]).authMode).toBe('raw'); // store untouched

		const clear = await rowPATCH({
			params: { key },
			request: jsonRequest({ extraHeaders: {}, userAgent: '' })
		});
		expect(clear.status).toBe(200);
		const cleared = await clear.json();
		expect(cleared.extraHeaderNames).toBeUndefined();
		expect(cleared.hasUserAgent).toBeUndefined();
		expectNoSecrets(JSON.stringify(cleared));
		const stored = JSON.parse(readFileSync(userFile(), 'utf8'))[0];
		expect('extraHeaders' in stored).toBe(false);
		expect('userAgent' in stored).toBe(false);
		expect(stored.authMode).toBe('raw'); // authMode stays until changed explicitly
	});
});

describe('chat wire shape through a saved row (exact captured headers)', () => {
	beforeEach(clearEnv);
	afterEach(restoreEnv);

	async function createRow(body) {
		const create = await catalogPOST({ request: jsonRequest(body) });
		expect(create.status).toBe(201);
		return (await create.json()).key;
	}

	it('raw row: Authorization verbatim (NO Bearer prefix), session/client headers + UA on the chat POST', async () => {
		const key = await createRow(EXOTIC);
		const stubs = useStubs({});
		try {
			const res = await chatPOST({
				request: jsonRequest({
					messages: [{ role: 'user', content: 'hello' }],
					cards: [],
					modelKey: key
				})
			});
			expect(res.status).toBe(200);
			const chat = stubs.seen.find((s) => s.url.endsWith('/chat/completions'));
			expect(chat).toBeTruthy();
			expect(chat.url).toBe('https://go-relay-sentinel.invalid/v1/chat/completions');
			const h = chat.init.headers;
			// the EXACT headers OpenCode Go demands (Kyma investigation 2026-11-02):
			expect(h.authorization).toBe(RAW_KEY);
			expect(h.authorization.startsWith('Bearer')).toBe(false);
			expect(h['x-opencode-session']).toBe(SESSION_VALUE);
			expect(h['x-opencode-client']).toBe(CLIENT_VALUE);
			expect(h['user-agent']).toBe(UA_VALUE);
			expect(h['content-type']).toBe('application/json');
		} finally {
			stubs.restore();
		}
	});

	it('bearer default stays byte-identical: Bearer prefix, no extras, no UA', async () => {
		const key = await createRow({
			label: 'Plain',
			baseUrl: 'https://plain-sentinel.invalid/v1',
			model: 'plain-model',
			apiKey: 'plain-key-sentinel-5'
		});
		const stubs = useStubs({});
		try {
			const res = await chatPOST({
				request: jsonRequest({
					messages: [{ role: 'user', content: 'hi' }],
					cards: [],
					modelKey: key
				})
			});
			expect(res.status).toBe(200);
			const h = stubs.seen[0].init.headers;
			expect(h.authorization).toBe(`Bearer plain-key-sentinel-5`);
			expect(h['user-agent']).toBeUndefined();
			expect(Object.keys(h).sort()).toEqual(['authorization', 'content-type']);
		} finally {
			stubs.restore();
		}
	});

	it('combined-store selection: unknown key still 400 with zero outbound fetches', async () => {
		await createRow(EXOTIC);
		const stubs = useStubs({});
		try {
			const res = await chatPOST({
				request: jsonRequest({
					messages: [{ role: 'user', content: 'hi' }],
					cards: [],
					modelKey: 'no-such-row'
				})
			});
			expect(res.status).toBe(400);
			expect((await res.json()).error).toBe('unknown_model_key');
			expect(stubs.seen).toHaveLength(0);
		} finally {
			stubs.restore();
		}
	});

	it('a malformed authMode inside a store file fails the registry closed (no silent chat)', async () => {
		const key = await createRow(EXOTIC);
		const rows = JSON.parse(readFileSync(userFile(), 'utf8'));
		rows[0].authMode = 'bogus-in-store';
		writeFileSync(userFile(), JSON.stringify(rows), { mode: 0o600 });
		const stubs = useStubs({});
		try {
			const res = await chatPOST({
				request: jsonRequest({
					messages: [{ role: 'user', content: 'hi' }],
					cards: [],
					modelKey: key
				})
			});
			expect(res.status).toBe(400);
			expect((await res.json()).error).toBe('model_registry_invalid');
			expect(stubs.seen).toHaveLength(0);
		} finally {
			stubs.restore();
		}
	});
});

describe('probe uses the FULL auth config (Test validates the exotic shape)', () => {
	beforeEach(clearEnv);
	afterEach(restoreEnv);

	it('explicit {authMode,extraHeaders,userAgent} probe: exact headers on BOTH legs', async () => {
		const stubs = useStubs({});
		try {
			const res = await testPOST({ request: jsonRequest(EXOTIC) });
			expect(res.status).toBe(200);
			const verdict = await res.json();
			expect(verdict.ok).toBe(true);
			expect(verdict.leg).toBe('both');
			for (const leg of ['models', 'chat/completions']) {
				const s = stubs.seen.find((x) => x.url.endsWith(leg));
				expect(s, `leg ${leg} was fetched`).toBeTruthy();
				const h = s.init.headers;
				expect(h.authorization).toBe(RAW_KEY);
				expect(h.authorization.startsWith('Bearer')).toBe(false);
				expect(h['x-opencode-session']).toBe(SESSION_VALUE);
				expect(h['x-opencode-client']).toBe(CLIENT_VALUE);
				expect(h['user-agent']).toBe(UA_VALUE);
			}
		} finally {
			stubs.restore();
		}
		// probe NEVER persists
		expect(existsSync(userFile())).toBe(false);
	});

	it('explicit unknown authMode -> 400 generic, zero fetches, no echo', async () => {
		const stubs = useStubs({});
		try {
			const res = await testPOST({ request: jsonRequest({ ...EXOTIC, authMode: 'weird-mode' }) });
			expect(res.status).toBe(400);
			expect((await res.json()).error).toBe('invalid_model_config');
			expect(stubs.seen).toHaveLength(0);
		} finally {
			stubs.restore();
		}
	});

	it('{key} form probes the stored row with its full exotic config', async () => {
		const create = await catalogPOST({ request: jsonRequest({ ...EXOTIC, key: 'go-probe' }) });
		expect(create.status).toBe(201);
		const stubs = useStubs({});
		try {
			const res = await testPOST({ request: jsonRequest({ key: 'go-probe' }) });
			expect((await res.json()).ok).toBe(true);
			const chat = stubs.seen.find((x) => x.url.endsWith('/chat/completions'));
			expect(chat.init.headers.authorization).toBe(RAW_KEY);
			expect(chat.init.headers['x-opencode-session']).toBe(SESSION_VALUE);
			expect(chat.init.headers['user-agent']).toBe(UA_VALUE);
		} finally {
			stubs.restore();
		}
	});

	it('MissingSessionID-style 400 echoing an advanced VALUE is redacted before the client sees it', async () => {
		const stubs = useStubs({
			chatOk: false,
			chatStatus: 400,
			chatDetail: `{"type":"error","error":{"type":"MissingSessionID","message":"session ${SESSION_VALUE} invalid for key ${RAW_KEY}"}}`
		});
		try {
			const res = await testPOST({ request: jsonRequest(EXOTIC) });
			const text = await res.text();
			const verdict = JSON.parse(text);
			expect(verdict.ok).toBe(false);
			expect(text).not.toContain(SESSION_VALUE);
			expect(text).not.toContain(RAW_KEY);
			expect(verdict.error).toContain('[redacted]');
		} finally {
			stubs.restore();
		}
	});

	it('direct probeModelConfig: UA/extra values never leak through error text', async () => {
		const fetchImpl = vi.fn(async () => ({
			ok: false,
			status: 401,
			text: async () => `unauthorized: agent ${UA_VALUE} not allowed, session ${SESSION_VALUE}`,
			json: async () => ({})
		}));
		const verdict = await probeModelConfig(
			{
				baseUrl: 'https://adv-probe.invalid/v1',
				model: 'm',
				apiKey: RAW_KEY,
				authMode: 'raw',
				extraHeaders: { 'x-opencode-session': SESSION_VALUE },
				userAgent: UA_VALUE
			},
			{ fetchImpl }
		);
		expect(verdict.ok).toBe(false);
		expect(JSON.stringify(verdict)).not.toContain(SESSION_VALUE);
		expect(JSON.stringify(verdict)).not.toContain(UA_VALUE);
		expect(JSON.stringify(verdict)).not.toContain(RAW_KEY);
	});
});
