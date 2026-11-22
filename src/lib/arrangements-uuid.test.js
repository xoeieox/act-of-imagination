/**
 * Arrangement id creation must survive non-secure-context clients
 * (fixed 2026-11-21).
 *
 * Repro: on a plain-http origin, saving a witnessed arrangement threw
 * 'crypto.randomUUID is not a function ... undefined' - the Web API
 * helper exists only in secure contexts and the app is routinely served
 * over plain http. Convention (src/lib/uuid.js): every client id goes
 * through
 * newId(), which falls back to getRandomValues and only then to a
 * Math.random UUIDv4-shaped id.
 *
 * No jsdom in this repo: source-binding pins plus globalThis surgery, in
 * the SSR/source-binding idiom of the other structural tests.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrangements } from '$lib/arrangements.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(path.join(here, f), 'utf8');
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function card(i) {
	return {
		id: `uuidfix-card-${i}`,
		name: `Card ${i}`,
		essence: `essence ${i}`,
		type: 'theme',
		depth: 1
	};
}

function saveWitnessed() {
	return arrangements.save({
		slots: [card(1), card(2), card(3)],
		context: { id: 'uuidfix-ctx', name: 'Meeting', label: 'a meeting', prompt: 'p' },
		narrative: 'three shapes lean toward one another'
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('arrangement ids survive non-secure-context clients', () => {
	it('the save path is bound to newId, with no direct Web-API call', () => {
		const text = src('arrangements.js');
		expect(text).not.toMatch(/crypto\s*(?:\?)?\s*\.\s*random\s*UUID|msCrypto/);
		expect(text).toMatch(/import\s*\{\s*newId\s*\}\s*from\s*'\$lib\/uuid\.js'/);
		expect(text).toMatch(/id:\s*newId\(\)/);
	});

	it('save() mints a v4-shaped id when the Web-API helper is undefined', () => {
		// non-secure-context shape: getRandomValues present, randomUUID absent
		vi.stubGlobal('crypto', {
			getRandomValues: (bytes) => {
				for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + 11) % 256;
				return bytes;
			}
		});
		const saved = saveWitnessed();
		expect(saved.id).toMatch(V4);
	});

	it('save() mints a v4-shaped id even with no crypto at all', () => {
		vi.stubGlobal('crypto', undefined);
		const saved = saveWitnessed();
		expect(saved.id).toMatch(V4);
	});
});
