/**
 * Model catalog + user-row CRUD (2026-11-21).
 *
 * GET  /api/models -> the combined registry as catalog rows ONLY:
 *      {key,label,source} for operator rows, plus {status,hasKey?,
 *      keyLast4?} for user rows. Endpoint fields, model ids and key
 *      VALUES never ship (catalog privacy rule - locked by I-8b/I-9 and the
 *      sentinel battery in src/routes/api/model-manager.test.js). All
 *      listing and mutation logic lives in $lib/server/modelStore.js;
 *      this route stays a thin delegate.
 *
 * POST /api/models -> create a user row (name supplied by the caller or
 *      generated; operator-key clash = 403, user-key clash = 409, bad
 *      shape = 400 with a generic code - nothing user-typed is echoed).
 *
 * Fail-closed posture (unchanged): any malformed registry file -> GET
 * 500s {error:'model_registry_invalid'}; selections 400.
 */
import { json } from '@sveltejs/kit';
import { registrySummary, createUserRow } from '$lib/server/modelStore.js';

const NO_STORE = { 'cache-control': 'no-store' };

export function GET() {
	const { models, invalid } = registrySummary();
	if (invalid) {
		return json({ error: 'model_registry_invalid' }, { status: 500, headers: NO_STORE });
	}
	return json(models, { headers: NO_STORE });
}

export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid_model_config' }, { status: 400, headers: NO_STORE });
	}
	const out = createUserRow(body);
	return json(out.body, { status: out.status, headers: NO_STORE });
}
