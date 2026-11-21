/**
 * Model selector client tests (aoi-model-selector-v0, 2026-11-21).
 *
 * Pure-helper behavior (sanitize/degrade) plus a structural SSR-lock of
 * the selector visibility gate in the repo's no-jsdom idiom (the
 * arrangement-availability.test.js pattern: read the component source,
 * lock the template shape).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODEL_STORAGE_KEY, sanitizeModelCatalog, resolveStoredKey } from './model-selection.js';

describe('sanitizeModelCatalog', () => {
	it('keeps only {key,label} string pairs, drops garbage and extras', () => {
		const raw = [
			{ key: 'a', label: 'A', apiKey: 'sk-nope', baseUrl: 'https://sneak.invalid' },
			{ key: 'b', label: ' B ' },
			{ key: 'c' },
			{ label: 'no key' },
			{ key: '', label: 'blank' },
			{ key: 'a', label: 'dup' },
			'nope',
			null
		];
		expect(sanitizeModelCatalog(raw)).toEqual([
			{ key: 'a', label: 'A' },
			{ key: 'b', label: 'B' }
		]);
	});

	it('non-array input -> []', () => {
		expect(sanitizeModelCatalog(undefined)).toEqual([]);
		expect(sanitizeModelCatalog({ key: 'a', label: 'A' })).toEqual([]);
	});
});

describe('resolveStoredKey', () => {
	const catalog = [
		{ key: 'a', label: 'A' },
		{ key: 'b', label: 'B' }
	];

	it('valid stored key is kept', () => {
		expect(resolveStoredKey('b', catalog)).toBe('b');
	});

	it('stale key (entry removed from the registry) degrades to null silently', () => {
		expect(resolveStoredKey('gone', catalog)).toBe(null);
	});

	it('wrong-typed stored values degrade to null', () => {
		expect(resolveStoredKey(undefined, catalog)).toBe(null);
		expect(resolveStoredKey(42, catalog)).toBe(null);
		expect(resolveStoredKey('', catalog)).toBe(null);
		expect(resolveStoredKey('a', null)).toBe(null);
	});
});

describe('storage key', () => {
	it('is versioned per the repo idiom (aoi-session-v2 / aoi-theme-v1)', () => {
		expect(MODEL_STORAGE_KEY).toBe('aoi-model-v1');
	});
});

describe('ModelSelector.svelte - structural SSR lock (hidden when registry empty)', () => {
	const source = readFileSync(
		new URL('./components/ModelSelector.svelte', import.meta.url),
		'utf8'
	);

	it('renders nothing unless the catalog is non-empty', () => {
		expect(source).toContain('{#if $modelStore.catalog.length > 0}');
	});

	it('is fed by /api/models and persists via the store only', () => {
		// The component talks to the world through the store; the store is
		// the only place /api/models and the storage key are touched.
		expect(source).not.toContain('/api/models');
		expect(source).not.toContain('localStorage');
		const storeSource = readFileSync(new URL('./stores/model.js', import.meta.url), 'utf8');
		expect(storeSource).toContain('/api/models');
	});

	it('never renders anything but labels (catalog rule at the template level)', () => {
		expect(source).toContain('{model.label}');
		expect(source).not.toContain('model.baseUrl');
		expect(source).not.toContain('model.apiKey');
		expect(source).not.toContain('model.model');
	});
});
