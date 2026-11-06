/**
 * Card-formation prompt-replay suite (aoi-repo-polish-v0 leg 2, sec 5.4).
 *
 * Kyma lore-book pattern (kyma.git fixtures/lore-book/*): each YAML fixture
 * under fixtures/card-formation/ carries {name, lane, request, laneResponses,
 * expected}. The harness replays them against the real API routes with a
 * fake lane - canned OpenAI-compatible responses injected at the fetch seam,
 * zero network - and asserts the assembled prompt (system context + card
 * state + tool defs) and the continuation behavior of the formation loop.
 * These fixtures are the I-7 regression lock: the lane swap must not change
 * what the model sees or how tool calls map to card events.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { POST as chatPOST } from '../../routes/api/chat/+server.js';
import { POST as arrangePOST } from '../../routes/api/arrange/+server.js';
import { POST as synopsisPOST } from '../../routes/api/synopsis/+server.js';

const FIXTURE_DIR = path.resolve(import.meta.dirname, '../../../fixtures/card-formation');

const FAKE = {
	BASE_URL: 'https://lane.invalid/v1',
	MODEL: 'replay-model',
	API_KEY: 'replay-test-key'
};

const ROUTES = { chat: chatPOST, arrange: arrangePOST, synopsis: synopsisPOST };

/** Build the route's POST event-like arg from a fixture request. */
function routeEvent(lane, req) {
	const body =
		lane === 'chat'
			? { messages: req.messages, cards: req.cardState ?? [] }
			: lane === 'arrange'
				? { cards: req.cards, context: req.context }
				: { cards: req.cards, context: req.context, narrative: req.narrative };
	return {
		request: new Request('http://localhost/api', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
}

/**
 * Fake lane: an ordered queue of canned OpenAI-compatible completions served
 * through global fetch (the lane module's transport seam). Records every
 * request for prompt assertions.
 */
function installFakeLane(responses) {
	const calls = [];
	let queue = [...responses];
	const orig = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		const body = JSON.parse(init.body);
		calls.push({ url, init, body });
		const canned = queue.shift();
		if (!canned) {
			throw new Error(`replay lane: unexpected extra call #${calls.length} (queue drained)`);
		}
		return {
			ok: true,
			status: 200,
			text: async () => JSON.stringify(canned),
			json: async () => canned
		};
	};
	return { calls, restore: () => (globalThis.fetch = orig) };
}

/** The lane payload per route: chat.content / arrange.narrative / synopsis.synopsis. */
function lanePayload(lane, json) {
	return lane === 'chat' ? json.content : lane === 'arrange' ? json.narrative : json.synopsis;
}

/** Card-event shape the chat route emits per tool (behavior lock, I-7). */
function cardEventFor(name, args) {
	if (name === 'detect_forming_card') {
		return {
			event: 'detected',
			type: args.type,
			hint: args.hint,
			depth: args.depth,
			excerpt: args.excerpt
		};
	}
	if (name === 'deepen_card') {
		return {
			event: 'deepened',
			hint: args.card_hint,
			depth: args.new_depth,
			excerpt: args.additional_excerpt
		};
	}
	if (name === 'propose_card_naming') {
		return {
			event: 'proposed',
			hint: args.card_hint,
			name: args.proposed_name,
			essence: args.essence,
			type: args.type
		};
	}
	throw new Error(`unknown card-formation tool: ${name}`);
}

function subset(actual, expectedSubset) {
	for (const [k, v] of Object.entries(expectedSubset)) {
		expect(actual, `expected card event to carry "${k}"`).toHaveProperty(k);
		expect(actual[k], `${k} mismatch`).toBe(v);
	}
}

function loadFixtures() {
	return readdirSync(FIXTURE_DIR)
		.filter((f) => f.endsWith('.yaml'))
		.sort()
		.map((f) => ({ file: f, data: loadYaml(readFileSync(path.join(FIXTURE_DIR, f), 'utf8')) }));
}

const LANE_KEYS = [
	'AOI_LLM_BASE_URL',
	'AOI_LLM_MODEL',
	'AOI_LLM_API_KEY',
	'AOI_LLM_PROVIDER',
	'AOI_LLM_CHAT_BASE_URL',
	'AOI_LLM_CHAT_MODEL',
	'AOI_LLM_ARRANGE_BASE_URL',
	'AOI_LLM_ARRANGE_MODEL',
	'AOI_LLM_SYNOPSIS_BASE_URL',
	'AOI_LLM_SYNOPSIS_MODEL'
];

function withLaneEnv(fn) {
	const saved = {};
	beforeEach(() => {
		for (const k of LANE_KEYS) {
			saved[k] = process.env[k];
			delete process.env[k];
		}
		process.env.AOI_LLM_BASE_URL = FAKE.BASE_URL;
		process.env.AOI_LLM_MODEL = FAKE.MODEL;
		process.env.AOI_LLM_API_KEY = FAKE.API_KEY;
	});
	afterEach(() => {
		for (const k of LANE_KEYS) {
			if (saved[k] === undefined) delete process.env[k];
			else process.env[k] = saved[k];
		}
	});
	fn();
}

describe('card-formation replay fixtures (prompt assembly + behavior lock)', () => {
	withLaneEnv(() => {
		const fixtures = loadFixtures();

		it('finds the fixture set (all three tools + arrange + synopsis)', () => {
			const toolsCovered = new Set(
				fixtures.flatMap((f) => (f.data.expected.toolCalls ?? []).map((tc) => tc.name))
			);
			for (const tool of ['detect_forming_card', 'deepen_card', 'propose_card_naming']) {
				expect([...toolsCovered], `fixture coverage missing tool: ${tool}`).toContain(tool);
			}
			const lanesCovered = new Set(fixtures.map((f) => f.data.lane));
			expect(lanesCovered).toEqual(new Set(['chat', 'arrange', 'synopsis']));
		});

		for (const { file, data } of fixtures) {
			it(`replays ${file}`, async () => {
				const { lane, request: req, laneResponses, expected } = data;
				const fake = installFakeLane(laneResponses);
				try {
					const response = await ROUTES[lane](routeEvent(lane, req));
					expect(response.status).toBe(200);
					const json = await response.json();

					// every call hit the configured lane wire with auth
					for (const call of fake.calls) {
						expect(call.url).toBe(`${FAKE.BASE_URL}/chat/completions`);
						expect(call.init.headers.authorization).toBe(`Bearer ${FAKE.API_KEY}`);
						expect(call.body.model).toBe(FAKE.MODEL);
					}

					const first = fake.calls[0].body;
					const systemTurn = first.messages.find((m) => m.role === 'system');
					expect(systemTurn, 'assembled prompt must carry a system turn').toBeTruthy();
					for (const phrase of expected.systemPromptContains ?? []) {
						expect(systemTurn.content, `system prompt missing: "${phrase}"`).toContain(phrase);
					}

					if (expected.userPromptContains) {
						const userText = first.messages
							.filter((m) => m.role === 'user')
							.map((m) => m.content)
							.join('\n');
						for (const phrase of expected.userPromptContains) {
							expect(userText, `user prompt missing: "${phrase}"`).toContain(phrase);
						}
					}

					if (expected.toolDefs) {
						const sentNames = (first.tools ?? []).map((t) => t.function?.name ?? t.name);
						for (const name of expected.toolDefs) {
							expect(sentNames, `tool def missing: ${name}`).toContain(name);
						}
					}
					if (expected.toolsAbsent) {
						expect(first.tools, 'this lane must not send tool defs').toBeUndefined();
					}

					if (expected.laneCalls !== undefined) {
						expect(fake.calls.length, 'lane call count (continuation behavior)').toBe(
							expected.laneCalls
						);
					}

					// tool-call -> card-event mapping + continuation echo shape (chat lane).
					// The route maps the FIRST response's tool calls into cardEvents.
					if (lane === 'chat' && expected.toolCalls) {
						const events = json.cardEvents;
						expect(events.length).toBe(expected.toolCalls.length);
						const cannedCalls = laneResponses[0].choices[0].message.tool_calls ?? [];
						expected.toolCalls.forEach((tc, i) => {
							const cannedArgs = JSON.parse(cannedCalls[i].function.arguments);
							const mapped = cardEventFor(tc.name, cannedArgs);
							expect(events[i].event, `event ${i} kind`).toBe(mapped.event);
							subset(events[i], tc.argumentsSubset);
						});
						if (expected.laneCalls > 1) {
							const second = fake.calls[1].body.messages;
							const echo = second.filter((m) => m.role === 'assistant').at(-1);
							expect(
								echo?.tool_calls,
								'continuation must echo the assistant tool_calls turn'
							).toBeTruthy();
							expect(echo.tool_calls.length).toBe(cannedCalls.length);
							const toolResults = second.filter((m) => m.role === 'tool');
							expect(toolResults.length).toBe(cannedCalls.length);
							expect(toolResults[0].content).toContain('Card formation noted');
						}
					}

					const payload = lanePayload(lane, json);
					if (expected.finalContent !== undefined) {
						expect(payload).toBe(expected.finalContent);
					}
					if (expected.finalContentIncludes) {
						expect(payload).toContain(expected.finalContentIncludes);
					}
				} finally {
					fake.restore();
				}
			});
		}
	});
});
