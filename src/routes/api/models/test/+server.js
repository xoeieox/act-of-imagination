/**
 * Connection test endpoint (aoi-model-manager-v0, 2026-11-21).
 *
 * POST /api/models/test {base URL, model ID, key?, max tokens?} -> {ok,
 * latencyMs, leg, sample?, error?}  (probe semantics in
 * $lib/server/modelProbe.js: the listing leg runs FIRST - a bare-404
 * there while chat works is a known relay quirk - then a minimal chat
 * round-trip; the chat leg decides the verdict).
 *
 * The probe payload is NEVER persisted (invariant I-9: modelProbe.js
 * imports no fs at all; the battery proves the store files are untouched
 * by a test call). An optional {key} form probes an already-stored row:
 * the server reads the full config server-side, nothing echoes back.
 * Error strings are redacted of the api key before they reach a client.
 */
import { json } from '@sveltejs/kit';
import { probeModelConfig } from '$lib/server/modelProbe.js';
import { fullRowByKey, validateProbeShape } from '$lib/server/modelStore.js';

const NO_STORE = { 'cache-control': 'no-store' };

export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid_model_config' }, { status: 400, headers: NO_STORE });
	}

	let config;
	if (body && typeof body.key === 'string' && body.key.trim() !== '') {
		const found = fullRowByKey(body.key.trim());
		if (found.invalid)
			return json({ error: 'model_registry_invalid' }, { status: 500, headers: NO_STORE });
		if (found.missing)
			return json({ error: 'unknown_model_key' }, { status: 404, headers: NO_STORE });
		config = found.entry;
	} else {
		const shape = validateProbeShape(body);
		if (!shape.ok)
			return json({ error: 'invalid_model_config' }, { status: 400, headers: NO_STORE });
		config = shape.config;
	}

	const verdict = await probeModelConfig(config);
	return json(verdict, { headers: NO_STORE });
}
