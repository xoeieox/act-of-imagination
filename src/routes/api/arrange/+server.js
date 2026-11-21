import { json } from '@sveltejs/kit';
import { chat as laneChat, LaneUpstreamError, laneErrorShape } from '$lib/server/lane.js';
import { resolveModelSelection } from '$lib/server/modelRegistry.js';
import { buildArrangeMessages } from '$lib/server/arrange-prompt.js';
import { SYSTEM_CONTEXTS, getSystemContext } from '$lib/data/contexts.js';

// Legacy context prompts for backward compatibility
const LEGACY_CONTEXT_PROMPTS = {
	meeting:
		'These elements are encountering each other for the first time. What happens when they meet? What do they recognize in each other?',
	conflict:
		'These elements are in tension with each other. What is the nature of their conflict? What does each want that the other resists?',
	discovery:
		'Something is being revealed between these elements. What hidden truth emerges when they are placed together? What was waiting to be seen?',
	transformation:
		'One or more of these elements is changing the others. What transformation is occurring? What is being left behind, and what is emerging?'
};

export async function POST({ request }) {
	try {
		const { cards, slots, context, modelKey } = await request.json();

		// Model selector (aoi-model-selector-v0): validated server-side
		// before any outbound fetch; unknown key / malformed registry = 400,
		// never a silent fallback. Absent = today's exact lane posture.
		const selection = resolveModelSelection(modelKey);
		if (selection.error) {
			return json(selection.error.body, { status: selection.error.status });
		}

		// Client sends `slots` (3 free slots, nulls allowed); `cards` remains
		// the legacy shape (plain array, filled left to right).
		const arrangement = Array.isArray(slots) ? slots : cards;
		const filled = (Array.isArray(arrangement) ? arrangement : []).filter((c) => c != null);

		if (filled.length < 2) {
			return json({ error: 'At least 2 cards are required' }, { status: 400 });
		}

		// Handle both new format (context object) and legacy format (context string)
		let contextPrompt;
		if (typeof context === 'object' && context.prompt) {
			// New format: full context object with prompt
			contextPrompt = context.prompt;
		} else if (typeof context === 'string') {
			// Legacy format: context name string
			const systemContext = getSystemContext(context);
			contextPrompt =
				systemContext?.prompt || LEGACY_CONTEXT_PROMPTS[context] || LEGACY_CONTEXT_PROMPTS.meeting;
		} else {
			// Fallback
			contextPrompt = SYSTEM_CONTEXTS[0].prompt;
		}

		// Assembled by the pure prompt module (design :335-348): slot positions,
		// essences, depth indicators, context, gravitational-pull instruction.
		const messages = buildArrangeMessages(arrangement, contextPrompt);

		const result = await laneChat('arrange', {
			messages,
			// Budget must cover reasoning_content plus the narrative itself
			// on thinking lanes (aoi-fix 2026-11-17). AOI_LLM_ARRANGE_MAX_TOKENS
			// still wins per the lane table.
			maxTokens: 8192,
			modelOverride: selection.entry
		});

		// Whitespace-only narrative counts as none (aoi-fix 2026-11-17).
		if (!result.content || !result.content.trim()) {
			throw new LaneUpstreamError('LLM lane "arrange": endpoint returned no narrative content');
		}
		const narrative = result.content.trim();

		return json({ narrative });
	} catch (error) {
		// Shared lane shape with the other two routes: 501 unconfigured (I-2)
		// vs 502 upstream (the thrown "no narrative content" LaneUpstreamError
		// surfaces here too, at a gateway-accurate status).
		const laneShape = laneErrorShape(error);
		if (laneShape) {
			console.error('Arrange API lane error:', error);
			return json(laneShape.body, { status: laneShape.status });
		}
		console.error('Arrange API error:', error);
		return json(
			{ error: 'Failed to generate interaction', details: error.message },
			{ status: 500 }
		);
	}
}
