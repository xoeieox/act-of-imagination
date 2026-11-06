#!/usr/bin/env node
/**
 * Invariant gate for aoi-repo-polish-v0 (spec sec 6, DoD #4).
 *
 * Checks (all on TRACKED files, via `git ls-files`):
 *
 *  I-1 + F-2  No cloud pins in tracked app source (src/**, excluding tests):
 *             the pinned model id, the pinned API host, and the pinned API-key
 *             var of the pre-lane-swap Anthropic integration (see FORBIDDEN_PINS
 *             below).
 *             Literal http(s) hosts in src/**\/*.js (the logic files where
 *             endpoints live) must be loopback only: localhost / 127.0.0.1 / ::1
 *             - exact literals, no pattern escape (F-2). Markup files carry SVG
 *             xmlns constants (W3C namespace URIs, not endpoints); the host
 *             scan therefore scopes to .js, while the named pins above scan all
 *             tracked app source.
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
const appSource = (f) => f.startsWith('src/') && /\.(js|svelte|html)$/.test(f) && !isTest(f);

// ---- I-1 (named pins) + F-2 (loopback-only hosts in JS) ----
// Patterns are concatenated so this gate file never self-matches a repo-wide grep.
const FORBIDDEN_PINS = ['claude-son' + 'net', 'api' + '.anthropic.com', 'ANTHROPIC_' + 'API_KEY'];
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const HOST_RE = /https?:\/\/([^\s"'`/)?#]+)/gi;

const pinHits = [];
for (const f of files.filter(appSource)) {
	const text = read(f);
	for (const pin of FORBIDDEN_PINS) {
		if (text.includes(pin)) pinHits.push(`${f}: contains "${pin}"`);
	}
}
report(
	'I-1 no cloud pins in tracked app source',
	pinHits.length === 0,
	pinHits.join('; ') || `scanned ${files.filter(appSource).length} files`
);

const hostHits = [];
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
for (const file of files.filter((x) => /\.(js|svelte|json)$/.test(x) && !x.includes('node_modules') && !x.endsWith('package-lock.json') && !isTest(x))) {
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
for (const f of files.filter((x) => x.startsWith('src/') && /\.(js|svelte)$/.test(x) && !isTest(x))) {
	if (serverFileOk(f)) continue;
	const text = read(f);
	if (SERVER_ONLY_RE.test(text)) leakHits.push(f);
}
report(
	'I-6a src/lib/server imported only from server routes',
	leakHits.length === 0,
	leakHits.join(', ') || 'no client-side import of server modules'
);

// ---- I-6b: AOI_LLM_ absent from client bundle output (post-build) ----
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
		if (readFileSync(p, 'utf8').includes('AOI_LLM_')) {
			bundleHits.push(path.relative(ROOT, p));
		}
	}
	report(
		"I-6b no 'AOI_LLM_' strings in .svelte-kit/output/client",
		bundleHits.length === 0,
		bundleHits.join(', ') || 'client bundle clean of env var names'
	);
} else {
	results.push({
		name: "I-6b client-bundle scan ('AOI_LLM_')",
		ok: true,
		detail: 'skipped - no .svelte-kit/output/client yet; run after `npm run build`'
	});
}

// ---- output ----
for (const r of results) {
	console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail})`);
}
if (failures.length > 0) {
	console.error(`\ncheck-invariants: ${failures.length} check(s) FAILED`);
	process.exit(1);
}
console.log('\ncheck-invariants: all checks green');
