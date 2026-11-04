import Anthropic from '@anthropic-ai/sdk';
import { json } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({
	apiKey: ANTHROPIC_API_KEY
});

export async function POST({ request }) {
	try {
		const { cards, context, narrative } = await request.json();

		if (!narrative) {
			return json({ error: 'Narrative is required' }, { status: 400 });
		}

		// Build the card names
		const cardNames = cards.map(c => c.name).join(', ');
		const contextLabel = context?.label || 'interaction';

		const systemPrompt = `You are creating a brief synopsis of an imaginative exploration. Your synopsis should:

- Be 1-2 sentences maximum
- Capture the essence of what was explored, not summarize the narrative
- Use evocative but accessible language
- Focus on the themes or insights that emerged
- NOT explain or interpret meaning
- NOT use phrases like "the narrative explores" or "this assembly examines"

Write in present tense. Be concise and poetic.`;

		const userPrompt = `Create a brief synopsis for this assembly:

Cards explored: ${cardNames}
Context: ${contextLabel}

The generated narrative was:
"${narrative}"

Write a 1-2 sentence synopsis that captures what this assembly explores.`;

		const response = await anthropic.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 150,
			system: systemPrompt,
			messages: [{ role: 'user', content: userPrompt }]
		});

		const synopsis = response.content[0].text.trim();

		return json({ synopsis });

	} catch (error) {
		console.error('Synopsis API error:', error);
		return json(
			{ error: 'Failed to generate synopsis', details: error.message },
			{ status: 500 }
		);
	}
}
