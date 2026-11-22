/**
 * Model selector store (2026-11-21).
 *
 * Client-side counterpart of the server model registry: holds the
 * [{key,label}] catalog fetched from /api/models (the only catalog data
 * that can ever reach a browser - no keys, model ids, or base urls,
 * catalog privacy rule) and the per-browser persisted selection under
 * localStorage `aoi-model-v1`.
 *
 * Posture rules (locked by src/lib/model-selection.test.js):
 *   - empty catalog (registry unset, the default) -> `models` stays [],
 *     the selector renders nothing, and every request keeps the exact
 *     lane-env posture it has today.
 *   - a stored key no longer in the catalog degrades to null (lane
 *     default) silently via resolveStoredKey.
 *   - the selection the browser sends is ALWAYS re-validated server-side
 *     before any outbound fetch; nothing here authorizes anything.
 *
 * Browser-only entry points (load()/select()) guard window/localStorage;
 * the store itself is SSR-safe to import (the +page server never
 * serializes it).
 */
import { writable } from 'svelte/store';
import { MODEL_STORAGE_KEY, sanitizeModelCatalog, resolveStoredKey } from '$lib/model-selection.js';

function createModelStore() {
	const { subscribe, update } = writable({
		/** @type {{key: string, label: string}[]} */
		catalog: [],
		/** @type {string|null} persisted selection; null = lane default */
		selected: null,
		loaded: false
	});

	/** Fetch the catalog (once per page load). Failure = hidden, quiet. */
	async function load() {
		if (typeof window === 'undefined') return;
		if (latest.loaded) return; // one catalog fetch per page life
		await loadNow();
	}

	/** Re-fetch after a manager mutation; stored pick re-validates. */
	async function refresh() {
		if (typeof window === 'undefined') return;
		await loadNow();
	}

	async function loadNow() {
		let catalog = [];
		try {
			const res = await fetch('/api/models', { headers: { accept: 'application/json' } });
			if (res.ok) catalog = sanitizeModelCatalog(await res.json());
		} catch {
			catalog = []; // unreachable endpoint = hidden; lane defaults win
		}
		let stored = null;
		try {
			stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
		} catch {
			/* storage unavailable (private mode): lane default */
		}
		// Stale stored key degrades to null here, silently, once - and the
		// stale entry is dropped so the next reload is honest.
		const selected = resolveStoredKey(stored, catalog);
		if (selected === null && typeof stored === 'string' && stored !== '') {
			try {
				window.localStorage.removeItem(MODEL_STORAGE_KEY);
			} catch {
				/* nothing else to do */
			}
		}
		update((s) => ({ ...s, catalog, selected, loaded: true }));
	}

	/** Persist the selection (null = back to lane default). */
	function select(key) {
		const selected = resolveStoredKey(key, getCatalog());
		update((s) => ({ ...s, selected }));
		try {
			if (selected === null) window.localStorage.removeItem(MODEL_STORAGE_KEY);
			else window.localStorage.setItem(MODEL_STORAGE_KEY, selected);
		} catch {
			/* storage unavailable: selection lives for this page only */
		}
	}

	/** @returns {{key: string, label: string}[]} */
	let latest = { catalog: [], selected: null, loaded: false };
	subscribe((v) => {
		latest = v;
	});
	function getCatalog() {
		return latest.catalog;
	}

	/** Body field for API requests: {} when no selection (byte-identical). */
	function requestField() {
		return latest.selected ? { modelKey: latest.selected } : {};
	}

	return { subscribe, load, refresh, select, requestField };
}

export const modelStore = createModelStore();
