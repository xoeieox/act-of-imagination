/**
 * System contexts - situational lenses for examining personal material
 *
 * These are the default contexts available to all users.
 * Users can also create their own contexts through conversation.
 */

export const SYSTEM_CONTEXTS = [
	{
		id: 'system-crisis',
		name: 'crisis',
		label: 'Crisis',
		description: 'A moment of urgency and decision',
		prompt: 'These elements are caught in a moment of crisis. What breaks, what holds, what is revealed under pressure?',
		isSystem: true
	},
	{
		id: 'system-solitude',
		name: 'solitude',
		label: 'Solitude',
		description: 'Alone with what matters',
		prompt: 'These elements meet in solitude, away from others. What emerges when there is no audience, no performance required?',
		isSystem: true
	},
	{
		id: 'system-community',
		name: 'community',
		label: 'Community',
		description: 'Among others, seeking belonging',
		prompt: 'These elements exist within a community. How do they relate to belonging, to being seen, to finding their place among others?',
		isSystem: true
	},
	{
		id: 'system-transition',
		name: 'transition',
		label: 'Transition',
		description: 'Between what was and what will be',
		prompt: 'These elements are in transition. What is being left behind? What is approaching? What persists through the change?',
		isSystem: true
	},
	{
		id: 'system-creation',
		name: 'creation',
		label: 'Creation',
		description: 'Making something new',
		prompt: 'These elements participate in an act of creation. What wants to be born? What must be given? What emerges from their collaboration?',
		isSystem: true
	},
	{
		id: 'system-loss',
		name: 'loss',
		label: 'Loss',
		description: 'Facing absence and grief',
		prompt: 'These elements are touched by loss. What has been taken away? What remains? How do they hold the absence?',
		isSystem: true
	},
	{
		id: 'system-waiting',
		name: 'waiting',
		label: 'Waiting',
		description: 'Suspended in anticipation',
		prompt: 'These elements are waiting. For what? What happens in the stillness? What stirs beneath patience?',
		isSystem: true
	},
	{
		id: 'system-conflict',
		name: 'conflict',
		label: 'Conflict',
		description: 'Forces in opposition',
		prompt: 'These elements are in conflict with each other. What is the nature of their opposition? What would resolution require?',
		isSystem: true
	}
];

/**
 * Get a context by ID or name
 */
export function getSystemContext(idOrName) {
	return SYSTEM_CONTEXTS.find(c => c.id === idOrName || c.name === idOrName);
}
