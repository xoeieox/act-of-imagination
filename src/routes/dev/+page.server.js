/**
 * Dev test-data panel gate (aoi-dev-panel-flag, 2026-11-21).
 *
 * Fail-closed with an explicit operator runtime opt-in:
 *   - `dev` (vite dev-mode) - unchanged from the original build-time gate.
 *   - AOI_DEV_PANEL=1 - runtime opt-in for trusted local/tailnet instances
 *     (documented in .env.example / README). Read from process.env at
 *     request time on the server only, so operators flip it in the
 *     service env file and restart - no rebuild. Any other value
 *     (unset, empty, '0', 'true', ...) keeps the 404 posture.
 *
 * Public/default behavior is exactly the old one: no flag, no access.
 * This ships no demo surface to anyone who did not explicitly enable it
 * (OD-6: no demo mode - this is operator config, not a public surface).
 */
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export function load() {
	// Block access unless this is a dev build or the operator opted in.
	if (!dev && process.env.AOI_DEV_PANEL !== '1') {
		throw error(404, 'Not found');
	}

	return {};
}
