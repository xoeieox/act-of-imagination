/**
 * Arrangement Play prompt assembly (aoi-arrangement-play-v0).
 *
 * Pure module - no env, no fetch, no endpoints. Implements the design's
 * Arrangement Play Phase prompt (Act-of-Imagination-Design.md :335-348):
 * the arranged cards WITH their positions/slots, card essences and depth
 * indicators, the selected context, the heavier-cards-more-gravitational-pull
 * instruction, and the 2-3 paragraph / contemplative-image contract.
 *
 * The system prompt is the I-7 replay-fixture-locked narrator shape
 * (fixtures/card-formation/arrange-narrative-prompt.yaml) - keep it verbatim.
 */

export const ARRANGE_SYSTEM_PROMPT = `You are a narrator witnessing an interaction between symbolic elements from someone's inner landscape. Your role is to:

- Generate a vivid, evocative scene or moment where these elements interact
- Be specific and sensory - use images, textures, movements
- Let the arrangement suggest relationships and dynamics
- Surprise with possibilities the person might not have seen
- Stay grounded in the established card meanings, but let them reveal new facets
- Do NOT interpret or explain what anything "means" - just show what happens

Keep the narrative to 2-3 paragraphs. End with an image or moment that invites contemplation - something to sit with, not a conclusion or lesson.

Write in present tense. Be poetic but not purple. Trust the reader.`;

/**
 * Qualitative depth indicator for the prompt (heavier cards exert more
 * gravitational pull). Non-numeric/missing depth omits the indicator.
 */
export function depthIndicator(depth) {
	const d = typeof depth === 'string' ? Number(depth) : depth;
	if (typeof d !== 'number' || Number.isNaN(d)) return null;
	if (d >= 0.75) return `depth ${d} - heavy presence`;
	if (d >= 0.4) return `depth ${d} - settling weight`;
	return `depth ${d} - faint presence`;
}

/**
 * Render one slot line for the prompt. A null/empty slot renders as empty.
 */
export function renderSlotLine(index, card) {
	if (!card) return `Slot ${index + 1}: empty`;
	const bits = [];
	if (card.type) bits.push(String(card.type));
	const depth = depthIndicator(card.depth);
	if (depth) bits.push(depth);
	const suffix = bits.length > 0 ? ` (${bits.join(', ')})` : '';
	return `Slot ${index + 1}: "${card.name}" - ${card.essence}${suffix}`;
}

/**
 * Normalize the arrangement into exactly 3 slot entries (null = empty).
 * Accepts a slots array (may contain nulls, client shape) or a plain
 * cards array (legacy shape, filled left to right).
 */
export function normalizeSlots(input) {
	const raw = Array.isArray(input) ? input : [];
	const slots = [null, null, null];
	raw.slice(0, 3).forEach((card, i) => {
		if (card && typeof card === 'object') slots[i] = card;
	});
	return slots;
}

/**
 * Build the arrange-lane messages from the arrangement + resolved context
 * prompt. Returns [{role:'system'...},{role:'user'...}].
 */
export function buildArrangeMessages(slotsOrCards, contextPrompt) {
	const slots = normalizeSlots(slotsOrCards);
	const slotLines = slots.map((card, i) => renderSlotLine(i, card)).join('\n');

	const userPrompt = `The user has arranged the following cards:

${slotLines}

Context: ${contextPrompt}

Generate a scene or interaction that emerges from these elements meeting. Be specific and evocative. Let the arrangement suggest relationships and dynamics. Surprise the user with possibilities they might not have seen. Their positions in the arrangement frame how they face each other.

Heavier cards should have more gravitational pull in the narrative - they're more present, more affecting.

Keep it to 2-3 paragraphs. End with an image or moment that invites contemplation - something to sit with, not a conclusion.`;

	return [
		{ role: 'system', content: ARRANGE_SYSTEM_PROMPT },
		{ role: 'user', content: userPrompt }
	];
}
