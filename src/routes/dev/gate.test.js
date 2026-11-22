/**
 * Dev panel gate, production posture (2026-11-21).
 *
 * With the server rendered like a production build ($app/environment dev
 * mocked false), the gate is fail-closed: only the exact AOI_DEV_PANEL=1
 * string opens it. This is the unit-level lock for the live 404 posture.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { load } from './+page.server.js';

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

const KEY = 'AOI_DEV_PANEL';
let saved;

beforeEach(() => {
	saved = process.env[KEY];
	delete process.env[KEY];
});

afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});

function capture(fn) {
	try {
		fn();
		return null;
	} catch (e) {
		return e;
	}
}

describe('/dev gate: fail-closed 404 without the operator flag', () => {
	it('flag absent -> load() throws the 404 shape', () => {
		const thrown = capture(load);
		expect(thrown).not.toBeNull();
		expect(thrown.status).toBe(404);
	});

	it('any non-"1" value stays 404 (0, true, empty, yes, 2)', () => {
		for (const value of ['0', 'true', '', 'yes', '2']) {
			process.env[KEY] = value;
			const thrown = capture(load);
			expect(thrown, `value ${JSON.stringify(value)} must stay 404`).not.toBeNull();
			expect(thrown.status).toBe(404);
		}
	});
});

describe('/dev gate: explicit AOI_DEV_PANEL=1 passes through', () => {
	it('flag "1" -> load() returns pass-through data, throws nothing', () => {
		process.env[KEY] = '1';
		expect(load()).toEqual({});
	});
});
