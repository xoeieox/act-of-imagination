import { describe, it, expect, vi } from 'vitest';
import {
	resolveLane,
	chat,
	LaneUnconfiguredError,
	LaneUpstreamError,
	laneConfigHint
} from './lane.js';

const BASE = {
	AOI_LLM_BASE_URL: 'https://gateway.example.invalid/v1',
	AOI_LLM_MODEL: 'shared-model',
	AOI_LLM_API_KEY: 'shared-secret'
};

describe('resolveLane - env table', () => {
	it('resolves a fully set lane from shared base vars', () => {
		const lane = resolveLane('chat', { env: BASE });
		expect(lane).toEqual({
			baseUrl: 'https://gateway.example.invalid/v1',
			model: 'shared-model',
			apiKey: 'shared-secret',
			provider: 'openai',
			maxTokens: null
		});
	});

	it('lane-specific vars override shared base per field', () => {
		const env = {
			...BASE,
			AOI_LLM_CHAT_MODEL: 'chat-model',
			AOI_LLM_CHAT_BASE_URL: 'https://other.invalid:11434/v1/',
			AOI_LLM_CHAT_MAX_TOKENS: '512'
		};
		const lane = resolveLane('chat', { env });
		expect(lane.model).toBe('chat-model');
		expect(lane.baseUrl).toBe('https://other.invalid:11434/v1'); // trailing slash trimmed
		expect(lane.maxTokens).toBe(512);
		expect(lane.apiKey).toBe('shared-secret'); // not overridden -> falls back to base
		// a different lane keeps the base values
		expect(resolveLane('synopsis', { env }).model).toBe('shared-model');
	});

	it('missing BASE_URL fails closed', () => {
		const env = { AOI_LLM_MODEL: 'm', AOI_LLM_API_KEY: 'k' };
		expect(resolveLane('chat', { env })).toBeNull();
	});

	it('missing MODEL fails closed', () => {
		const env = { AOI_LLM_BASE_URL: 'https://x.invalid/v1', AOI_LLM_API_KEY: 'k' };
		expect(resolveLane('chat', { env })).toBeNull();
	});

	it('unknown provider fails closed', () => {
		const env = { ...BASE, AOI_LLM_CHAT_PROVIDER: 'made-up-provider' };
		expect(resolveLane('chat', { env })).toBeNull();
	});

	it('known-but-non-openai provider fails closed even when spelled right', () => {
		const env = { ...BASE, AOI_LLM_PROVIDER: 'bedrock' };
		expect(resolveLane('chat', { env })).toBeNull();
	});

	it('API_KEY absent but public endpoint still resolves (key null)', () => {
		const env = { AOI_LLM_BASE_URL: 'https://public.invalid/v1', AOI_LLM_MODEL: 'm' };
		const lane = resolveLane('arrange', { env });
		expect(lane.apiKey).toBeNull();
		expect(lane.baseUrl).toBe('https://public.invalid/v1');
	});

	it('empty-string API_KEY is treated as absent', () => {
		const env = { ...BASE, AOI_LLM_API_KEY: '' };
		expect(resolveLane('chat', { env }).apiKey).toBeNull();
	});

	it('rejects a base URL without an http(s) scheme', () => {
		const env = { AOI_LLM_BASE_URL: 'gateway.example.invalid/v1', AOI_LLM_MODEL: 'm' };
		expect(resolveLane('chat', { env })).toBeNull();
	});

	it('rejects a non-positive or non-integer MAX_TOKENS', () => {
		expect(resolveLane('chat', { env: { ...BASE, AOI_LLM_CHAT_MAX_TOKENS: '0' } })).toBeNull();
		expect(resolveLane('chat', { env: { ...BASE, AOI_LLM_CHAT_MAX_TOKENS: '-5' } })).toBeNull();
		expect(resolveLane('chat', { env: { ...BASE, AOI_LLM_CHAT_MAX_TOKENS: 'abc' } })).toBeNull();
	});

	it('unknown lane name resolves null', () => {
		expect(resolveLane('bogus', { env: BASE })).toBeNull();
	});
});

describe('laneConfigHint', () => {
	it('names the env vars it wants you to set', () => {
		const hint = laneConfigHint('chat');
		expect(hint).toContain('AOI_LLM_BASE_URL');
		expect(hint).toContain('AOI_LLM_CHAT_MODEL');
	});
});

// ---- chat() against an injected fetch stub (zero network) ----

function stubFetch(reply) {
	return vi.fn(async (url, init) => {
		const body = JSON.parse(init.body);
		const res = typeof reply === 'function' ? reply(url, init, body) : reply;
		return {
			ok: res.ok ?? res.status < 400,
			status: res.status ?? 200,
			text: async () => res.text ?? JSON.stringify(res.json ?? {}),
			json: async () => {
				if (res.json) return res.json;
				throw new Error('not json');
			}
		};
	});
}

const completion = (content, toolCalls) => ({
	status: 200,
	json: {
		choices: [
			{
				message: {
					content,
					...(toolCalls ? { tool_calls: toolCalls } : {})
				}
			}
		]
	}
});

describe('chat - wire dispatch', () => {
	it('throws LaneUnconfiguredError for an unconfigured lane', async () => {
		await expect(
			chat('chat', { messages: [{ role: 'user', content: 'hi' }], env: {}, fetch: stubFetch({}) })
		).rejects.toBeInstanceOf(LaneUnconfiguredError);
	});

	it('POSTs /chat/completions with model+messages+Bearer and returns content', async () => {
		const fetch = stubFetch(completion('a gentle reply'));
		const result = await chat('chat', {
			messages: [{ role: 'user', content: 'hi' }],
			maxTokens: 1024,
			env: BASE,
			fetch
		});
		expect(result.content).toBe('a gentle reply');
		expect(result.toolCalls).toEqual([]);

		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('https://gateway.example.invalid/v1/chat/completions');
		expect(init.method).toBe('POST');
		expect(init.headers.authorization).toBe('Bearer shared-secret');
		expect(init.headers['content-type']).toBe('application/json');
		const sent = JSON.parse(init.body);
		expect(sent.model).toBe('shared-model');
		expect(sent.max_tokens).toBe(1024);
		expect(sent.messages).toEqual([{ role: 'user', content: 'hi' }]);
	});

	it('omits the authorization header for a public (keyless) endpoint', async () => {
		const env = { AOI_LLM_BASE_URL: 'https://public.invalid/v1', AOI_LLM_MODEL: 'm' };
		const fetch = stubFetch(completion('ok'));
		await chat('synopsis', { messages: [{ role: 'user', content: 'x' }], env, fetch });
		const [, init] = fetch.mock.calls[0];
		expect(init.headers.authorization).toBeUndefined();
	});

	it('lane MAX_TOKENS overrides the caller maxTokens', async () => {
		const env = { ...BASE, AOI_LLM_CHAT_MAX_TOKENS: '333' };
		const fetch = stubFetch(completion('ok'));
		await chat('chat', { messages: [{ role: 'user', content: 'x' }], maxTokens: 1024, env, fetch });
		expect(JSON.parse(fetch.mock.calls[0][1].body).max_tokens).toBe(333);
	});

	it('normalizes tool_calls and preserves the raw wire form for echo', async () => {
		const toolCalls = [
			{
				id: 'call_9',
				type: 'function',
				function: { name: 'detect_forming_card', arguments: '{"type":"theme","depth":0.3}' }
			}
		];
		const fetch = stubFetch(completion('', toolCalls));
		const out = await chat('chat', {
			messages: [{ role: 'user', content: 'x' }],
			tools: [{ name: 'detect_forming_card', description: 'd', input_schema: { type: 'object' } }],
			env: BASE,
			fetch
		});
		expect(out.content).toBe('');
		expect(out.toolCalls[0]).toEqual({
			id: 'call_9',
			name: 'detect_forming_card',
			arguments: { type: 'theme', depth: 0.3 },
			raw: toolCalls[0]
		});
		// sent tools were normalized to OpenAI function shape
		const sent = JSON.parse(fetch.mock.calls[0][1].body);
		expect(sent.tools[0]).toEqual({
			type: 'function',
			function: { name: 'detect_forming_card', description: 'd', parameters: { type: 'object' } }
		});
	});

	it('maps a 4xx to LaneUpstreamError with the status', async () => {
		const fetch = stubFetch({ status: 404, text: 'no such model' });
		await expect(
			chat('chat', { messages: [{ role: 'user', content: 'x' }], env: BASE, fetch })
		).rejects.toMatchObject({ name: 'LaneUpstreamError', status: 404 });
	});

	it('maps a 5xx to LaneUpstreamError', async () => {
		const fetch = stubFetch({ status: 503, text: 'unavailable' });
		await expect(
			chat('arrange', { messages: [{ role: 'user', content: 'x' }], env: BASE, fetch })
		).rejects.toBeInstanceOf(LaneUpstreamError);
	});

	it('maps a transport failure to LaneUpstreamError', async () => {
		const fetch = vi.fn(async () => {
			throw new Error('ECONNREFUSED');
		});
		await expect(
			chat('chat', { messages: [{ role: 'user', content: 'x' }], env: BASE, fetch })
		).rejects.toBeInstanceOf(LaneUpstreamError);
	});

	it('rejects a response with no completion choice', async () => {
		const fetch = stubFetch({ status: 200, json: { choices: [] } });
		await expect(
			chat('chat', { messages: [{ role: 'user', content: 'x' }], env: BASE, fetch })
		).rejects.toBeInstanceOf(LaneUpstreamError);
	});
});
