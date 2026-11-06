/**
 * Server-only LLM lane module (aoi-lane-swap-v0).
 *
 * The whole model-config surface is the environment:
 *   AOI_LLM_<LANE>_<FIELD>  with LANE in {CHAT, ARRANGE, SYNOPSIS}
 *                                  FIELD in {PROVIDER, BASE_URL, MODEL, API_KEY, MAX_TOKENS}
 *   Shared defaults AOI_LLM_BASE_URL / AOI_LLM_MODEL / AOI_LLM_API_KEY;
 *   lane-specific values override per field.
 *
 * Nothing in this file names an endpoint or a cloud key. Provider v0 is
 * "openai" - the OpenAI-compatible /chat/completions wire served by local
 * runtimes (Ollama, llama.cpp server, vLLM, SGLang, ...) - and any other
 * provider value is treated as a misconfiguration. Unconfigured or
 * misconfigured lanes fail closed; callers translate that into HTTP 501.
 *
 * Importable only from server code (src/lib/server/** is SvelteKit server-only;
 * the no-restricted-imports invariant check keeps it out of the client bundle).
 */

const LANE_ENV_KEYS = {
	chat: 'CHAT',
	arrange: 'ARRANGE',
	synopsis: 'SYNOPSIS'
};

const PROVIDERS_V0 = ['openai'];

export class LaneUnconfiguredError extends Error {
	constructor(laneName) {
		super(`LLM lane "${laneName}" is unconfigured or misconfigured (fail closed)`);
		this.name = 'LaneUnconfiguredError';
		this.lane = laneName;
	}
}

export class LaneUpstreamError extends Error {
	constructor(message, status = 0, detail = '') {
		super(message);
		this.name = 'LaneUpstreamError';
		this.status = status;
		this.detail = detail;
	}
}

/**
 * Machine-readable hint naming the env vars a fresh clone needs.
 * The three API routes embed this in their 501 body (invariant I-2).
 */
export function laneConfigHint(laneName) {
	const laneKey = LANE_ENV_KEYS[laneName] || '<CHAT|ARRANGE|SYNOPSIS>';
	return (
		`No model lane configured: set AOI_LLM_BASE_URL and AOI_LLM_MODEL (shared defaults), ` +
		`or per-lane AOI_LLM_${laneKey}_BASE_URL / AOI_LLM_${laneKey}_MODEL / ` +
		`AOI_LLM_${laneKey}_API_KEY / AOI_LLM_${laneKey}_PROVIDER / AOI_LLM_${laneKey}_MAX_TOKENS. ` +
		`See .env.example - any OpenAI-compatible /chat/completions endpoint works, ` +
		`including a local model server.`
	);
}

function trimToValue(raw) {
	if (raw === undefined || raw === null) return '';
	const s = String(raw).trim();
	return s;
}

/**
 * Resolve one lane from the env table. Returns the config object or null
 * (null = unconfigured or misconfigured; callers fail closed, never default).
 */
export function resolveLane(laneName, { env = process.env } = {}) {
	const laneKey = LANE_ENV_KEYS[laneName];
	if (!laneKey) return null;

	const read = (field) =>
		trimToValue(env[`AOI_LLM_${laneKey}_${field}`] || env[`AOI_LLM_${field}`] || '');

	const providerRaw = read('PROVIDER');
	const provider = providerRaw ? providerRaw.toLowerCase() : 'openai';
	if (!PROVIDERS_V0.includes(provider)) return null;

	const baseUrl = read('BASE_URL').replace(/\/+$/, '');
	if (!baseUrl) return null;
	if (!/^https?:\/\//i.test(baseUrl)) return null;

	const model = read('MODEL');
	if (!model) return null;

	const apiKey = read('API_KEY') || null;

	const maxTokensRaw = read('MAX_TOKENS');
	let maxTokens = null;
	if (maxTokensRaw) {
		const parsed = Number(maxTokensRaw);
		if (!Number.isInteger(parsed) || parsed <= 0) return null;
		maxTokens = parsed;
	}

	return { baseUrl, model, apiKey, provider, maxTokens };
}

function normalizeTool(tool) {
	if (tool && tool.type === 'function' && tool.function) return tool;
	if (tool && typeof tool.name === 'string' && tool.input_schema) {
		return {
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.input_schema
			}
		};
	}
	return tool;
}

function parseToolCallArguments(rawArguments) {
	if (rawArguments && typeof rawArguments === 'object') return rawArguments;
	if (typeof rawArguments !== 'string' || rawArguments.trim() === '') return {};
	try {
		const parsed = JSON.parse(rawArguments);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function normalizeToolCalls(message) {
	const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
	return calls.map((call, index) => {
		const fn = (call && call.function) || {};
		const id = (call && call.id) || `call_${index}`;
		const name = fn.name || '';
		const argsString =
			typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments || {});
		return {
			id,
			name,
			arguments: parseToolCallArguments(fn.arguments),
			// wire-shaped form, for sending the assistant turn back verbatim
			raw: { id, type: 'function', function: { name, arguments: argsString } }
		};
	});
}

/**
 * Dispatch one chat turn on the named lane.
 *
 * messages: OpenAI-shaped array ([{role, content}, ...]; include the system
 *   turn as {role:'system'} at the front).
 * tools: array of tool defs; accepts {name, description, input_schema}
 *   (card-formation definitions) or already-wire {type:'function'} shapes.
 * Returns { content, toolCalls } with toolCalls normalized to
 *   [{id, name, arguments, raw}].
 * Throws LaneUnconfiguredError (fail closed) | LaneUpstreamError (non-2xx,
 *   transport failure, unparseable response, missing completion).
 */
export async function chat(
	laneName,
	{ messages, tools, toolChoice, maxTokens, fetch: fetchImpl, env = process.env } = {}
) {
	const lane = resolveLane(laneName, { env });
	if (!lane) throw new LaneUnconfiguredError(laneName);
	if (!Array.isArray(messages)) throw new TypeError('lane chat: messages must be an array');

	const body = { model: lane.model, messages };
	if (Array.isArray(tools) && tools.length > 0) body.tools = tools.map(normalizeTool);
	if (toolChoice !== undefined) body.tool_choice = toolChoice;
	const effectiveMaxTokens = lane.maxTokens != null ? lane.maxTokens : maxTokens;
	if (effectiveMaxTokens != null) body.max_tokens = effectiveMaxTokens;

	const headers = { 'content-type': 'application/json' };
	if (lane.apiKey) headers.authorization = `Bearer ${lane.apiKey}`;

	const doFetch = fetchImpl || globalThis.fetch;
	if (typeof doFetch !== 'function') {
		throw new LaneUpstreamError(`LLM lane "${laneName}": no fetch implementation available`);
	}

	let response;
	try {
		response = await doFetch(`${lane.baseUrl}/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		});
	} catch (error) {
		throw new LaneUpstreamError(
			`LLM lane "${laneName}": transport failure calling the configured endpoint (${
				error && error.message ? error.message : 'unknown error'
			})`
		);
	}

	if (!response.ok) {
		let detail = '';
		try {
			detail = (await response.text()).slice(0, 500);
		} catch {
			/* detail stays empty */
		}
		throw new LaneUpstreamError(
			`LLM lane "${laneName}": endpoint responded ${response.status}`,
			response.status,
			detail
		);
	}

	let data;
	try {
		data = await response.json();
	} catch {
		throw new LaneUpstreamError(
			`LLM lane "${laneName}": endpoint returned a non-JSON response`,
			response.status
		);
	}

	const choice = data && Array.isArray(data.choices) ? data.choices[0] : null;
	if (!choice) {
		throw new LaneUpstreamError(
			`LLM lane "${laneName}": endpoint returned no completion choice`,
			response.status
		);
	}

	const message = choice.message || {};
	const content = typeof message.content === 'string' ? message.content : '';

	return { content, toolCalls: normalizeToolCalls(message) };
}
