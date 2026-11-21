/**
 * Model registry tests (aoi-model-selector-v0, 2026-11-21).
 *
 * The server-side contract for the runtime model selector:
 *   - parseRegistry: unset/empty -> hidden (empty, NOT invalid); malformed
 *     JSON / non-array / invalid entries / duplicate keys -> invalid
 *     (fail closed: /api/models 500s and selections 400 - decision
 *     recorded in the landing report).
 *   - registrySummary: the Kyma catalog rule - {key,label} only, sentinel
 *     base url / model id / key values must never appear.
 *   - resolveModelSelection: absent -> lane path unchanged; unknown key /
 *     malformed registry / wrong-typed selection -> 400, never a silent
 *     fallback.
 * Zero network; env injected explicitly (no process.env mutation here).
 */
import { describe, it, expect } from 'vitest';
import { parseRegistry, registrySummary, resolveModelSelection } from './modelRegistry.js';

const ENTRY = {
	key: 'lane-chat',
	label: 'Lane default (chat)',
	baseUrl: 'https://registry-sentinel.invalid/v1/',
	model: 'model-id-sentinel',
	apiKey: 'key-sentinel-value',
	maxTokens: 4096
};

const REG_ENV = { AOI_MODELS_JSON: JSON.stringify([ENTRY]) };

describe('parseRegistry', () => {
	it('unset / empty / whitespace -> hidden (empty registry, not invalid)', () => {
		expect(parseRegistry({ env: {} })).toEqual({ entries: [], invalid: false });
		expect(parseRegistry({ env: { AOI_MODELS_JSON: '   ' } })).toEqual({
			entries: [],
			invalid: false
		});
	});

	it('empty array -> hidden', () => {
		expect(parseRegistry({ env: { AOI_MODELS_JSON: '[]' } })).toEqual({
			entries: [],
			invalid: false
		});
	});

	it('valid registry parses + normalizes (trailing slash stripped, trimmed strings)', () => {
		const env = {
			AOI_MODELS_JSON: JSON.stringify([
				{ ...ENTRY, key: ' lane-chat ', baseUrl: 'https://registry-sentinel.invalid/v1//' }
			])
		};
		const { entries, invalid } = parseRegistry({ env });
		expect(invalid).toBe(false);
		expect(entries).toHaveLength(1);
		expect(entries[0].key).toBe('lane-chat');
		expect(entries[0].baseUrl).toBe('https://registry-sentinel.invalid/v1');
		expect(entries[0].apiKey).toBe('key-sentinel-value');
		expect(entries[0].maxTokens).toBe(4096);
	});

	it('apiKey/maxTokens optional; numeric-string maxTokens accepted', () => {
		const { entries, invalid } = parseRegistry({
			env: {
				AOI_MODELS_JSON: JSON.stringify([
					{
						key: 'local',
						label: 'Local',
						baseUrl: 'http://127.0.0.1:9999/v1',
						model: 'm',
						maxTokens: '2048'
					}
				])
			}
		});
		expect(invalid).toBe(false);
		expect(entries[0].apiKey).toBe(null);
		expect(entries[0].maxTokens).toBe(2048);
	});

	it('malformed JSON -> invalid', () => {
		expect(parseRegistry({ env: { AOI_MODELS_JSON: '{not json' } }).invalid).toBe(true);
	});

	it('valid JSON but not an array -> invalid', () => {
		expect(parseRegistry({ env: { AOI_MODELS_JSON: '{"key":"k"}' } }).invalid).toBe(true);
	});

	it('entry missing required fields -> invalid', () => {
		const bad = { key: 'x', label: 'X' }; // no baseUrl/model
		expect(parseRegistry({ env: { AOI_MODELS_JSON: JSON.stringify([bad]) } }).invalid).toBe(true);
	});

	it('non-http(s) baseUrl -> invalid (no baked defaults, no exotic schemes)', () => {
		const bad = { ...ENTRY, baseUrl: 'file:///etc' };
		expect(parseRegistry({ env: { AOI_MODELS_JSON: JSON.stringify([bad]) } }).invalid).toBe(true);
	});

	it('duplicate keys -> invalid', () => {
		const dup = { AOI_MODELS_JSON: JSON.stringify([ENTRY, ENTRY]) };
		expect(parseRegistry({ env: dup }).invalid).toBe(true);
	});
});

describe('registrySummary - the Kyma catalog rule', () => {
	it('ships {key,label} ONLY - sentinel values never appear', () => {
		const { models, invalid } = registrySummary({ env: REG_ENV });
		expect(invalid).toBe(false);
		expect(models).toEqual([{ key: 'lane-chat', label: 'Lane default (chat)' }]);
		const text = JSON.stringify(models);
		expect(text).not.toContain('registry-sentinel.invalid');
		expect(text).not.toContain('model-id-sentinel');
		expect(text).not.toContain('key-sentinel-value');
		expect(Object.keys(models[0]).sort()).toEqual(['key', 'label']);
	});

	it('invalid registry surfaces the invalid flag with no entries', () => {
		expect(registrySummary({ env: { AOI_MODELS_JSON: '[' } })).toEqual({
			models: [],
			invalid: true
		});
	});
});

describe('resolveModelSelection', () => {
	it('absent selection -> {entry:null} (lane env path unchanged)', () => {
		expect(resolveModelSelection(undefined, { env: REG_ENV })).toEqual({ entry: null });
		expect(resolveModelSelection(null, { env: REG_ENV })).toEqual({ entry: null });
	});

	it('valid key -> the resolved entry (baseUrl/model ride it, server-side only)', () => {
		const res = resolveModelSelection('lane-chat', { env: REG_ENV });
		expect(res.error).toBeUndefined();
		expect(res.entry.model).toBe('model-id-sentinel');
		expect(res.entry.baseUrl).toBe('https://registry-sentinel.invalid/v1');
	});

	it('unknown key -> 400 unknown_model_key (never silently falls back)', () => {
		expect(resolveModelSelection('ghost-model', { env: REG_ENV })).toEqual({
			error: { status: 400, body: { error: 'unknown_model_key' } }
		});
	});

	it('wrong-typed selection -> 400 unknown_model_key', () => {
		for (const bad of [{ key: 'lane-chat' }, 42, true, '']) {
			expect(resolveModelSelection(bad, { env: REG_ENV }).error.status).toBe(400);
		}
	});

	it('malformed registry + selection -> 400 model_registry_invalid (fail closed)', () => {
		expect(resolveModelSelection('lane-chat', { env: { AOI_MODELS_JSON: '{oops' } })).toEqual({
			error: { status: 400, body: { error: 'model_registry_invalid' } }
		});
	});

	it('malformed registry WITHOUT selection -> lane path stays open (selector hidden)', () => {
		// The client hides the selector when /api/models 500s; requests that
		// never name a modelKey must keep the byte-identical lane posture.
		expect(resolveModelSelection(undefined, { env: { AOI_MODELS_JSON: '{oops' } })).toEqual({
			entry: null
		});
	});
});
