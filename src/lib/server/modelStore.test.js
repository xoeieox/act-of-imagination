/**
 * Model store tests (2026-11-21).
 *
 * The server-side file contract, on a real temp directory (fs):
 *   - atomicWriteJson: 0600 file, no temp residue, dir 0700;
 *   - combinedRegistry merge: operator rows first, user rows appended,
 *     shadowed user keys dropped, malformed files fail the whole store;
 *   - AOI_MODEL_STORE_DIR honored verbatim (hermetic + file-absent =
 *     the deprecated env-fallback path stays reachable);
 *   - create/update/delete: validation generic (never echoes input),
 *     operator rows immutable (403), unknown key 404, duplicate 409,
 *     masked keyLast4 (last 4 only), draft-vs-healthy status;
 *   - the catalog privacy rule extended: NO summary or mutation response
 *     ever contains a sentinel endpoint or key value;
 *   - resolveCombinedSelection answers from BOTH files (unknown 400).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	mkdtempSync,
	rmSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
	existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	atomicWriteJson,
	storePaths,
	combinedRegistry,
	registrySummary,
	resolveCombinedSelection,
	createUserRow,
	updateUserRow,
	deleteUserRow,
	fullRowByKey,
	validateProbeShape
} from './modelStore.js';

let dir;
let env;

beforeEach(() => {
	dir = mkdtempSync(path.join(tmpdir(), 'aoi-store-test-'));
	env = { AOI_MODEL_STORE_DIR: dir };
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function writeOperator(entries) {
	writeFileSync(storePaths({ env }).operator, JSON.stringify(entries), { mode: 0o600 });
}
function writeUser(entries) {
	writeFileSync(storePaths({ env }).user, JSON.stringify(entries), { mode: 0o600 });
}
function readUserFile() {
	return JSON.parse(readFileSync(storePaths({ env }).user, 'utf8'));
}

const OPERATOR_ROW = {
	key: 'lane-chat',
	label: 'Lane default (chat)',
	baseUrl: 'https://operator-sentinel.invalid/v1',
	model: 'operator-model-sentinel',
	apiKey: 'operat…-abc',
	maxTokens: 8192
};
const USER_ROW = {
	key: 'my-model',
	label: 'My Model',
	baseUrl: 'http://127.0.0.1:8123/v1',
	model: 'user-model-sentinel',
	apiKey: 'user-key-sentinel-wxyz',
	status: 'healthy'
};

describe('atomicWriteJson', () => {
	it('writes 0600 via temp+rename - no temp residue, parent created', () => {
		const target = path.join(dir, 'nested', 'x.json');
		atomicWriteJson(target, { hello: 'world' });
		const mode = statSync(target).mode & 0o777;
		expect(mode).toBe(0o600);
		expect(readFileSync(target, 'utf8')).toContain('"hello"');
		const residue = readdirSync(path.dirname(target));
		expect(residue.filter((f) => f.endsWith('.tmp'))).toEqual([]);
	});

	it('overwrites atomically (content replaced whole)', () => {
		const target = path.join(dir, 'x.json');
		atomicWriteJson(target, { v: 1 });
		atomicWriteJson(target, { v: 2 });
		expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({ v: 2 });
		expect(statSync(target).mode & 0o777).toBe(0o600);
	});
});

describe('combinedRegistry - operator + user merge', () => {
	it('both files absent + env unset -> empty, not invalid', () => {
		expect(combinedRegistry({ env })).toEqual({ entries: [], invalid: false });
	});

	it('operator file absent -> deprecated AOI_MODELS_JSON fallback still answers', () => {
		const legacy = { ...env, AOI_MODELS_JSON: JSON.stringify([OPERATOR_ROW]) };
		const { entries, invalid } = combinedRegistry({ env: legacy });
		expect(invalid).toBe(false);
		expect(entries[0].source).toBe('operator');
		expect(entries[0].key).toBe('lane-chat');
	});

	it('operator rows come first, user rows appended with source + status', () => {
		writeOperator([OPERATOR_ROW]);
		writeUser([USER_ROW]);
		const { entries } = combinedRegistry({ env });
		expect(entries.map((e) => e.key)).toEqual(['lane-chat', 'my-model']);
		expect(entries[0].source).toBe('operator');
		expect(entries[1].source).toBe('user');
		expect(entries[1].status).toBe('healthy');
	});

	it('a user row shadowing an operator key is dropped from the listing', () => {
		writeOperator([OPERATOR_ROW]);
		writeUser([{ ...USER_ROW, key: 'lane-chat' }]);
		const { entries } = combinedRegistry({ env });
		expect(entries).toHaveLength(1);
		expect(entries[0].source).toBe('operator');
	});

	it('a malformed file fails the WHOLE registry closed', () => {
		writeOperator([OPERATOR_ROW]);
		writeFileSync(storePaths({ env }).user, '[oops', { mode: 0o600 });
		expect(combinedRegistry({ env })).toEqual({ entries: [], invalid: true });
	});

	it('user row missing status defaults to draft (safe side)', () => {
		writeUser([{ key: 'plain', label: 'P', baseUrl: 'http://127.0.0.1:1/v1', model: 'm' }]);
		const { entries } = combinedRegistry({ env });
		expect(entries[0].status).toBe('draft');
	});
});

describe('registrySummary - masked catalog rows', () => {
	it('ships key/label/source/status/hasKey/keyLast4 ONLY - sentinels never appear', () => {
		writeOperator([OPERATOR_ROW]);
		writeUser([USER_ROW]);
		const { models } = registrySummary({ env });
		const text = JSON.stringify(models);
		expect(text).not.toContain('operator-sentinel.invalid');
		expect(text).not.toContain('operator-model-sentinel');
		expect(text).not.toContain('operator-key-sentinel');
		expect(text).not.toContain('user-model-sentinel');
		expect(text).not.toContain('user-key-sentinel');
		expect(models[0]).toEqual({
			key: 'lane-chat',
			label: 'Lane default (chat)',
			source: 'operator',
			hasKey: true
		});
		expect(models[1].status).toBe('healthy');
		expect(models[1].hasKey).toBe(true);
		expect(models[1].keyLast4).toBe('wxyz');
		expect(models[1].keyLast4.length).toBeLessThanOrEqual(4);
		expect(models[1].baseUrl).toBeUndefined();
	});
});

describe('createUserRow / updateUserRow / deleteUserRow', () => {
	it('create validates shape generically (never echoes input) and defaults to draft', () => {
		const bad = createUserRow({ label: 'x', baseUrl: 'ftp://nope', model: 'm' }, { env });
		expect(bad.status).toBe(400);
		expect(bad.body).toEqual({ error: 'invalid_model_config' });

		const ok = createUserRow(
			{ label: 'Local vLLM', baseUrl: 'http://127.0.0.1:8000/v1', model: 'qwen' },
			{ env }
		);
		expect(ok.status).toBe(201);
		expect(ok.body.status).toBe('draft');
		expect(ok.body.source).toBe('user');
		expect(ok.body.key).toMatch(/^user-[0-9a-f]{10}$/);
		expect(ok.body.baseUrl).toBeUndefined();
		const stored = readUserFile()[0];
		expect(stored.baseUrl).toBe('http://127.0.0.1:8000/v1'); // stored as given
		expect(stored.source).toBeUndefined(); // transport noise never persisted
		expect(statSync(storePaths({ env }).user).mode & 0o777).toBe(0o600);
	});

	it('explicit key honored; duplicate -> 409; operator key -> 403', () => {
		const a = createUserRow(
			{ key: 'mine', label: 'A', baseUrl: 'http://127.0.0.1:1/v1', model: 'm' },
			{ env }
		);
		expect(a.status).toBe(201);
		const dup = createUserRow(
			{ key: 'mine', label: 'B', baseUrl: 'http://127.0.0.1:1/v1', model: 'm' },
			{ env }
		);
		expect(dup.status).toBe(409);
		writeOperator([OPERATOR_ROW]);
		const op = createUserRow(
			{ key: 'lane-chat', label: 'B', baseUrl: 'http://127.0.0.1:1/v1', model: 'm' },
			{ env }
		);
		expect(op.status).toBe(403);
		expect(op.body.error).toBe('operator_model_readonly');
	});

	it('invalid status -> generic invalid_model_status', () => {
		const bad = createUserRow(
			{ label: 'A', baseUrl: 'http://127.0.0.1:1/v1', model: 'm', status: 'sure-thing' },
			{ env }
		);
		expect(bad.status).toBe(400);
		expect(bad.body).toEqual({ error: 'invalid_model_status' });
	});

	it('update: blank fields preserve stored values; explicit empty key clears; unknown 404; operator 403', () => {
		writeUser([{ ...USER_ROW }]);
		const keep = updateUserRow('my-model', { label: 'Renamed' }, { env });
		expect(keep.status).toBe(200);
		expect(keep.body.label).toBe('Renamed');
		expect(keep.body.keyLast4).toBe('wxyz'); // key preserved
		expect(readUserFile()[0].apiKey).toBe('user-key-sentinel-wxyz');

		const cleared = updateUserRow('my-model', { apiKey: '' }, { env });
		expect(cleared.body.hasKey).toBeUndefined();
		expect(readUserFile()[0].apiKey).toBeNull();

		expect(updateUserRow('ghost', { label: 'x' }, { env }).status).toBe(404);
		writeOperator([OPERATOR_ROW]);
		expect(updateUserRow('lane-chat', { label: 'x' }, { env }).status).toBe(403);
	});

	it('delete: user row disappears; operator 403; unknown 404', () => {
		writeUser([{ ...USER_ROW }]);
		expect(deleteUserRow('my-model', { env }).status).toBe(200);
		expect(readUserFile()).toEqual([]);
		writeOperator([OPERATOR_ROW]);
		expect(deleteUserRow('lane-chat', { env }).status).toBe(403);
		expect(deleteUserRow('ghost', { env }).status).toBe(404);
	});
});

describe('resolveCombinedSelection + fullRowByKey (both registries)', () => {
	it('user row resolves by key with its stored config (server-side hand-off)', () => {
		writeOperator([OPERATOR_ROW]);
		writeUser([{ ...USER_ROW, status: 'draft' }]);
		const res = resolveCombinedSelection('my-model', { env });
		expect(res.entry.baseUrl).toBe('http://127.0.0.1:8123/v1');
		expect(res.entry.model).toBe('user-model-sentinel');
		expect(res.entry.source).toBe('user');
	});

	it('unknown key -> 400 unknown_model_key; malformed store -> 400 model_registry_invalid', () => {
		writeUser([{ ...USER_ROW }]);
		expect(resolveCombinedSelection('ghost', { env })).toEqual({
			error: { status: 400, body: { error: 'unknown_model_key' } }
		});
		writeFileSync(storePaths({ env }).user, 'not json', { mode: 0o600 });
		expect(resolveCombinedSelection('my-model', { env }).error.body.error).toBe(
			'model_registry_invalid'
		);
	});

	it('fullRowByKey answers for stored rows only; never for unknown keys', () => {
		writeUser([{ ...USER_ROW }]);
		expect(fullRowByKey('my-model', { env }).entry.model).toBe('user-model-sentinel');
		expect(fullRowByKey('ghost', { env })).toEqual({ missing: true });
	});
});

describe('validateProbeShape', () => {
	it('accepts an explicit probe config; rejects missing/garbage shape', () => {
		const ok = validateProbeShape({
			baseUrl: 'https://api.example.invalid/v1',
			model: 'm',
			apiKey: 'k',
			maxTokens: '32'
		});
		expect(ok.ok).toBe(true);
		expect(ok.config.baseUrl).toBe('https://api.example.invalid/v1');
		expect(validateProbeShape({ baseUrl: 'https://x.invalid' }).ok).toBe(false); // no model
		expect(validateProbeShape(null).ok).toBe(false);
	});

	it('probe never reads or writes the store files (files untouched)', () => {
		writeUser([{ ...USER_ROW }]);
		const before = readFileSync(storePaths({ env }).user);
		validateProbeShape({ baseUrl: 'https://x.invalid/v1', model: 'm' });
		expect(readFileSync(storePaths({ env }).user)).toEqual(before);
		expect(existsSync(storePaths({ env }).operator)).toBe(false);
	});
});
