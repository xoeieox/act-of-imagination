import { json } from '@sveltejs/kit';
import { chat as laneChat, laneErrorShape } from '$lib/server/lane.js';

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

		const result = await laneChat('synopsis', {
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			maxTokens: 150
		});

		const synopsis = result.content.trim();

		return json({ synopsis });

	} catch (error) {
		// Shared lane shape with the other two routes: 501 unconfigured (I-2) / 502 upstream.
		const laneShape = laneErrorShape(error);
		if (laneShape) {
			console.error('Synopsis API lane error:', error);
			return json(laneShape.body, { status: laneShape.status });
		}
		console.error('Synopsis API error:', error);
		return json(
			{ error: 'Failed to generate synopsis', details: error.message },
			{ status: 500 }
		);
	}
}
