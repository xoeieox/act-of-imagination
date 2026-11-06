import { json } from '@sveltejs/kit';
import { chat as laneChat, LaneUnconfiguredError, LaneUpstreamError, laneConfigHint } from '$lib/server/lane.js';
import { SYSTEM_CONTEXTS, getSystemContext } from '$lib/data/contexts.js';

// Legacy context prompts for backward compatibility
const LEGACY_CONTEXT_PROMPTS = {
	meeting: 'These elements are encountering each other for the first time. What happens when they meet? What do they recognize in each other?',
	conflict: 'These elements are in tension with each other. What is the nature of their conflict? What does each want that the other resists?',
	discovery: 'Something is being revealed between these elements. What hidden truth emerges when they are placed together? What was waiting to be seen?',
	transformation: 'One or more of these elements is changing the others. What transformation is occurring? What is being left behind, and what is emerging?'
};

export async function POST({ request }) {
	try {
		const { cards, context } = await request.json();

		if (!cards || cards.length < 2) {
			return json({ error: 'At least 2 cards are required' }, { status: 400 });
		}

		// Build the card descriptions
		const cardDescriptions = cards.map((card, i) =>
			`Card ${i + 1}: "${card.name}" - ${card.essence}`
		).join('\n');

		// Handle both new format (context object) and legacy format (context string)
		let contextPrompt;
		if (typeof context === 'object' && context.prompt) {
			// New format: full context object with prompt
			contextPrompt = context.prompt;
		} else if (typeof context === 'string') {
			// Legacy format: context name string
			const systemContext = getSystemContext(context);
			contextPrompt = systemContext?.prompt || LEGACY_CONTEXT_PROMPTS[context] || LEGACY_CONTEXT_PROMPTS.meeting;
		} else {
			// Fallback
			contextPrompt = SYSTEM_CONTEXTS[0].prompt;
		}

		const systemPrompt = `You are a narrator witnessing an interaction between symbolic elements from someone's inner landscape. Your role is to:

- Generate a vivid, evocative scene or moment where these elements interact
- Be specific and sensory - use images, textures, movements
- Let the arrangement suggest relationships and dynamics
- Surprise with possibilities the person might not have seen
- Stay grounded in the established card meanings, but let them reveal new facets
- Do NOT interpret or explain what anything "means" - just show what happens

Keep the narrative to 2-3 paragraphs. End with an image or moment that invites contemplation - something to sit with, not a conclusion or lesson.

Write in present tense. Be poetic but not purple. Trust the reader.`;

		const userPrompt = `The following cards have been placed in an arrangement:

${cardDescriptions}

Context: ${contextPrompt}

Generate a scene or interaction that emerges from these elements meeting.`;

		const result = await laneChat('arrange', {
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			maxTokens: 1024
		});

		if (!result.content) {
			throw new LaneUpstreamError('LLM lane "arrange": endpoint returned no narrative content');
		}
		const narrative = result.content;

		return json({ narrative });

	} catch (error) {
		if (error instanceof LaneUnconfiguredError) {
			return json(
				{ error: 'llm_lane_unconfigured', lane: error.lane, hint: laneConfigHint(error.lane) },
				{ status: 501 }
			);
		}
		console.error('Arrange API error:', error);
		return json(
			{ error: 'Failed to generate interaction', details: error.message },
			{ status: 500 }
		);
	}
}
