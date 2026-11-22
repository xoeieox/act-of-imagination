#!/usr/bin/env node
/**
 * Secret-scrub gate (I-4).
 *
 *  A. Tracked .env family: exactly one allowed member, `.env.example`.
 *     Real credential files stay untracked on operator machines; a tracked
 *     `.env*` other than the example fails the gate at PR head, so
 *     regression is impossible (CI step, I-4).
 *  B. Key-shaped strings over tracked text content:
 *       - `sk-[A-Za-z0-9]{4,}` with no alphanumeric or `-` before `sk`
 *       - `Bearer <20+ alnum chars>`
 *     The lookaround guards stop package-name false positives
 *     (e.g. `queue-microtask-1.2.3` contains `sk-1`).
 *     package-lock.json is excluded: it is machine-generated registry mirror
 *     data (URLs + integrity hashes), carries no committed secrets by design,
 *     and false-positives on package names (proven live: queue-microtask).
 *     Human-authored tracked content is what this gate guards.
 *
 * Zero dependencies; runs the same in CI and in a fixer session.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
	.split('\0')
	.filter(Boolean);

const failures = [];

// ---- A: tracked .env family ----
const trackedEnv = files.filter((f) => path.basename(f).startsWith('.env'));
const disallowedEnv = trackedEnv.filter((f) => f !== '.env.example');
if (!trackedEnv.includes('.env.example')) {
	failures.push(
		'I-4 .env.example is missing from tracked files (it is the documented config surface)'
	);
}
if (disallowedEnv.length > 0) {
	failures.push(`I-4 tracked .env file(s) beyond .env.example: ${disallowedEnv.join(', ')}`);
} else if (trackedEnv.includes('.env.example')) {
	console.log('PASS  I-4 tracked .env family = .env.example only');
}

// ---- B: key-shaped grep ----
const SK_RE = /(^|[^A-Za-z0-9-])sk-[A-Za-z0-9]{4,}/;
const BEARER_RE = /Bearer [A-Za-z0-9]{20,}/;
const keyHits = [];
let scanned = 0;
for (const f of files) {
	if (f === 'package-lock.json') continue;
	let text;
	try {
		text = readFileSync(path.join(ROOT, f), 'utf8');
	} catch {
		continue; // unreadable; text-shape grep applies to text content
	}
	if (text.includes('\0')) continue; // binary
	scanned += 1;
	if (SK_RE.test(text)) keyHits.push(`${f}: sk- shaped string`);
	if (BEARER_RE.test(text)) keyHits.push(`${f}: Bearer-shaped string`);
}
if (keyHits.length > 0) {
	failures.push(`I-4 key-shaped strings in tracked content: ${keyHits.join('; ')}`);
} else {
	console.log(
		`PASS  I-4 key-shape grep clean (sk-… / Bearer …) over ${scanned} tracked text files (package-lock.json excluded: generated mirror data)`
	);
}

if (failures.length > 0) {
	for (const f of failures) console.error(`FAIL  ${f}`);
	process.exit(1);
}
console.log('check-secrets: all checks green');
