/**
 * User-row edit/delete endpoint (aoi-model-manager-v0, 2026-11-21).
 *
 * PATCH  /api/models/{key} - update a USER row (blank/absent fields
 *          preserve the stored value; an explicit empty api-key field
 *          clears the stored key).
 * DELETE /api/models/{key} - remove a USER row.
 *
 * OPERATOR rows are managed by file, never through the API: an operator
 * key answers 403 {error:'operator_model_readonly'} with a clear hint;
 * an unknown key answers 404. All logic lives in
 * $lib/server/modelStore.js; this route is a thin delegate.
 */
import { json } from '@sveltejs/kit';
import { updateUserRow, deleteUserRow } from '$lib/server/modelStore.js';

const NO_STORE = { 'cache-control': 'no-store' };

export async function PATCH({ params, request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid_model_config' }, { status: 400, headers: NO_STORE });
	}
	const out = updateUserRow(params.key, body);
	return json(out.body, { status: out.status, headers: NO_STORE });
}

export function DELETE({ params }) {
	const out = deleteUserRow(params.key);
	return json(out.body, { status: out.status, headers: NO_STORE });
}
