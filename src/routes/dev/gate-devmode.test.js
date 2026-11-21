/**
 * Dev panel gate, dev-mode posture (aoi-dev-panel-flag, 2026-11-21).
 *
 * The dev-mode half of the gate is unchanged: with $app/environment dev
 * true (mocked), load() passes without any flag - the pre-existing
 * `npm run dev` experience is untouched by the runtime opt-in.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { load } from './+page.server.js';

vi.mock('$app/environment', () => ({ dev: true, building: false, browser: false }));

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

describe('/dev gate: dev-mode access unchanged (no flag needed)', () => {
	it('dev true -> load() passes through with no flag set', () => {
		expect(load()).toEqual({});
	});
});
