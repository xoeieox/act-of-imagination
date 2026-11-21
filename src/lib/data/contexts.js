/**
 * System contexts - situational lenses for examining personal material
 *
 * The four fixed contexts from the design (Act-of-Imagination-Design.md,
 * Arrangement Mode UI: [meeting / conflict / discovery / transformation]).
 * Erah's ruling (2026-11-21, AS-DESIGNED): the system contexts are exactly
 * these four - no user-built condition system.
 */

export const SYSTEM_CONTEXTS = [
	{
		id: 'system-meeting',
		name: 'meeting',
		label: 'Meeting',
		description: 'First contact between elements',
		prompt:
			'These elements are encountering each other for the first time. What happens when they meet? What do they recognize in each other?',
		isSystem: true
	},
	{
		id: 'system-conflict',
		name: 'conflict',
		label: 'Conflict',
		description: 'Forces in tension',
		prompt:
			'These elements are in tension with each other. What is the nature of their conflict? What does each want that the other resists?',
		isSystem: true
	},
	{
		id: 'system-discovery',
		name: 'discovery',
		label: 'Discovery',
		description: 'Something revealed between elements',
		prompt:
			'Something is being revealed between these elements. What hidden truth emerges when they are placed together? What was waiting to be seen?',
		isSystem: true
	},
	{
		id: 'system-transformation',
		name: 'transformation',
		label: 'Transformation',
		description: 'What is changing, what is emerging',
		prompt:
			'One or more of these elements is changing the others. What transformation is occurring? What is being left behind, and what is emerging?',
		isSystem: true
	}
];

/**
 * Get a context by ID or name
 */
export function getSystemContext(idOrName) {
	return SYSTEM_CONTEXTS.find((c) => c.id === idOrName || c.name === idOrName);
}
