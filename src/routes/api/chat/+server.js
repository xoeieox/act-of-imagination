import Anthropic from '@anthropic-ai/sdk';
import { json } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({
	apiKey: ANTHROPIC_API_KEY
});

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

		// Format messages for Claude API, filtering out empty content
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

		const response = await anthropic.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 1024,
			system: SYSTEM_PROMPT + systemAddition,
			tools: TOOLS,
			messages: formattedMessages
		});

		// Process the response - extract text and tool uses
		let textContent = '';
		const cardEvents = [];

		for (const block of response.content) {
			if (block.type === 'text') {
				textContent = block.text;
			} else if (block.type === 'tool_use') {
				// Process card formation tool calls
				const toolName = block.name;
				const input = block.input;

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
		}

		// If the model used tools but didn't provide text, we need to continue the conversation
		// to get the actual response text. Keep trying until we get text (max 3 attempts).
		let attempts = 0;
		const maxAttempts = 3;
		let currentResponse = response;

		while (!textContent && cardEvents.length > 0 && attempts < maxAttempts) {
			attempts++;

			// Build tool results to send back
			const toolResults = currentResponse.content
				.filter(b => b.type === 'tool_use')
				.map(b => ({
					type: 'tool_result',
					tool_use_id: b.id,
					content: 'Card formation noted. Please provide a conversational response to the user.'
				}));

			// If no tool uses to respond to, break
			if (toolResults.length === 0) break;

			const continuedResponse = await anthropic.messages.create({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 1024,
				system: SYSTEM_PROMPT + systemAddition,
				tools: TOOLS,
				messages: [
					...formattedMessages,
					{ role: 'assistant', content: currentResponse.content },
					{ role: 'user', content: toolResults }
				]
			});

			// Extract text from continued response
			for (const block of continuedResponse.content) {
				if (block.type === 'text') {
					textContent = block.text;
					break;
				}
			}

			// Update for next iteration if needed
			currentResponse = continuedResponse;
		}

		// Final fallback: if we still have no text but had card events, provide a minimal acknowledgment
		if (!textContent && cardEvents.length > 0) {
			textContent = "I'm here with you. Something is stirring beneath the surface...";
		}

		return json({
			content: textContent,
			cardEvents
		});

	} catch (error) {
		console.error('Chat API error:', error);
		return json(
			{ error: 'Failed to process request', details: error.message },
			{ status: 500 }
		);
	}
}
