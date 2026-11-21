/**
 * Server-only model store (aoi-model-manager-v0, 2026-11-21, Erah-ratified).
 *
 * Two JSON files on the server, both 0600, both written atomically
 * (temp file + rename in the same directory):
 *
 *   OPERATOR  ~/.config/aoi/operator-models.json  (agent/user-editable;
 *             replaces the AOI_MODELS_JSON env var as the primary source -
 *             an agent can set up AoI including a favorite model in one
 *             file write). When this file exists it is the WHOLE operator
 *             truth; AOI_MODELS_JSON remains a DEPRECATED fallback read
 *             only when the file is absent (keeps the PR #9 posture and
 *             its tests honest on machines that never migrated).
 *   USER      ~/.config/aoi/user-models.json      (written ONLY through
 *             the API by end users via the Manage models UI).
 *
 * Paths resolve per request from the env (runtime-read contract, same as
 * AOI_DEV_PANEL): AOI_MODEL_STORE_DIR overrides the directory,
 * AOI_OPERATOR_MODELS_FILE / AOI_USER_MODELS_FILE override each file
 * (the test surface). Never world-readable, never in git.
 *
 * Entry shape (both files): {key,label,baseUrl,model,apiKey?,maxTokens?}
 * plus optional {status:'healthy'|'draft'} on user rows, plus the
 * advanced-auth trio (aoi-advanced-auth-v0): optional
 * {authMode:'bearer'|'raw', extraHeaders:{name:value}, userAgent:'...'}
 * - validated at save time; defaults preserve today's wire shape exactly
 * (bearer, no extras, no UA override) and are OMITTED from stored rows.
 * The server validates shape and trims strings; other than that it
 * stores what the user typed, verbatim.
 *
 * Kyma catalog rule (extended): nothing serialized to a client ever
 * carries an apiKey VALUE or an operator row's endpoint - rows ship
 * {key,label,source,status?,hasKey?,keyLast4?}; user rows are the rows
 * THIS browser itself created, and even they expose only a masked
 * last-4 fragment (invariant I-9; sentinel battery in
 * src/routes/api/model-manager.test.js greps every response).
 *
 * Importable only from server code (src/lib/server/** is SvelteKit
 * server-only; I-6a keeps it out of the client bundle).
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const KEY_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const STATUSES = new Set(['healthy', 'draft']);

// Advanced auth (aoi-advanced-auth-v0, 2026-11-21): enum + header shape,
// validated at SAVE time. Header names normalize to lowercase; values
// travel verbatim server-side and never serialize to a client (I-8c).
const AUTH_MODES = new Set(['bearer', 'raw']);
const HEADER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Client-settable header names that must stay under lane control: the
// Authorization header is governed by authMode; transport framing headers
// break fetch when overridden.
const FORBIDDEN_EXTRA_HEADERS = new Set([
	'authorization',
	'proxy-authorization',
	'host',
	'content-type',
	'content-length',
	'connection',
	'keep-alive',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'expect'
]);
const MAX_EXTRA_HEADERS = 16;
const MAX_EXTRA_HEADER_VALUE = 512;
const MAX_USER_AGENT = 200;

function trimToValue(raw) {
	if (raw === undefined || raw === null) return '';
	return String(raw).trim();
}

/**
 * Validate + normalize one registry entry; null = the entry is invalid.
 * Same fail-closed shape rules as the PR #9 registry: key/label/baseUrl/
 * model are required and well-formed; apiKey empty-or-absent normalizes
 * to null (local vLLM needs no key); maxTokens must be a positive integer.
 */
export function validateEntry(item) {
	if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

	const key = trimToValue(item.key);
	const label = trimToValue(item.label);
	const baseUrl = trimToValue(item.baseUrl).replace(/\/+$/, '');
	const model = trimToValue(item.model);

	if (!KEY_RE.test(key)) return null;
	if (!label || label.length > 80) return null;
	if (!/^https?:\/\//i.test(baseUrl)) return null;
	if (!model || model.length > 256) return null;

	let apiKey = trimToValue(item.apiKey) || null;
	if (item.apiKey !== undefined && item.apiKey !== null) {
		if (typeof item.apiKey !== 'string') return null;
		apiKey = trimToValue(item.apiKey) || null;
	}

	let maxTokens = null;
	if (item.maxTokens !== undefined && item.maxTokens !== null && item.maxTokens !== '') {
		const parsed = Number(item.maxTokens);
		if (!Number.isInteger(parsed) || parsed <= 0) return null;
		maxTokens = parsed;
	}

	// --- advanced auth trio (aoi-advanced-auth-v0): validated HERE at save
	// time (an unknown authMode is a 400 at save, never silently ignored at
	// chat time - and a bad value inside a store file fails the whole store
	// closed like any other malformed field). Defaults are OMITTED from the
	// entry so a plain row stays byte-identical to the historic shape.
	if (item.authMode !== undefined && item.authMode !== null && item.authMode !== '') {
		if (typeof item.authMode !== 'string' || !AUTH_MODES.has(item.authMode)) return null;
	}
	const authMode = item.authMode === 'raw' ? 'raw' : undefined;

	let extraHeaders = null;
	if (item.extraHeaders !== undefined && item.extraHeaders !== null && item.extraHeaders !== '') {
		if (typeof item.extraHeaders !== 'object' || Array.isArray(item.extraHeaders)) return null;
		const pairs = Object.entries(item.extraHeaders);
		if (pairs.length > MAX_EXTRA_HEADERS) return null;
		const out = {};
		for (const [rawName, rawValue] of pairs) {
			const name = String(rawName).trim().toLowerCase();
			if (!HEADER_NAME_RE.test(name)) return null;
			if (FORBIDDEN_EXTRA_HEADERS.has(name)) return null;
			if (typeof rawValue !== 'string') return null;
			const value = rawValue.trim();
			if (value === '' || value.length > MAX_EXTRA_HEADER_VALUE) return null;
			out[name] = value;
		}
		if (Object.keys(out).length > 0) extraHeaders = out;
	}

	let userAgent = null;
	if (item.userAgent !== undefined && item.userAgent !== null) {
		if (typeof item.userAgent !== 'string') return null;
		const candidate = trimToValue(item.userAgent);
		if (candidate !== '') {
			if (candidate.length > MAX_USER_AGENT) return null;
			userAgent = candidate;
		}
	}

	const entry = { key, label, baseUrl, model, apiKey, maxTokens };
	if (authMode) entry.authMode = 'raw';
	if (extraHeaders) entry.extraHeaders = extraHeaders;
	if (userAgent) entry.userAgent = userAgent;
	return entry;
}

/**
 * DEPRECATED env-registry fallback (AOI_MODELS_JSON), kept byte-identical
 * to the PR #9 contract so un-migrated setups keep working and the PR #9
 * posture tests stay honest. Read from the env at call time; never throws.
 */
export function parseRegistry({ env = process.env } = {}) {
	const raw = trimToValue(env.AOI_MODELS_JSON);
	if (raw === '') return { entries: [], invalid: false };

	let data;
	try {
		data = JSON.parse(raw);
	} catch {
		return { entries: [], invalid: true };
	}
	if (!Array.isArray(data)) return { entries: [], invalid: true };

	const entries = [];
	const seen = new Set();
	for (const item of data) {
		const entry = validateEntry(item);
		if (!entry) return { entries: [], invalid: true };
		if (seen.has(entry.key)) return { entries: [], invalid: true };
		seen.add(entry.key);
		entries.push(entry);
	}
	return { entries, invalid: false };
}

/** Resolve the two file paths for one request's env table. A defined
 * AOI_MODEL_STORE_DIR (even empty) is honored verbatim - the test surface
 * pins it to a nonexistent directory to prove env-only posture. */
export function storePaths({ env = process.env } = {}) {
	const configured = Object.prototype.hasOwnProperty.call(env, 'AOI_MODEL_STORE_DIR');
	const dir = configured ? String(env.AOI_MODEL_STORE_DIR) : path.join(homedir(), '.config', 'aoi');
	return {
		operator: trimToValue(env.AOI_OPERATOR_MODELS_FILE) || path.join(dir, 'operator-models.json'),
		user: trimToValue(env.AOI_USER_MODELS_FILE) || path.join(dir, 'user-models.json')
	};
}

/**
 * Atomic write: temp file (0600 from creation) in the SAME directory, then
 * rename over the target, then chmod 0600 on both tmp and final so a
 * permissive umask can never widen the mode. mkdir mirrors the 0700 dir
 * posture of ~/.config/aoi on the box. Unit-locked in modelStore.test.js.
 */
export function atomicWriteJson(filePath, data) {
	const dir = path.dirname(filePath);
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	const tmp = path.join(
		dir,
		`.` + path.basename(filePath) + `.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
	);
	writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
	chmodSync(tmp, 0o600);
	renameSync(tmp, filePath);
	chmodSync(filePath, 0o600);
}

function readJsonRows(filePath) {
	if (!existsSync(filePath)) return { rows: [], missing: true };
	let raw;
	try {
		raw = readFileSync(filePath, 'utf8');
	} catch {
		return { rows: [], invalid: true };
	}
	let data;
	try {
		data = JSON.parse(raw);
	} catch {
		return { rows: [], invalid: true };
	}
	if (!Array.isArray(data)) return { rows: [], invalid: true };

	const rows = [];
	const seen = new Set();
	for (const item of data) {
		const entry = validateEntry(item);
		if (!entry) return { rows: [], invalid: true };
		if (seen.has(entry.key)) return { rows: [], invalid: true };
		seen.add(entry.key);
		let status = 'draft';
		if (item.status !== undefined && item.status !== null) {
			if (!STATUSES.has(item.status)) return { rows: [], invalid: true };
			status = item.status;
		}
		rows.push({ ...entry, status });
	}
	return { rows, missing: false };
}

/**
 * The combined registry the whole server reads: operator rows (file, or
 * the deprecated env fallback when the file is absent) first, then user
 * rows. A user row that collides with an operator key is dropped from the
 * listing defensively (creation prevents it). Any malformed file fails
 * the ENTIRE registry closed (same doctrine as the PR #9 env registry):
 * /api/models 500s, selections 400, nothing partially trusted.
 */
export function combinedRegistry({ env = process.env } = {}) {
	const loc = storePaths({ env });

	let entries;

	if (existsSync(loc.operator)) {
		const loaded = readJsonRows(loc.operator);
		if (loaded.invalid) return { entries: [], invalid: true };
		entries = loaded.rows.map((r) => ({ ...r, source: 'operator' }));
	} else {
		const legacy = parseRegistry({ env });
		if (legacy.invalid) return { entries: [], invalid: true };
		entries = legacy.entries.map((r) => ({ ...r, source: 'operator', status: 'healthy' }));
	}

	const userLoaded = existsSync(loc.user) ? readJsonRows(loc.user) : { rows: [] };
	if (userLoaded.invalid) return { entries: [], invalid: true };

	const opKeys = new Set(entries.map((e) => e.key));
	for (const row of userLoaded.rows) {
		if (opKeys.has(row.key)) continue; // operator keys shadow; API forbids collisions
		entries.push({ ...row, source: 'user' });
	}
	return { entries, invalid: false };
}

/** Last-4 masked key fragment; null when no key. Never more than 4 chars. */
function keyLast4(apiKey) {
	if (typeof apiKey !== 'string' || apiKey === '') return null;
	return apiKey.length <= 4 ? apiKey : apiKey.slice(-4);
}

/**
 * Masked advanced-auth hints for USER rows only (Kyma catalog rule
 * extended, aoi-advanced-auth-v0): authMode ships only when 'raw' (the
 * default stays byte-identical to the historic row shape), extra header
 * NAMES may be echoed, their VALUES never; the UA ships as a boolean flag
 * only. The manager UI renders masked values from these - the raw values
 * never leave this module (invariant I-8c + sentinel battery).
 */
function attachMaskedAuth(row, out) {
	if (row.authMode === 'raw') out.authMode = 'raw';
	if (row.extraHeaders) out.extraHeaderNames = Object.keys(row.extraHeaders);
	if (row.userAgent) out.hasUserAgent = true;
}

/**
 * The client-facing catalog (Kyma catalog rule): operator rows ship
 * {key,label,source}; user rows additionally {status,hasKey?,keyLast4?}.
 * Endpoint fields and key VALUES of stored rows never leave this module
 * except through resolveModelSelection's server-internal entry hand-off
 * to the lane chat (never serialized to a client - locked by sentinels).
 */
export function registrySummary({ env = process.env } = {}) {
	const { entries, invalid } = combinedRegistry({ env });
	if (invalid) return { models: [], invalid: true };
	return {
		models: entries.map((e) => {
			const row = { key: e.key, label: e.label, source: e.source };
			if (e.source === 'user') {
				row.status = e.status;
				if (e.apiKey) {
					row.hasKey = true;
					const last4 = keyLast4(e.apiKey);
					if (last4) row.keyLast4 = last4;
				}
				attachMaskedAuth(e, row);
			} else if (e.apiKey) {
				row.hasKey = true;
			}
			return row;
		}),
		invalid: false
	};
}

/** Server-internal: resolve a request's modelKey against BOTH registries. */
export function resolveCombinedSelection(modelKey, { env = process.env } = {}) {
	if (modelKey === undefined || modelKey === null) return { entry: null };
	if (typeof modelKey !== 'string' || modelKey.trim() === '') {
		return { error: { status: 400, body: { error: 'unknown_model_key' } } };
	}
	const { entries, invalid } = combinedRegistry({ env });
	if (invalid) {
		return { error: { status: 400, body: { error: 'model_registry_invalid' } } };
	}
	const entry = entries.find((e) => e.key === modelKey.trim());
	if (!entry) return { error: { status: 400, body: { error: 'unknown_model_key' } } };
	return { entry };
}

function newGeneratedKey() {
	return 'user-' + randomBytes(5).toString('hex');
}

/**
 * Normalize a create/patch body into a storable user row. Returns
 * { row } or { error: '<code>' } with generic codes - validation echoes
 * nothing the user typed. `base` (when patching) supplies preserved
 * fields; blank/absent string fields preserve the stored value; an
 * explicit empty apiKey clears the stored key.
 */
export function normalizeUserRow(body, base = null) {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return { error: 'invalid_model_config' };
	}
	const merged = {
		key: trimToValue(body.key) || (base ? base.key : ''),
		label:
			body.label === undefined || body.label === null || trimToValue(body.label) === ''
				? base
					? base.label
					: ''
				: String(body.label),
		baseUrl:
			body.baseUrl === undefined || body.baseUrl === null || trimToValue(body.baseUrl) === ''
				? base
					? base.baseUrl
					: ''
				: String(body.baseUrl),
		model:
			body.model === undefined || body.model === null || trimToValue(body.model) === ''
				? base
					? base.model
					: ''
				: String(body.model),
		apiKey:
			body.apiKey === undefined
				? base
					? base.apiKey
					: null
				: body.apiKey === null
					? null
					: String(body.apiKey),
		maxTokens:
			body.maxTokens === undefined || body.maxTokens === null || body.maxTokens === ''
				? base
					? base.maxTokens
					: null
				: body.maxTokens,
		// Advanced auth follows the same blank-preserves-stored contract as
		// every other field; an explicit empty object / empty string CLEARS
		// (the UI's 'remove stored headers & user-agent'). A bad authMode is
		// rejected by validateEntry below -> save-time 400.
		authMode:
			body.authMode === undefined || body.authMode === null || body.authMode === ''
				? base
					? base.authMode
					: undefined
				: body.authMode,
		extraHeaders:
			body.extraHeaders === undefined || body.extraHeaders === null
				? base
					? base.extraHeaders
					: undefined
				: body.extraHeaders,
		userAgent:
			body.userAgent === undefined || body.userAgent === null
				? base
					? base.userAgent
					: undefined
				: body.userAgent
	};

	if (!merged.key) merged.key = newGeneratedKey();
	const entry = validateEntry(merged);
	if (!entry) return { error: 'invalid_model_config' };

	let status = base ? base.status : 'draft';
	if (body.status !== undefined && body.status !== null && body.status !== '') {
		if (typeof body.status !== 'string' || !STATUSES.has(body.status)) {
			return { error: 'invalid_model_status' };
		}
		status = body.status;
	}
	return { row: { ...entry, status, source: 'user' } };
}

/**
 * Create a user row. Operator-key collisions answer 403 with a clear
 * message (operator rows are managed by file, never through the API);
 * user-key collisions answer 409. Success: 201 + the summary row only.
 */
export function createUserRow(body, { env = process.env } = {}) {
	const normalized = normalizeUserRow(body);
	if (normalized.error) return { status: 400, body: { error: normalized.error } };

	const { entries, invalid } = combinedRegistry({ env });
	if (invalid) return { status: 500, body: { error: 'model_registry_invalid' } };

	const clash = entries.find((e) => e.key === normalized.row.key);
	if (clash) {
		if (clash.source === 'operator') {
			return {
				status: 403,
				body: {
					error: 'operator_model_readonly',
					hint: 'operator models are managed by file, not by the API'
				}
			};
		}
		return { status: 409, body: { error: 'model_key_taken' } };
	}

	const loc = storePaths({ env });
	const userLoaded = existsSync(loc.user) ? readJsonRows(loc.user) : { rows: [] };
	if (userLoaded.invalid) return { status: 500, body: { error: 'model_registry_invalid' } };

	const rows = userLoaded.rows.map((row) => {
		const { source: _s, ...persist } = row;
		return persist;
	});
	const keep = normalized.row;
	rows.push({
		key: keep.key,
		label: keep.label,
		baseUrl: keep.baseUrl,
		model: keep.model,
		apiKey: keep.apiKey,
		maxTokens: keep.maxTokens,
		...(keep.authMode ? { authMode: keep.authMode } : {}),
		...(keep.extraHeaders ? { extraHeaders: keep.extraHeaders } : {}),
		...(keep.userAgent ? { userAgent: keep.userAgent } : {}),
		status: keep.status
	});
	try {
		atomicWriteJson(loc.user, rows);
	} catch {
		return { status: 500, body: { error: 'model_store_write_failed' } };
	}
	const { key, label, status } = normalized.row;
	const out = { key, label, source: 'user', status };
	if (normalized.row.apiKey) {
		out.hasKey = true;
		const last4 = keyLast4(normalized.row.apiKey);
		if (last4) out.keyLast4 = last4;
	}
	attachMaskedAuth(normalized.row, out);
	return { status: 201, body: out };
}

function userRowResult(row) {
	const out = { key: row.key, label: row.label, source: 'user', status: row.status };
	if (row.apiKey) {
		out.hasKey = true;
		const last4 = keyLast4(row.apiKey);
		if (last4) out.keyLast4 = last4;
	}
	attachMaskedAuth(row, out);
	return out;
}

export function updateUserRow(key, body, { env = process.env } = {}) {
	if (typeof key !== 'string' || key === '')
		return { status: 400, body: { error: 'unknown_model_key' } };
	const { entries, invalid } = combinedRegistry({ env });
	if (invalid) return { status: 500, body: { error: 'model_registry_invalid' } };

	const existing = entries.find((e) => e.key === key);
	if (existing && existing.source === 'operator') {
		return {
			status: 403,
			body: {
				error: 'operator_model_readonly',
				hint: 'operator models are managed by file, not by the API'
			}
		};
	}
	if (!existing) return { status: 404, body: { error: 'unknown_model_key' } };

	const base = { ...existing };
	// The key itself is immutable (and operator keys are 403'd above).
	const normalized = normalizeUserRow({ ...body, key: undefined }, base);
	if (normalized.error) return { status: 400, body: { error: normalized.error } };

	const loc = storePaths({ env });
	const userLoaded = readJsonRows(loc.user);
	if (userLoaded.invalid) return { status: 500, body: { error: 'model_registry_invalid' } };
	const rows = userLoaded.rows.map((row) => {
		if (row.key !== key) return row;
		const keep = normalized.row;
		return {
			key: keep.key,
			label: keep.label,
			baseUrl: keep.baseUrl,
			model: keep.model,
			apiKey: keep.apiKey,
			maxTokens: keep.maxTokens,
			...(keep.authMode ? { authMode: keep.authMode } : {}),
			...(keep.extraHeaders ? { extraHeaders: keep.extraHeaders } : {}),
			...(keep.userAgent ? { userAgent: keep.userAgent } : {}),
			status: keep.status
		};
	});
	try {
		atomicWriteJson(loc.user, rows);
	} catch {
		return { status: 500, body: { error: 'model_store_write_failed' } };
	}
	return { status: 200, body: userRowResult(normalized.row) };
}

export function deleteUserRow(key, { env = process.env } = {}) {
	if (typeof key !== 'string' || key === '')
		return { status: 400, body: { error: 'unknown_model_key' } };
	const { entries, invalid } = combinedRegistry({ env });
	if (invalid) return { status: 500, body: { error: 'model_registry_invalid' } };

	const existing = entries.find((e) => e.key === key);
	if (existing && existing.source === 'operator') {
		return {
			status: 403,
			body: {
				error: 'operator_model_readonly',
				hint: 'operator models are managed by file, not by the API'
			}
		};
	}
	if (!existing) return { status: 404, body: { error: 'unknown_model_key' } };

	const loc = storePaths({ env });
	const userLoaded = readJsonRows(loc.user);
	if (userLoaded.invalid) return { status: 500, body: { error: 'model_registry_invalid' } };
	const rows = userLoaded.rows.filter((row) => row.key !== key);
	try {
		atomicWriteJson(loc.user, rows);
	} catch {
		return { status: 500, body: { error: 'model_store_write_failed' } };
	}
	return { status: 200, body: { deleted: true } };
}

/**
 * Validate an explicit test-payload shape {baseUrl,model,apiKey?,
 * maxTokens?} without persisting anything. Returns {ok:true,config} or
 * {ok:false} - generic, echoes nothing user-typed.
 */
export function validateProbeShape(body) {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false };
	const entry = validateEntry({ ...body, key: 'probe', label: 'probe' });
	if (!entry) return { ok: false };
	return {
		ok: true,
		config: {
			baseUrl: entry.baseUrl,
			model: entry.model,
			apiKey: entry.apiKey,
			maxTokens: entry.maxTokens,
			// probe carries the FULL auth config so Test validates the
			// exotic shape exactly as chat will send it (aoi-advanced-auth-v0)
			...(entry.authMode ? { authMode: entry.authMode } : {}),
			...(entry.extraHeaders ? { extraHeaders: entry.extraHeaders } : {}),
			...(entry.userAgent ? { userAgent: entry.userAgent } : {})
		}
	};
}

/** Look up a stored row's FULL config for the test probe (server-side only). */
export function fullRowByKey(key, { env = process.env } = {}) {
	const { entries, invalid } = combinedRegistry({ env });
	if (invalid) return { invalid: true };
	const entry = entries.find((e) => e.key === key);
	if (!entry) return { missing: true };
	return { entry };
}
