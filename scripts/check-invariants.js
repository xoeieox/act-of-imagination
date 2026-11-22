#!/usr/bin/env node
/**
 * Invariant gate (CI).
 *
 * Checks (all on TRACKED files, via `git ls-files`):
 *
 *  I-1 + F-2  No cloud pins anywhere in tracked app source (src/**, test
 *             files included): the pinned model id, the pinned API host, and
 *             the pinned API-key var of the pre-lane-swap Anthropic
 *             integration (see FORBIDDEN_PINS below).
 *             Literal http(s) hosts in src/**\/*.js (the logic files where
 *             endpoints live) must be loopback only: localhost / 127.0.0.1 / ::1
 *             - exact literals, no pattern escape (F-2).
 *             Recorded deliberate deviations from the original grep
 *             carve-outs, accepted during the 2026-11-06 review cycle:
 *             - D1 (stricter than spec): spec excludes tests from the grep;
 *               the named-pin scan here does NOT, so a future test file
 *               cannot hardcode a real pin. The literal-host scan keeps the
 *               spec's test exclusion - lane tests legitimately use RFC 2606
 *               .invalid placeholder hosts.
 *             - D2 (host-scan scope only): spec's exclusion list has no
 *               markup carve-out; the host scan nevertheless excludes
 *               .svelte/.html because markup carries SVG xmlns constants
 *               (W3C namespace URIs, not endpoints). The named-pin scan
 *               still covers all tracked app source including markup.
 *  F-1        No SDK importers of the retired provider package remain anywhere
 *             in tracked source (the dependency deletion merges only with this
 *             green).
 *  I-6a       src/lib/server is imported only from server files
 *             (the +server.js / +page.server.js files under src/routes, and
 *             files under src/lib/server itself).
 *  I-6b       After a build, `AOI_LLM_` must not appear in .svelte-kit/output/client/**
 *             (skipped, with notice, when no build output is present).
 *
 * Zero dependencies: runs the same in CI (leg 2 wires it into `npm run ci`)
 * and in a fixer session.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const failures = [];
const results = [];

function report(name, ok, detail) {
	results.push({ name, ok, detail });
	if (!ok) failures.push(`${name}: ${detail}`);
}

function trackedFiles() {
	const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
	return out.split('\0').filter(Boolean);
}

const files = trackedFiles();
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

const isTest = (f) => f.endsWith('.test.js') || f.includes('__tests__/');
// Everything tracked under src/ that is code or markup. The named-pin scan
// covers this set INCLUDING test files (deliberate deviation D1 - stricter
// than the spec's grep carve-out); the literal-host scan and the I-6a leak
// scan scope to trackedSrc minus isTest, which excludes tests.
const trackedSrc = (f) => f.startsWith('src/') && /\.(js|svelte|html)$/.test(f);

// ---- I-1 (named pins) + F-2 (loopback-only hosts in JS) ----
// Patterns are concatenated so this gate file never self-matches a repo-wide grep.
const FORBIDDEN_PINS = ['claude-son' + 'net', 'api' + '.anthropic.com', 'ANTHROPIC_' + 'API_KEY'];
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const HOST_RE = /https?:\/\/([^\s"'`/)?#]+)/gi;

const pinHits = [];
for (const f of files.filter(trackedSrc)) {
	const text = read(f);
	for (const pin of FORBIDDEN_PINS) {
		if (text.includes(pin)) pinHits.push(`${f}: contains "${pin}"`);
	}
}
report(
	'I-1 no cloud pins in tracked app source (test files included, D1)',
	pinHits.length === 0,
	pinHits.join('; ') || `scanned ${files.filter(trackedSrc).length} files`
);

const hostHits = [];
// D2: scope is .js under src/, tests excluded (spec carve-out - tests use
// .invalid placeholder hosts). .svelte/.html stay out of the host scan
// because markup carries W3C xmlns URIs (namespace constants, not endpoints).
const jsSources = files.filter((f) => f.startsWith('src/') && f.endsWith('.js') && !isTest(f));
for (const f of jsSources) {
	const text = read(f);
	for (const m of text.matchAll(HOST_RE)) {
		const host = m[1].toLowerCase();
		if (!LOOPBACK_HOSTS.has(host)) hostHits.push(`${f}: literal host "${host}"`);
	}
}
report(
	'I-1/F-2 loopback-only literal hosts in src JS (whitelist: localhost, 127.0.0.1, ::1)',
	hostHits.length === 0,
	hostHits.join('; ') || `scanned ${jsSources.length} JS files`
);

// ---- F-1: no SDK importers of the retired provider package (now: none) ----
const SDK_PIN = '@' + 'anthropic-ai/sdk';
const sdkHits = [];
for (const file of files.filter(
	(x) =>
		/\.(js|svelte|json)$/.test(x) &&
		!x.includes('node_modules') &&
		!x.endsWith('package-lock.json') &&
		!isTest(x)
)) {
	const text = read(file);
	if (text.includes(SDK_PIN)) sdkHits.push(file);
}
report(
	'F-1 no provider-SDK importers in tracked source',
	sdkHits.length === 0,
	sdkHits.join(', ') || 'dependency is deletable: zero importers'
);

// ---- I-6a: $lib/server imported only from server files ----
const SERVER_ONLY_RE = /['"][^'"]*lib\/server\/[^'"]*['"]|\.\.\/server\/[^'"]*['"]/;
const serverFileOk = (f) =>
	f.startsWith('src/lib/server/') ||
	(f.startsWith('src/routes/') && /\/\+(server|page\.server)\.js$/.test(f));

const leakHits = [];
for (const f of files.filter(
	(x) => x.startsWith('src/') && /\.(js|svelte)$/.test(x) && !isTest(x)
)) {
	if (serverFileOk(f)) continue;
	const text = read(f);
	if (SERVER_ONLY_RE.test(text)) leakHits.push(f);
}
report(
	'I-6a src/lib/server imported only from server routes',
	leakHits.length === 0,
	leakHits.join(', ') || 'no client-side import of server modules'
);

// ---- I-6b: SENSITIVE_ENV_STRINGS absent from client bundle output (post-build) ----
// The token set now covers the lane env family AND
// the registry env name (AOI_MODELS_ + JSON) - neither may ever appear in
// shipped client bytes.
const SENSITIVE_ENV_STRINGS = ['AOI_' + 'LLM_', 'AOI_MODELS_' + 'JSON'];
const clientOut = path.join(ROOT, '.svelte-kit/output/client');
if (existsSync(clientOut)) {
	const walk = (dir) => {
		const out = [];
		for (const e of readdirSync(dir)) {
			const p = path.join(dir, e);
			if (statSync(p).isDirectory()) out.push(...walk(p));
			else out.push(p);
		}
		return out;
	};
	const bundleHits = [];
	for (const p of walk(clientOut)) {
		if (!/\.(js|html|json)$/.test(p)) continue;
		const text = readFileSync(p, 'utf8');
		for (const token of SENSITIVE_ENV_STRINGS) {
			if (text.includes(token)) bundleHits.push(`${path.relative(ROOT, p)}: ${token}`);
		}
	}
	report(
		`I-6b no ${SENSITIVE_ENV_STRINGS.map((t) => `'${t}'`).join('/')} strings in .svelte-kit/output/client`,
		bundleHits.length === 0,
		bundleHits.join(', ') || 'client bundle clean of env var names'
	);
} else {
	results.push({
		name: `I-6b client-bundle scan (${SENSITIVE_ENV_STRINGS.join('/')})`,
		ok: true,
		detail: 'skipped - no .svelte-kit/output/client yet; run after `npm run build`'
	});
}

// ---- I-8: model-registry invariants (2026-11-21) ----
// Catalog privacy rule, made mechanical. I-8a (browser-reachable sources may
// not even name the registry env var) runs below, after the I-7 scan set
// (i7Files) is defined. I-8b:
//  the catalog route carries only {key,label}: its source must not
//  mention the entry-only fields at all.
const catalogRouteFiles = files.filter((f) => /^src\/routes\/api\/models\/\+server\.js$/.test(f));
const catalogFieldRe = new RegExp(['ap', 'iKey', '|base', 'Url'].join(''), 'i');
const catalogHits = [];
for (const f of catalogRouteFiles) {
	if (catalogFieldRe.test(read(f))) catalogHits.push(f);
}
if (catalogRouteFiles.length === 0) catalogHits.push('models route missing');
report(
	'I-8b /api/models route source mentions neither apiKey nor baseUrl',
	catalogHits.length === 0,
	catalogHits.join(', ') || 'catalog ships {key,label} only'
);

// ---- I-7: no direct crypto.randomUUID in browser-reachable sources ----
// 2026-11-21 fix: crypto.randomUUID exists only in secure contexts;
// the app is routinely served on plain-http origins where the bare
// call is undefined and crashed arrangement creation. All client id-gen
// goes through newId() in src/lib/uuid.js.
// Browser-reachable scope per spec: src/routes/+page.svelte,
// src/lib/components/**, src/lib/*.js, src/lib/stores/**. Tests are exempt
// (same carve-out as other scans); src/lib/uuid.js is the sanctioned home.
// The regex is built from parts so this gate never self-matches (F-1 idiom).
const UUID_DIRECT_RE = new RegExp(
	['cry', 'pto\\s*(?:\\?)?\\.\\s*random', 'UUID', '|ms', 'Crypto'].join('')
);
const I7_SCOPES = [
	/^src\/routes\/\+page\.svelte$/,
	/^src\/lib\/components\//,
	/^src\/lib\/[^/]+\.js$/,
	/^src\/lib\/stores\//
];
const i7Files = files.filter(
	(f) =>
		f.startsWith('src/') &&
		!isTest(f) &&
		f !== 'src/lib/uuid.js' &&
		I7_SCOPES.some((r) => r.test(f))
);
const uuidHits = [];
for (const f of i7Files) {
	if (UUID_DIRECT_RE.test(read(f))) uuidHits.push(f);
}
report(
	'I-7 no direct crypto.randomUUID in browser-reachable sources (client id-gen via newId)',
	uuidHits.length === 0,
	uuidHits.join('; ') || `scanned ${i7Files.length} browser-reachable files`
);

// ---- I-8a: registry env name never appears in browser-reachable sources ----
// (reuses the I-7 scan set, concatenated pattern
// so this gate never self-matches - same idiom as I-7/F-1.)
const REGISTRY_ENV_RE = new RegExp(['AOI', '_MODELS_', 'JSON'].join(''));
const registryHits = [];
for (const f of i7Files) {
	if (REGISTRY_ENV_RE.test(read(f))) registryHits.push(f);
}
report(
	'I-8a browser-reachable sources never name the model registry env var',
	registryHits.length === 0,
	registryHits.join('; ') || `scanned ${i7Files.length} browser-reachable files`
);

// ---- I-8c: advanced-auth fields never named in /api/models* routes ----
// (2026-11-21): authMode / extraHeaders / userAgent are
// auth-value fields in the same family as apiKey/baseUrl (I-8b): the route
// files stay thin delegates and must not even name these fields, so no route
// can ever serialize a header or UA value. Masking lives in modelStore.js
// alone (attachMaskedAuth ships NAMES + flags only), locked by the sentinel
// battery in src/routes/api/model-advanced-auth.test.js. Concatenated pattern
// so this gate never self-matches (F-1 idiom).
const AUTH_FIELD_RE = new RegExp(['auth', 'Mode|extra', 'Headers|user', 'Agent'].join(''), 'i');
const authRouteFiles = files.filter((f) =>
	/^src\/routes\/api\/models\/(?:[^/]+\/)?\+server\.js$/.test(f)
);
const authHits = [];
for (const f of authRouteFiles) {
	if (AUTH_FIELD_RE.test(read(f))) authHits.push(f);
}
if (authRouteFiles.length < 3)
	authHits.push(`expected the 3 models routes, found ${authRouteFiles.length}`);
report(
	'I-8c /api/models* route sources never name the advanced-auth fields',
	authHits.length === 0,
	authHits.join(', ') || 'advanced auth stays inside modelStore (thin-delegate routes)'
);

// ---- output ----
for (const r of results) {
	console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail})`);
}
if (failures.length > 0) {
	console.error(`\ncheck-invariants: ${failures.length} check(s) FAILED`);
	process.exit(1);
}
console.log('\ncheck-invariants: all checks green');
