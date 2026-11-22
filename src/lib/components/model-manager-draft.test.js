/**
 * Draft save after a failed connection test (fixed 2026-11-21).
 *
 * Repro: fill the add-model form with an endpoint that fails
 * the probe, click Test, then 'Save as draft' - the only live button
 * was Cancel. Root cause was the component gate `canSaveDraft =
 * $derived(formValid && verdict === null)`: running any test sets a
 * verdict, so a FAILED test disabled the draft path the exact moment
 * it mattered (the file header always promised it "stays open").
 *
 * SSR via svelte/server, matching the structural-test style of
 * arrangement-availability.test.js: the list view is pinned by render,
 * the post-test button states exist only client-side, so the fix is
 * pinned at the binding source - the draft gate reads form validity
 * ONLY and can never name the verdict again, while the healthy gate
 * keeps requiring a passing verdict and Cancel stays ungated.
 */
import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ModelManager from './ModelManager.svelte';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(path.join(here, f), 'utf8');

describe('model manager draft path (draft-save fix 2026-11-21)', () => {
	it('list view renders with the add entry (no crash SSR-side)', () => {
		const { body } = render(ModelManager, { props: {} });
		expect(body).toContain('Operator models');
		expect(body).toContain('Your models');
		expect(body).toContain('+ Add model');
	});

	it('draft save is gated on form validity only - the verdict never appears in its gate', () => {
		const s = src('ModelManager.svelte');
		expect(s).toContain('const canSaveDraft = $derived(formValid);');
		expect(s).not.toMatch(/canSaveDraft\s*=\s*\$derived\([^)]*verdict/);
		// the disabled binding on the button is the derived, verbatim
		expect(s).toContain('id="aoi-mm-save-draft"');
		expect(s).toContain('disabled={!canSaveDraft}');
	});

	it('save-as-healthy still requires a passing verdict; Cancel is never gated', () => {
		const s = src('ModelManager.svelte');
		expect(s).toContain(
			'const canSaveHealthy = $derived(formValid && verdict !== null && verdict.ok === true);'
		);
		expect(s).toContain('disabled={!canSaveHealthy}');
		// no disabled attribute may ever sit on the cancel button
		expect(s).not.toMatch(/id="aoi-mm-cancel"[^>]*disabled/);
	});
});
