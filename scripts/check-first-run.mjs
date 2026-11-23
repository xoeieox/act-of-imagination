#!/usr/bin/env node
/**
 * Honest-first-run boot check.
 *
 * Bounded, foreground-only: boots the BUILT app (adapter output via the
 * SvelteKit server entry) with the AOI_LLM_* environment stripped, fetches
 * "/" exactly once, asserts the "configure a lane" state is present in the
 * SERVER-RENDERED HTML (no API fetch needed to reach it - F-3), checks the
 * three API routes answer the 501 machine-readable shape, then exits.
 *
 * Run after `npm run build`:  node scripts/check-first-run.mjs
 * Not part of `npm run ci` (needs the build output); CI runs it as its own
 * step. Exits non-zero with a reason on any violation.
 */
import { spawn } from 'node:child_process';

const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;

// strip every lane var from the child env (fresh-clone, zero .env)
const env = { ...process.env };
for (const k of Object.keys(env)) {
	if (k.startsWith('AOI_LLM_')) delete env[k];
}
delete env.VITE_SUPABASE_URL;
delete env.VITE_SUPABASE_ANON_KEY;

// `vite preview` boots the built app through SvelteKit's own SSR server -
// the same render path a deployed adapter runs for the first request.
const child = spawn(
	'node',
	['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
	{
		env: { ...env, NODE_ENV: 'production' },
		stdio: ['ignore', 'pipe', 'pipe']
	}
);

const fail = (msg) => {
	console.error(`FAIL  ${msg}`);
	child.kill('SIGKILL');
	process.exit(1);
};

// keep both pipes draining so the child never blocks on output
child.stdout.on('data', () => {});
child.stderr.on('data', (d) => {
	const s = String(d);
	if (!/InNodeAdapter|adapter|warn/i.test(s)) console.error('[server]', s.trim());
});

// Readiness by polling, not by parsing vite's boot banner: under CI=true the
// preview CLI suppresses the banner (GitHub Actions sets CI=true; the first
// public CI run failed on the old line-match), so only the server actually
// answering is a trustworthy signal that it came up.
async function waitUntilUp(deadlineMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < deadlineMs) {
		try {
			const r = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) });
			if (r.ok) return;
		} catch {
			/* not up yet */
		}
		await new Promise((res) => setTimeout(res, 500));
	}
	fail(`built preview server never answered GET / within ${deadlineMs / 1000}s`);
}

async function checks() {
	// 1. the shell HTML surfaces the configure-a-lane state server-side
	const res = await fetch(`${BASE}/`);
	if (!res.ok) fail(`GET / returned ${res.status} - the zero-env shell must load`);
	const html = await res.text();
	if (!html.includes('Configure a lane')) {
		fail('initial HTML lacks the "Configure a lane" state (F-3 violated)');
	}
	if (!html.includes('AOI_LLM_BASE_URL')) {
		fail('initial HTML lacks the env-var hint naming the lane table');
	}
	// the state is structural, not an error payload discovered later
	if (/llm_lane_unconfigured/.test(html)) {
		fail('shell HTML carries the API error shape instead of the structural state');
	}
	console.log('PASS  DoD9 server-rendered configure-a-lane state in initial HTML');

	// 2. the three routes still answer the fail-closed 501 machine-readable shape
	const bodies = {
		'/api/chat': { messages: [{ role: 'user', content: 'hello' }], cards: [] },
		'/api/arrange': {
			cards: [
				{ name: 'A', essence: 'a' },
				{ name: 'B', essence: 'b' }
			],
			context: 'meeting'
		},
		'/api/synopsis': { cards: [{ name: 'A' }], context: { label: 'x' }, narrative: 'n' }
	};
	for (const [route, body] of Object.entries(bodies)) {
		const r = await fetch(BASE + route, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (r.status !== 501) fail(`${route} returned ${r.status}, expected 501`);
		const j = await r.json();
		if (j.error !== 'llm_lane_unconfigured' || !String(j.hint).includes('AOI_LLM_')) {
			fail(`${route} 501 body is not the machine-readable shape (I-2)`);
		}
	}
	console.log('PASS  DoD9 all three API routes answer the 501 fail-closed shape');

	console.log(
		'check-first-run: honest first run verified (no demo surface, no crash, no silent cloud fallback)'
	);
	clearTimeout(timer);
	child.kill('SIGKILL');
	process.exit(0);
}

const timer = setTimeout(
	() => fail('hard timeout: honest first run did not finish within 60s'),
	60000
);

waitUntilUp(20000)
	.catch((e) => fail(String(e && e.stack ? e.stack : e)))
	.then(checks)
	.catch((e) => fail(String(e && e.stack ? e.stack : e)));
