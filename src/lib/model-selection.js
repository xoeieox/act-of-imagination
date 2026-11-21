/**
 * Pure model-selector helpers (aoi-model-selector-v0, 2026-11-21).
 *
 * Browser-safe and dependency-free: the /api/models catalog can only ever
 * arrive as {key,label} pairs (the server strips everything else -
 * Kyma catalog rule), and sanitizeModelCatalog hardens the client against
 * malformed restores the same way session.js does its localStorage reads.
 *
 * The degrade rule lives here: a stored selection that is no longer in the
 * catalog resolves to null (= lane env default, selector falls back
 * silently). Selection validity is ALWAYS re-checked server-side before
 * any outbound fetch; this module never authorizes anything, it only
 * decides what the browser sends.
 */

export const MODEL_STORAGE_KEY = 'aoi-model-v1';

/**
 * Keep only catalog rows: {key,label} strings plus the MASKED metadata the
 * manager UI may render (source, status, hasKey, keyLast4 - last 4 chars
 * at most, invariant I-9). Anything else (endpoint fields, key values,
 * garbage) is dropped client-side exactly as strictly as the server ships.
 */
export function sanitizeModelCatalog(raw) {
	if (!Array.isArray(raw)) return [];
	const out = [];
	const seen = new Set();
	for (const item of raw) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
		const key = typeof item.key === 'string' ? item.key.trim() : '';
		const label = typeof item.label === 'string' ? item.label.trim() : '';
		if (!key || !label || seen.has(key)) continue;
		const row = { key, label };
		if (item.source === 'operator' || item.source === 'user') row.source = item.source;
		if (item.status === 'healthy' || item.status === 'draft') row.status = item.status;
		if (item.hasKey === true) row.hasKey = true;
		if (typeof item.keyLast4 === 'string' && /^[A-Za-z0-9._-]{1,4}$/.test(item.keyLast4)) {
			row.keyLast4 = item.keyLast4;
		}
		out.push(row);
		seen.add(key);
	}
	return out;
}

/**
 * Resolve the persisted browser selection against the current catalog.
 * null = no selection (lane default). A stale key (operator removed the
 * entry) degrades to null silently - no error path, no request sent.
 */
export function resolveStoredKey(stored, catalog) {
	if (typeof stored !== 'string' || stored === '') return null;
	if (!Array.isArray(catalog)) return null;
	return catalog.some((m) => m && m.key === stored) ? stored : null;
}
