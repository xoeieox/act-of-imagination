/**
 * Client-safe id generation.
 *
 * crypto.randomUUID exists only in secure contexts - the app is routinely
 * opened over a plain http LAN address, where it is undefined and a bare
 * call crashes client init (blank screen after the SSR flash). newId falls
 * back to getRandomValues (available on http origins) and, only as a last
 * resort, to a Math.random UUIDv4-shaped id. Server-side (Node) keeps the
 * native fast path.
 */
export function newId() {
	const c = typeof crypto !== 'undefined' ? crypto : null;
	if (c && typeof c.randomUUID === 'function') return c.randomUUID();
	const bytes = new Uint8Array(16);
	if (c && typeof c.getRandomValues === 'function') {
		c.getRandomValues(bytes);
	} else {
		for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
