import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { newId } from '$lib/uuid.js';

/**
 * Arrangements store - persists witnessed arrangements with reflections
 *
 * Implements the design's Arrangement data shape
 * (Act-of-Imagination-Design.md :300-306):
 *   { id, slots: Card[], context, generatedNarrative, createdAt,
 *     reflections: string[] }  // user's notes on what they saw
 *
 * Local-first, same pattern as the assemblies service: localStorage for
 * everyone; no server round-trip. Reflections are usable later - the
 * arrangement (with its reflections) survives reloads and can be read back
 * by id.
 */

const LOCAL_STORAGE_KEY = 'act-of-imagination-arrangements';

/**
 * Design ruling (2026-11-21): the arrangement screen is open
 * unconditionally - entries carry no card-count lock. Only GENERATING has a
 * floor: this many cards must be placed in the slots, and the UI explains
 * that in calm words rather than hiding the door.
 */
export const MIN_PLACED_TO_GENERATE = 3;

export function canGenerate(filledCount) {
	return filledCount >= MIN_PLACED_TO_GENERATE;
}

function createArrangementsStore() {
	const { subscribe, set, update } = writable({
		arrangements: [],
		loaded: false
	});

	function persist(arrangements) {
		if (browser) {
			try {
				localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(arrangements));
			} catch (e) {
				if (e?.name === 'QuotaExceededError') {
					console.error('Arrangements: localStorage quota exceeded; not saved.');
				} else {
					console.warn('Failed to persist arrangements:', e);
				}
			}
		}
	}

	return {
		subscribe,

		// Load arrangements from localStorage (idempotent)
		init() {
			if (!browser) return;
			try {
				const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
				const arrangements = stored ? JSON.parse(stored) : [];
				set({ arrangements: Array.isArray(arrangements) ? arrangements : [], loaded: true });
			} catch (e) {
				console.warn('Failed to parse stored arrangements:', e);
				set({ arrangements: [], loaded: true });
			}
		},

		// Persist a witnessed arrangement; returns the created record
		save({ slots, context, narrative }) {
			const arrangement = {
				// newId, not the direct call: the Web API random-uuid helper
				// exists only in secure contexts and is undefined on plain-http
				// origins - a bare call crashed arrangement creation (fixed
				// 2026-11-21).
				id: newId(),
				slots: (Array.isArray(slots) ? slots.slice(0, 3) : []).map((card) =>
					card && typeof card === 'object'
						? {
								id: card.id,
								name: card.name,
								essence: card.essence,
								type: card.type,
								depth: card.depth
							}
						: null
				),
				context:
					context && typeof context === 'object'
						? { id: context.id, name: context.name, label: context.label, prompt: context.prompt }
						: { name: String(context ?? '') },
				generatedNarrative: narrative || '',
				createdAt: Date.now(),
				reflections: []
			};

			update((state) => {
				const arrangements = [arrangement, ...state.arrangements];
				persist(arrangements);
				return { arrangements, loaded: true };
			});

			return arrangement;
		},

		// Append one reflection (user's note on what they saw)
		addReflection(id, text) {
			const note = String(text || '').trim();
			if (!note) return null;

			let updated = null;
			update((state) => {
				const arrangements = state.arrangements.map((a) => {
					if (a.id !== id) return a;
					updated = { ...a, reflections: [...(a.reflections || []), note] };
					return updated;
				});
				persist(arrangements);
				return { ...state, arrangements };
			});
			return updated;
		},

		// Read one arrangement back by id (usable later)
		byId(id) {
			const state = get(this);
			return state.arrangements.find((a) => a.id === id) || null;
		}
	};
}

export const arrangements = createArrangementsStore();
