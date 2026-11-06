/**
 * Honest first run (aoi-repo-polish-v0 leg 2, sec 5.6 / F-3).
 *
 * The app shell's server load resolves the env lanes and exposes their
 * configuration state STRUCTURALLY - a zero-.env boot renders the
 * "configure a lane" state in the initial HTML, with no API fetch and no
 * error path to discover. The hint string (env-var names) is computed
 * server-side and arrives as data, so AOI_LLM_* never enters the client
 * bundle (I-6): the page markup only carries the serialized value.
 *
 * The three API routes keep their own fail-closed 501 + machine-readable
 * hint (I-2) for anything that still reaches them.
 */
import { resolveLane, laneConfigHint } from '$lib/server/lane.js';

export function load() {
	const missing = ['chat', 'arrange', 'synopsis'].filter((lane) => resolveLane(lane) === null);
	return {
		lanesConfigured: missing.length === 0,
		missingLanes: missing,
		// null when fully configured; a short operator-readable hint otherwise
		laneHint: missing.length > 0 ? laneConfigHint(missing[0]) : null
	};
}
