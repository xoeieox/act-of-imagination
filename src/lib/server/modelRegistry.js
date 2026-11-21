/**
 * Server-only model registry (aoi-model-selector-v0, 2026-11-21).
 *
 * One environment variable carries the whole registry surface:
 *   AOI_MODELS_JSON - a JSON array of operator-configured entries
 *     [{ "key": "…", "label": "…", "baseUrl": "…", "model": "…",
 *        "apiKey": "…", "maxTokens": 8192? }]
 * read from process.env at REQUEST time (same runtime-read contract as
 * AOI_DEV_PANEL): the operator edits the service env file and restarts -
 * no rebuild changes the list.
 *
 * Every entry is an OpenAI-compatible /chat/completions endpoint (the same
 * wire as src/lib/server/lane.js, provider v0 "openai"): covers OpenAI,
 * OpenRouter, Groq, local vLLM/SGLang, and Anthropic through its documented
 * OpenAI-compat endpoint. No native Messages adapter ships in this pass,
 * and this module ships no baked endpoints or keys - the registry is
 * operator config, entirely.
 *
 * Fail-closed decisions (aoi-model-selector-v0):
 *   - unset / whitespace / '[]'  -> EMPTY registry: the selector stays
 *     hidden and behavior is byte-identical to the lane-env posture
 *     (lane defaults win, /api/models answers []).
 *   - malformed (bad JSON, non-array, entry missing/invalid fields,
 *     duplicate keys) -> the registry is INVALID, not ignored:
 *     /api/models answers a generic 500 and any explicit modelKey
 *     selection 400s. No partial registries, no silent fallback to the
 *     lane path, and error bodies never echo registry content (it can
 *     carry keys).
 *
 * Kyma catalog rule: nothing exported from this module to a client ever
 * carries apiKey, model-id, or baseUrl values. /api/models exposes
 * [{key,label}] only (src/routes/api/models.test.js locks the shape;
 * check-invariants I-6b/I-8/I-9 keep it mechanical).
 *
 * Importable only from server code (src/lib/server/** is SvelteKit
 * server-only; invariant I-6a keeps it out of the client bundle).
 */

const KEY_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

function trimToValue(raw) {
	if (raw === undefined || raw === null) return '';
	const s = String(raw).trim();
	return s;
}

/** Validate + normalize one registry entry; null = the entry is invalid. */
function validateEntry(item) {
	if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

	const key = trimToValue(item.key);
	const label = trimToValue(item.label);
	const baseUrl = trimToValue(item.baseUrl).replace(/\/+$/, '');
	const model = trimToValue(item.model);

	if (!KEY_RE.test(key)) return null;
	if (!label || label.length > 80) return null;
	// Same posture as resolveLane: http(s) only, and never a hardcoded
	// default - an absent base url is an invalid entry, not a fallback.
	if (!/^https?:\/\//i.test(baseUrl)) return null;
	if (!model || model.length > 256) return null;

	let apiKey = null;
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

	return { key, label, baseUrl, model, apiKey, maxTokens };
}

/**
 * Parse AOI_MODELS_JSON from the env. Never throws; the result is one of:
 *   { entries: [],      invalid: false }  - unset/empty: selector hidden
 *   { entries: [entry], invalid: false }  - validated, ready to serve
 *   { entries: [],      invalid: true  }  - malformed: fail closed loudly
 * Entry values (baseUrl/model/apiKey) stay inside this module; callers
 * outside src/lib/server/** must only ever see registrySummary's
 * {key,label} pairs or a validated entry handed to lane chat's
 * modelOverride (never serialized to a client).
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

/**
 * The client-facing catalog: [{key,label}] - keys, model ids and base urls
 * never leave the server (Kyma catalog rule).
 */
export function registrySummary({ env = process.env } = {}) {
	const { entries, invalid } = parseRegistry({ env });
	if (invalid) return { models: [], invalid: true };
	return { models: entries.map((e) => ({ key: e.key, label: e.label })), invalid: false };
}

/**
 * Resolve a request's modelKey against the registry, server-side, before
 * any outbound fetch. Returns exactly one of:
 *   { entry: null }                        - no selection: lane env wins (today's posture)
 *   { entry: {...} }                       - validated override for this request
 *   { error: { status: 400, body } }       - unknown key / invalid registry /
 *                                            non-string selection: fail
 *                                            closed, never a silent
 *                                            fallback to the lane path.
 * Error bodies are fixed strings - they never echo the key or registry.
 */
export function resolveModelSelection(modelKey, { env = process.env } = {}) {
	if (modelKey === undefined || modelKey === null) return { entry: null };
	if (typeof modelKey !== 'string' || modelKey.trim() === '') {
		return { error: { status: 400, body: { error: 'unknown_model_key' } } };
	}
	const { entries, invalid } = parseRegistry({ env });
	if (invalid) {
		return { error: { status: 400, body: { error: 'model_registry_invalid' } } };
	}
	const entry = entries.find((e) => e.key === modelKey.trim());
	if (!entry) return { error: { status: 400, body: { error: 'unknown_model_key' } } };
	return { entry };
}
