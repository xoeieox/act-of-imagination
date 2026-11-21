/**
 * Honest first run (aoi-repo-polish-v0 leg 2, sec 5.6 / F-3, DoD #9).
 *
 * A fresh clone with zero .env must NOT discover the missing lane as a
 * failed fetch: the shell's server load resolves the lane table at render
 * time, and the "configure a lane" state arrives in the initial HTML with
 * zero API calls. These tests pin that structure:
 *   - load() reads env only (any fetch attempt throws),
 *   - the gate renders server-side via svelte/server,
 *   - no demo route or preset-replay surface exists (OD-6 rejected).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'svelte/server';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { load } from './+page.server.js';
import LaneGate from '$lib/components/LaneGate.svelte';

const LANE_KEYS = [
	'AOI_LLM_BASE_URL',
	'AOI_LLM_MODEL',
	'AOI_LLM_API_KEY',
	'AOI_LLM_PROVIDER',
	'AOI_LLM_CHAT_BASE_URL',
	'AOI_LLM_CHAT_MODEL',
	'AOI_LLM_CHAT_API_KEY',
	'AOI_LLM_ARRANGE_BASE_URL',
	'AOI_LLM_ARRANGE_MODEL',
	'AOI_LLM_SYNOPSIS_BASE_URL',
	'AOI_LLM_SYNOPSIS_MODEL'
];

const saved = {};

beforeEach(() => {
	for (const key of LANE_KEYS) {
		saved[key] = process.env[key];
		delete process.env[key];
	}
});

afterEach(() => {
	for (const key of LANE_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
});

describe('honest first run: server load is env-only (zero fetch)', () => {
	it('the zero-.env state comes from the environment, not the network', () => {
		const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
			throw new Error('load() must not fetch');
		});
		try {
			const data = load();
			expect(spy).not.toHaveBeenCalled();
			expect(data.lanesConfigured).toBe(false);
			expect(data.missingLanes).toEqual(['chat', 'arrange', 'synopsis']);
			// the hint is machine-readable operator guidance, not an error
			expect(data.laneHint).toContain('AOI_LLM_BASE_URL');
			expect(data.laneHint).toContain('AOI_LLM_MODEL');
			expect(data.laneHint).toContain('.env.example');
		} finally {
			spy.mockRestore();
		}
	});

	it('a fully configured lane table yields no gate state', () => {
		process.env.AOI_LLM_BASE_URL = 'http://127.0.0.1:11434/v1';
		process.env.AOI_LLM_MODEL = 'some-served-model';
		const data = load();
		expect(data.lanesConfigured).toBe(true);
		expect(data.missingLanes).toEqual([]);
		expect(data.laneHint).toBeNull();
	});

	it('a partially configured table names the missing lane in the hint', () => {
		process.env.AOI_LLM_CHAT_BASE_URL = 'http://127.0.0.1:11434/v1';
		process.env.AOI_LLM_CHAT_MODEL = 'chat-model';
		const data = load();
		expect(data.lanesConfigured).toBe(false);
		expect(data.missingLanes).toEqual(['arrange', 'synopsis']);
		expect(data.laneHint).toContain('AOI_LLM_ARRANGE_');
	});
});

describe('honest first run: the gate state renders in server HTML (F-3)', () => {
	it('the shell markup carries the configure-a-lane state with the env hint', () => {
		const data = load(); // zero .env
		expect(data.lanesConfigured).toBe(false);
		const { body } = render(LaneGate, { props: { hint: data.laneHint } });
		expect(body).toContain('Configure a lane');
		expect(body).toContain('lane-gate');
		expect(body).toContain('AOI_LLM_BASE_URL');
		expect(body).toContain('fails closed');
		// it is a first-class state, not an error page
		expect(body).not.toMatch(/501|llm_lane_unconfigured/);
	});

	it('+page.svelte wires the gate to the server data (no client fetch path)', () => {
		const page = readFileSync(path.resolve(import.meta.dirname, '+page.svelte'), 'utf8');
		expect(page).toContain('LaneGate');
		expect(page).toContain('data.lanesConfigured');
		expect(page).not.toMatch(/fetch\s*\(\s*['"]\/api\/lane/);
	});
});

describe('honest first run: no demo surface exists (OD-6)', () => {
	it('no demo route directory anywhere in the route tree', () => {
		const routesRoot = path.resolve(import.meta.dirname);
		const walk = (dir) => {
			const hits = [];
			for (const e of readdirSync(dir, { withFileTypes: true })) {
				const p = path.join(dir, e.name);
				if (e.isDirectory()) hits.push(...walk(p));
				else if (e.name.includes('demo')) hits.push(p);
			}
			return hits;
		};
		expect(walk(routesRoot)).toEqual([]);
		expect(existsSync(path.resolve(routesRoot, 'demo'))).toBe(false);
	});

	it('dev presets are prod-blocked at the dev route load, fail-closed without the runtime opt-in', () => {
		const devLoad = readFileSync(path.resolve(import.meta.dirname, 'dev/+page.server.js'), 'utf8');
		// Gate is server-side and fails closed: dev builds pass, production
		// builds only the exact operator flag AOI_DEV_PANEL=1 (aoi-dev-panel-flag).
		expect(devLoad).toContain('if (!dev');
		expect(devLoad).toContain("process.env.AOI_DEV_PANEL !== '1'");
		expect(devLoad).toContain('error(404');
	});
});
