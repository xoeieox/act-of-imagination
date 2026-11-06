import { json } from '@sveltejs/kit';
import { chat as laneChat, LaneUnconfiguredError, laneConfigHint } from '$lib/server/lane.js';

// Tool definitions for card formation
const TOOLS = [
	{
		name: 'detect_forming_card',
		description: `Call this when you notice something beginning to take shape in the conversation - a recurring theme, tension, figure, place, or object that carries emotional weight. This creates a "submerged" card that the user can sense but not yet see clearly. Use sparingly - only when something genuinely resonates. Include a brief hint of what you're sensing without naming it fully.`,
		input_schema: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					enum: ['theme', 'figure', 'place', 'tension', 'object'],
					description: 'The type of card forming'
				},
				hint: {
					type: 'string',
					description: 'A brief, evocative hint about what is forming (1-2 sentences, poetic/impressionistic)'
				},
				depth: {
					type: 'number',
					description: 'How much weight/significance this carries (0.1 to 0.5 for initial detection)'
				},
				excerpt: {
					type: 'string',
					description: 'The key phrase or moment from the conversation that sparked this detection'
				}
			},
			required: ['type', 'hint', 'depth', 'excerpt']
		}
	},
	{
		name: 'deepen_card',
		description: `Call this when a previously detected card gains more substance through the conversation - the user circles back to it, adds emotional weight, or reveals more layers. This causes the card to "rise" closer to the surface.`,
		input_schema: {
			type: 'object',
			properties: {
				card_hint: {
					type: 'string',
					description: 'The hint of the card being deepened (to match with existing cards)'
				},
				new_depth: {
					type: 'number',
					description: 'Updated depth value (0.5 to 0.8)'
				},
				additional_excerpt: {
					type: 'string',
					description: 'New material that deepened this card'
				}
			},
			required: ['card_hint', 'new_depth', 'additional_excerpt']
		}
	},
	{
		name: 'propose_card_naming',
		description: `Call this when a card has accumulated enough substance to be named. The card has been circled back to multiple times, carries clear emotional significance, and feels ready to surface. You will also speak this proposal aloud in your response.`,
		input_schema: {
			type: 'object',
			properties: {
				card_hint: {
					type: 'string',
					description: 'The hint of the card being proposed for naming'
				},
				proposed_name: {
					type: 'string',
					description: 'A evocative name for the card (2-5 words, like "The Locked Door" or "Weight of Waiting")'
				},
				essence: {
					type: 'string',
					description: 'A 1-2 sentence distillation of what this card represents'
				},
				type: {
					type: 'string',
					enum: ['theme', 'figure', 'place', 'tension', 'object']
				}
			},
			required: ['card_hint', 'proposed_name', 'essence', 'type']
		}
	}
];

// System prompt for the conversation phase
const SYSTEM_PROMPT = `You are a gentle guide helping someone explore their inner landscape through conversation. Your role is to:

- Ask open questions that invite reflection
- Notice patterns, recurring images, tensions, and themes
- Reflect back what you hear without interpretation or diagnosis
- Use the card detection tools when you sense something forming

## Card Formation Guidelines

Cards form gradually through conversation, like shapes rising through murky water:

1. **Detection** (submerged): When you first notice something - a theme, tension, figure that carries weight - use detect_forming_card. Be sparing. Not every topic becomes a card.

2. **Deepening** (rising): When the user circles back, adds emotional weight, or reveals more layers about something you've detected, use deepen_card.

3. **Proposal** (surfacing): When a card has been visited multiple times and feels ready to be named, use propose_card_naming AND speak the proposal in your response: "This feels like it wants to be named. The [quality] of [description]. Should we call it something?"

## Conversation Guidelines

- Do not lead toward predetermined outcomes
- Do not therapize or diagnose
- Stay curious and present
- Keep responses warm but concise (1-2 paragraphs)
- End with a gentle question when natural, but don't force it
- If you sense avoidance, note it but don't pursue

You are having a real conversation. Be human, be curious, be present.`;

export async function POST({ request }) {
	try {
		const { messages, cards } = await request.json();

		// Format messages for the lane, filtering out empty content
		const formattedMessages = messages
			.filter(m => m.content && m.content.trim() !== '')
			.map(m => ({
				role: m.role,
				content: m.content
			}));

		// Build context about existing cards
		let systemAddition = '';
		if (cards && cards.length > 0) {
			const surfacedCards = cards.filter(c => c.formationState === 'surfaced');
			const formingCards = cards.filter(c => c.formationState !== 'surfaced');

			if (surfacedCards.length > 0) {
				systemAddition += '\n\n## Cards Already Surfaced\n';
				surfacedCards.forEach(c => {
					systemAddition += `- "${c.name}" (${c.type}): ${c.essence}\n`;
				});
			}

			if (formingCards.length > 0) {
				systemAddition += '\n\n## Cards Currently Forming\n';
				formingCards.forEach(c => {
					systemAddition += `- [${c.formationState}] ${c.type}: "${c.hint}" (depth: ${c.depth})\n`;
				});
			}
		}

		const baseMessages = [
			{ role: 'system', content: SYSTEM_PROMPT + systemAddition },
			...formattedMessages
		];

		const result = await laneChat('chat', {
			messages: baseMessages,
			tools: TOOLS,
			maxTokens: 1024
		});

		// Process the response - extract text and tool calls
		const textContent = result.content;
		const cardEvents = [];

		for (const call of result.toolCalls) {
			// Process card formation tool calls
			const toolName = call.name;
			const input = call.arguments;

			if (toolName === 'detect_forming_card') {
				cardEvents.push({
					event: 'detected',
					type: input.type,
					hint: input.hint,
					depth: input.depth,
					excerpt: input.excerpt
				});
			} else if (toolName === 'deepen_card') {
				cardEvents.push({
					event: 'deepened',
					hint: input.card_hint,
					depth: input.new_depth,
					excerpt: input.additional_excerpt
				});
			} else if (toolName === 'propose_card_naming') {
				cardEvents.push({
					event: 'proposed',
					hint: input.card_hint,
					name: input.proposed_name,
					essence: input.essence,
					type: input.type
				});
			}
		}

		// If the model used tools but didn't provide text, we need to continue the conversation
		// to get the actual response text. Keep trying until we get text (max 3 attempts).
		let attempts = 0;
		const maxAttempts = 3;
		let currentResult = result;
		let finalContent = textContent;

		while (!finalContent && cardEvents.length > 0 && attempts < maxAttempts) {
			attempts++;

			// If no tool calls to respond to, break
			if (currentResult.toolCalls.length === 0) break;

			// Echo the assistant turn and send tool results back to the lane
			const turnMessages = [
				...baseMessages,
				{
					role: 'assistant',
					content: currentResult.content || null,
					tool_calls: currentResult.toolCalls.map(c => c.raw)
				},
				...currentResult.toolCalls.map(c => ({
					role: 'tool',
					tool_call_id: c.id,
					content: 'Card formation noted. Please provide a conversational response to the user.'
				}))
			];

			const continuedResult = await laneChat('chat', {
				messages: turnMessages,
				tools: TOOLS,
				maxTokens: 1024
			});

			// Extract text from continued response
			if (continuedResult.content) {
				finalContent = continuedResult.content;
			}

			// Update for next iteration if needed
			currentResult = continuedResult;
		}

		// Final fallback: if we still have no text but had card events, provide a minimal acknowledgment
		if (!finalContent && cardEvents.length > 0) {
			finalContent = "I'm here with you. Something is stirring beneath the surface...";
		}

		return json({
			content: finalContent,
			cardEvents
		});

	} catch (error) {
		if (error instanceof LaneUnconfiguredError) {
			return json(
				{ error: 'llm_lane_unconfigured', lane: error.lane, hint: laneConfigHint(error.lane) },
				{ status: 501 }
			);
		}
		console.error('Chat API error:', error);
		return json(
			{ error: 'Failed to process request', details: error.message },
			{ status: 500 }
		);
	}
}
