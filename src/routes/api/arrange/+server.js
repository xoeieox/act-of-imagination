import Anthropic from '@anthropic-ai/sdk';
import { json } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({
	apiKey: ANTHROPIC_API_KEY
});

const CONTEXT_PROMPTS = {
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

		const contextPrompt = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.meeting;

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

		const response = await anthropic.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 1024,
			system: systemPrompt,
			messages: [{ role: 'user', content: userPrompt }]
		});

		const narrative = response.content[0].text;

		return json({ narrative });

	} catch (error) {
		console.error('Arrange API error:', error);
		return json(
			{ error: 'Failed to generate interaction', details: error.message },
			{ status: 500 }
		);
	}
}
