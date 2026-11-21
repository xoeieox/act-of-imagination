/**
 * Model catalog endpoint (aoi-model-selector-v0, 2026-11-21).
 *
 * GET /api/models -> the operator registry as [{key,label}] ONLY: no
 * keys, no model-id strings, no base urls (Kyma catalog rule - the
 * registry may carry live credentials, so the catalog endpoint ships
 * neither keys nor baked model ids, locked by
 * src/routes/api/models.test.js and check-invariants I-6b/I-9).
 *
 * Fail-closed posture:
 *   - registry unset/empty      -> 200 [] (selector stays hidden, lane
 *                                  env defaults keep their exact posture)
 *   - registry malformed        -> 500 {error:'model_registry_invalid'}
 *                                  (generic; registry content is never echoed)
 */
import { json } from '@sveltejs/kit';
import { registrySummary } from '$lib/server/modelRegistry.js';

export function GET() {
	const { models, invalid } = registrySummary();
	if (invalid) {
		return json(
			{ error: 'model_registry_invalid' },
			{ status: 500, headers: { 'cache-control': 'no-store' } }
		);
	}
	return json(models, { headers: { 'cache-control': 'no-store' } });
}
