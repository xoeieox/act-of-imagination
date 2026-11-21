/**
 * Server-only model registry facade (aoi-model-selector-v0, 2026-11-21;
 * upgraded to the file-backed store by aoi-model-manager-v0 the same day,
 * Erah-ratified design).
 *
 * The registry itself now lives in ./modelStore.js: an operator FILE
 * (~/.config/aoi/operator-models.json, agent/user-editable) plus a
 * user-managed file written only through the API, with AOI_MODELS_JSON
 * kept as a DEPRECATED fallback read only when the operator file is
 * absent. This module keeps the PR #9 import surface stable for the three
 * API routes and the PR #9 tests:
 *
 *   - parseRegistry       - deprecated env-registry parser (re-exported)
 *   - registrySummary     - Kyma catalog rule listing (re-exported)
 *   - resolveModelSelection - request-time resolution against the
 *     COMBINED registry (operator + user rows); unknown key / malformed
 *     store / wrong-typed selection = generic 400, never a silent
 *     fallback, and error bodies never echo registry content.
 *
 * Entry values (endpoint fields / keys) stay inside src/lib/server/**;
 * clients only ever see the summary's {key,label,source,status,hasKey,
 * keyLast4} catalog (invariants I-6a/I-8a/I-8b/I-9 keep it mechanical).
 */
import { resolveCombinedSelection } from './modelStore.js';

export { parseRegistry, registrySummary } from './modelStore.js';

/**
 * Resolve a request's modelKey against the COMBINED registry,
 * server-side, before any outbound fetch. Returns exactly one of:
 *   { entry: null }                        - no selection: lane env wins
 *   { entry: {...} }                       - validated override for this request
 *   { error: { status: 400, body } }       - unknown key / malformed
 *                                            registry / non-string
 *                                            selection: fail closed,
 *                                            never a silent fallback to
 *                                            the lane path.
 * Error bodies are fixed strings - they never echo the key or store.
 */
export function resolveModelSelection(modelKey, { env = process.env } = {}) {
	return resolveCombinedSelection(modelKey, { env });
}
