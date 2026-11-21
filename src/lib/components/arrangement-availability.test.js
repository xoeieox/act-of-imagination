/**
 * Arrangement availability (Erah ruling 2026-11-21).
 *
 * "Normal use should have it be available without conditions and explains
 * that you need a certain amount of cards for use."
 *
 * Two halves pinned here:
 *  1. ENTRY IS UNCONDITIONAL. With 0, 1, 2 or more surfaced cards the
 *     WelcomeScreen arrangement entry is rendered, the hamburger carries the
 *     arrangement item, and neither source keeps a `cardCount >= 3` lock.
 *     The old "surface N more to unlock" line survives only as an
 *     explanation, never as a door that hides the screen.
 *  2. GENERATING KEEPS A THREE-PLACED FLOOR AND EXPLAINS IT. Below the
 *     threshold the Generate button is disabled and the screen renders the
 *     calm explanation (placed count, surfaced count, next step); empty
 *     slots stay arrangeable. The enable path is pinned at the binding
 *     source: `canGenerate` (>= MIN_PLACED_TO_GENERATE = 3) is what gates
 *     the button and the generateInteraction guard.
 *
 * SSR via svelte/server, matching the honest-first-run structural-test
 * style: slots state exists only client-side, so the under-threshold render
 * is the 0-placed view (correct disabled state) and the 3-placed enable path
 * is pinned through the source binding plus the pure threshold.
 */
import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WelcomeScreen from './WelcomeScreen.svelte';
import ArrangementPlay from './ArrangementPlay.svelte';
import { session } from '$lib/stores/session.js';
import { canGenerate, MIN_PLACED_TO_GENERATE } from '$lib/arrangements.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(path.join(here, f), 'utf8');

function seedSurfaced(n) {
	session.reset();
	for (let i = 0; i < n; i++) {
		session.addCard({
			id: `availability-card-${i}`,
			name: `Card ${i}`,
			essence: `essence ${i}`,
			hint: 'a shape',
			type: 'theme',
			formationState: 'surfaced',
			depth: 1,
			createdAt: Date.now()
		});
	}
}

describe('arrangement entry is unconditional (ruling 2026-11-21)', () => {
	for (const n of [0, 1, 2, 3, 5]) {
		it(`WelcomeScreen shows the arrangement entry with ${n} surfaced cards`, () => {
			seedSurfaced(n);
			const { body } = render(WelcomeScreen, { props: {} });
			expect(body).toContain('Arrange existing cards');
		});
	}

	it('welcome screen source keeps no card-count lock on the door', () => {
		expect(src('WelcomeScreen.svelte')).not.toMatch(/cardCount\s*>=\s*3/);
	});

	it('the under-three hint explains instead of locking', () => {
		seedSurfaced(1);
		const { body } = render(WelcomeScreen, { props: {} });
		expect(body).toContain('An arrangement places three cards together.');
		expect(body).not.toMatch(/unlock/i);
	});

	it('zero-card hint says the table is open', () => {
		seedSurfaced(0);
		const { body } = render(WelcomeScreen, { props: {} });
		expect(body).toContain('The arrangement table is open');
	});

	it('hamburger arrangement entry is present and ungated', () => {
		seedSurfaced(0);
		const s = src('HamburgerMenu.svelte');
		expect(s).toContain("handleNavigate('arrangement')");
		expect(s).not.toMatch(/\{#if\s+cardCount\s*>=\s*3\s*\}/);
	});
});

describe('generating keeps a three-placed floor and explains it', () => {
	it('the threshold is three placed cards', () => {
		expect(MIN_PLACED_TO_GENERATE).toBe(3);
		for (const n of [0, 1, 2]) expect(canGenerate(n)).toBe(false);
		expect(canGenerate(3)).toBe(true);
		expect(canGenerate(4)).toBe(true);
	});

	it('under threshold: generate disabled, explanation rendered, no crash', () => {
		for (const n of [0, 1, 2]) {
			seedSurfaced(n);
			const { body } = render(ArrangementPlay, { props: {} });
			// SSR slots are always empty (placement is client-side), which is
			// exactly the under-threshold view: disabled + spoken requirement.
			expect(body).toMatch(/<button disabled/);
			expect(body).toContain('Three placed cards weave the interaction');
			expect(body).toContain('0 of 3 placed');
			expect(body).toContain(`${n} surfaced`);
		}
	});

	it('the next step is spoken according to deck depth', () => {
		seedSurfaced(1);
		expect(render(ArrangementPlay, { props: {} }).body).toContain(
			'Return to the conversation and more cards will surface'
		);
		seedSurfaced(4);
		expect(render(ArrangementPlay, { props: {} }).body).toContain(
			'Place the cards you surfaced into the slots above'
		);
	});

	it('the enable path is the canGenerate binding at three placed', () => {
		const s = src('ArrangementPlay.svelte');
		expect(s).toContain('if (!canGenerate(filledCount) || !selectedContext) return;');
		expect(s).toContain('disabled={!canGenerate(filledCount) || isGenerating}');
	});

	it('empty slots stay arrangeable at zero cards', () => {
		seedSurfaced(0);
		const { body } = render(ArrangementPlay, { props: {} });
		expect((body.match(/aria-label="Card slot/g) || []).length).toBe(3);
	});
});
