import { newId } from '$lib/uuid.js';
/**
 * Dev panel presets - test data for quickly populating the UI
 */

export const CARD_TYPES = ['theme', 'figure', 'place', 'tension', 'object'];

export const FORMATION_STATES = ['submerged', 'rising', 'surfaced'];

/**
 * Helper to generate a new card with sensible defaults
 */
export function createCard(overrides = {}) {
	return {
		id: newId(),
		name: null,
		essence: null,
		hint: 'A new shape forming in the depths...',
		type: 'theme',
		formationState: 'submerged',
		depth: 0.3,
		createdAt: Date.now(),
		surfacedAt: null,
		sourceExcerpts: [],
		...overrides
	};
}

export const PRESETS = {
	threeSurfacedCards: {
		name: '3 Surfaced Cards',
		description: 'Ready for arrangement mode',
		cards: [
			{
				name: 'Fear of Change',
				essence: 'A deep resistance to letting go of the familiar, even when it no longer serves',
				hint: 'Something about holding on too tightly',
				type: 'tension',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: ['I always feel anxious when things shift']
			},
			{
				name: 'The Witness',
				essence: 'A part that observes without judgment, holding space for what emerges',
				hint: 'A presence watching from within',
				type: 'figure',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: ['Sometimes I just watch myself react']
			},
			{
				name: 'The Threshold',
				essence: 'The liminal space between what was and what could be',
				hint: 'Standing at a doorway',
				type: 'place',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: ['I feel like I am between two worlds']
			}
		],
		messages: [
			{
				role: 'assistant',
				content:
					'Welcome. This is a space for exploration, where meaning can surface at its own pace.'
			},
			{
				role: 'user',
				content: 'I have been thinking about why I always feel anxious when things change.'
			},
			{
				role: 'assistant',
				content:
					'Change carries weight. What does this anxiety feel like in your body when you notice it?'
			}
		]
	},

	mixedFormationStates: {
		name: 'Mixed States',
		description: 'One of each formation state',
		cards: [
			{
				name: null,
				essence: null,
				hint: 'Something murky about belonging',
				type: 'theme',
				formationState: 'submerged',
				depth: 0.2,
				sourceExcerpts: ['I mentioned feeling out of place']
			},
			{
				name: null,
				essence: null,
				hint: 'A recurring pattern emerging around boundaries',
				type: 'tension',
				formationState: 'rising',
				depth: 0.6,
				sourceExcerpts: ['The pattern keeps showing up', 'Always the same dynamic']
			},
			{
				name: 'Inner Critic',
				essence: 'The voice that judges every action before it is complete',
				hint: 'Self-judgment',
				type: 'figure',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: ['I am always so hard on myself']
			}
		],
		messages: []
	},

	fullConversation: {
		name: 'Full Conversation',
		description: 'Realistic session with history',
		cards: [
			{
				name: null,
				essence: null,
				hint: 'Something stirring around childhood memories',
				type: 'place',
				formationState: 'submerged',
				depth: 0.3,
				sourceExcerpts: ['Reminds me of when I was young']
			},
			{
				name: null,
				essence: null,
				hint: 'A protective part emerging',
				type: 'figure',
				formationState: 'rising',
				depth: 0.7,
				sourceExcerpts: ['I always try to keep everyone safe', 'Taking care of others']
			},
			{
				name: 'The Weight of Expectations',
				essence: 'Carrying what others need us to be, sometimes forgetting our own shape',
				hint: 'Heavy with should-bes',
				type: 'tension',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: ['Everyone expects me to be strong']
			},
			{
				name: 'Hidden Garden',
				essence: 'A private inner world tended in secret, where authentic self can grow',
				hint: 'A place only you know',
				type: 'place',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: ['I have this space I go to in my mind']
			}
		],
		messages: [
			{
				role: 'assistant',
				content:
					'Welcome. This is a space for exploration, where meaning can surface at its own pace. What brings you here today?'
			},
			{
				role: 'user',
				content:
					'I have been feeling overwhelmed lately. Everyone expects me to be strong all the time.'
			},
			{
				role: 'assistant',
				content: 'The weight of expectations can be heavy. What does it feel like to carry that?'
			},
			{
				role: 'user',
				content:
					'Like I am always performing. There is this space I go to in my mind where I can just be myself.'
			},
			{
				role: 'assistant',
				content: 'A hidden garden - a place of refuge. What grows there that cannot grow elsewhere?'
			},
			{
				role: 'user',
				content:
					'Honestly, I think my real feelings grow there. The messy ones I cannot show anyone.'
			}
		]
	},

	emptyState: {
		name: 'Empty State',
		description: 'Fresh start',
		cards: [],
		messages: []
	},

	manyCards: {
		name: 'Many Cards',
		description: 'Stress test with 8 cards',
		cards: [
			{
				name: null,
				essence: null,
				hint: 'Loss lurking below',
				type: 'theme',
				formationState: 'submerged',
				depth: 0.2,
				sourceExcerpts: []
			},
			{
				name: null,
				essence: null,
				hint: 'Old anger surfacing',
				type: 'tension',
				formationState: 'submerged',
				depth: 0.4,
				sourceExcerpts: []
			},
			{
				name: null,
				essence: null,
				hint: 'A younger self watching',
				type: 'figure',
				formationState: 'rising',
				depth: 0.5,
				sourceExcerpts: []
			},
			{
				name: null,
				essence: null,
				hint: 'The house you grew up in',
				type: 'place',
				formationState: 'rising',
				depth: 0.6,
				sourceExcerpts: []
			},
			{
				name: 'The Mask',
				essence: 'What we show the world to stay safe',
				hint: 'False faces',
				type: 'object',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: []
			},
			{
				name: 'Longing',
				essence: 'The ache for what we cannot name',
				hint: 'Unnamed desire',
				type: 'theme',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: []
			},
			{
				name: 'The Guide',
				essence: 'Inner wisdom that knows the way',
				hint: 'A knowing presence',
				type: 'figure',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: []
			},
			{
				name: 'The Crossroads',
				essence: 'Where paths diverge and choices must be made',
				hint: 'Forking paths',
				type: 'place',
				formationState: 'surfaced',
				depth: 1.0,
				sourceExcerpts: []
			}
		],
		messages: []
	}
};
