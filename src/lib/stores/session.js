import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Session store - manages conversation state and cards
 * Persists to localStorage automatically
 */

const STORAGE_KEY = 'act-of-imagination-session';

// Default session state
function createDefaultSession() {
	return {
		id: crypto.randomUUID(),
		messages: [],
		cards: [],
		phase: 'CONVERSATION',
		pendingProposal: null,
		isLoading: false,
		error: null,
		createdAt: Date.now(),
		updatedAt: Date.now()
	};
}

// Load session from localStorage
function loadSession() {
	if (!browser) return createDefaultSession();

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Reset transient state
			return {
				...parsed,
				isLoading: false,
				error: null,
				pendingProposal: null,
				// Reset to conversation if was in a modal state
				phase: ['CARD_PROPOSAL', 'TRANSITION'].includes(parsed.phase)
					? 'CONVERSATION'
					: parsed.phase
			};
		}
	} catch (e) {
		console.warn('Failed to load session from localStorage:', e);
	}

	return createDefaultSession();
}

// Save session to localStorage (debounced)
let saveTimeout = null;
function saveSession(state) {
	if (!browser) return;

	// Clear pending save
	if (saveTimeout) clearTimeout(saveTimeout);

	// Debounce saves to avoid excessive writes
	saveTimeout = setTimeout(() => {
		try {
			// Don't persist transient state
			const toSave = {
				id: state.id,
				messages: state.messages,
				cards: state.cards,
				phase: state.phase,
				createdAt: state.createdAt,
				updatedAt: Date.now()
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
		} catch (e) {
			console.warn('Failed to save session to localStorage:', e);
		}
	}, 500);
}

function createSessionStore() {
	const initialState = loadSession();
	const { subscribe, set, update } = writable(initialState);

	// Subscribe to changes and persist
	subscribe(state => {
		saveSession(state);
	});

	return {
		subscribe,

		// Add a user message
		addUserMessage: (content) => {
			update(state => ({
				...state,
				messages: [...state.messages, {
					id: crypto.randomUUID(),
					role: 'user',
					content,
					timestamp: Date.now()
				}],
				updatedAt: Date.now()
			}));
		},

		// Add an assistant message
		addAssistantMessage: (content) => {
			update(state => ({
				...state,
				messages: [...state.messages, {
					id: crypto.randomUUID(),
					role: 'assistant',
					content,
					timestamp: Date.now()
				}],
				updatedAt: Date.now()
			}));
		},

		// Set loading state
		setLoading: (isLoading) => {
			update(state => ({ ...state, isLoading }));
		},

		// Set error
		setError: (error) => {
			update(state => ({ ...state, error }));
		},

		// Process card events from the API
		processCardEvents: (events) => {
			update(state => {
				let newCards = [...state.cards];
				let pendingProposal = state.pendingProposal;
				let phase = state.phase;

				for (const event of events) {
					if (event.event === 'detected') {
						// New card detected - create submerged card
						newCards.push({
							id: crypto.randomUUID(),
							name: null,
							essence: null,
							hint: event.hint,
							type: event.type,
							formationState: 'submerged',
							depth: event.depth,
							createdAt: Date.now(),
							surfacedAt: null,
							sourceExcerpts: [event.excerpt]
						});
					} else if (event.event === 'deepened') {
						// Find and deepen existing card by hint similarity
						const cardIndex = newCards.findIndex(c =>
							c.formationState !== 'surfaced' &&
							(c.hint.toLowerCase().includes(event.hint.toLowerCase().slice(0, 20)) ||
							 event.hint.toLowerCase().includes(c.hint.toLowerCase().slice(0, 20)))
						);
						if (cardIndex !== -1) {
							newCards[cardIndex] = {
								...newCards[cardIndex],
								formationState: 'rising',
								depth: event.depth,
								sourceExcerpts: [...newCards[cardIndex].sourceExcerpts, event.excerpt]
							};
						}
					} else if (event.event === 'proposed') {
						// AI is proposing to name a card - show confirmation UI
						pendingProposal = {
							hint: event.hint,
							name: event.name,
							essence: event.essence,
							type: event.type
						};
						phase = 'CARD_PROPOSAL';
					}
				}

				return {
					...state,
					cards: newCards,
					pendingProposal,
					phase,
					updatedAt: Date.now()
				};
			});
		},

		// User accepts proposed card name
		acceptProposal: (editedName = null, editedEssence = null) => {
			update(state => {
				if (!state.pendingProposal) return state;

				const proposal = state.pendingProposal;
				const finalName = editedName || proposal.name;
				const finalEssence = editedEssence || proposal.essence;

				// Find the card being proposed (by hint match) or create new
				let newCards = [...state.cards];
				const cardIndex = newCards.findIndex(c =>
					c.formationState !== 'surfaced' &&
					(c.hint.toLowerCase().includes(proposal.hint.toLowerCase().slice(0, 20)) ||
					 proposal.hint.toLowerCase().includes(c.hint.toLowerCase().slice(0, 20)))
				);

				if (cardIndex !== -1) {
					// Surface existing card
					newCards[cardIndex] = {
						...newCards[cardIndex],
						name: finalName,
						essence: finalEssence,
						formationState: 'surfaced',
						surfacedAt: Date.now()
					};
				} else {
					// Create new surfaced card
					newCards.push({
						id: crypto.randomUUID(),
						name: finalName,
						essence: finalEssence,
						hint: proposal.hint,
						type: proposal.type,
						formationState: 'surfaced',
						depth: 1.0,
						createdAt: Date.now(),
						surfacedAt: Date.now(),
						sourceExcerpts: []
					});
				}

				// Check if we should transition to arrangement mode
				const surfacedCount = newCards.filter(c => c.formationState === 'surfaced').length;
				const newPhase = surfacedCount >= 3 ? 'TRANSITION' : 'CONVERSATION';

				return {
					...state,
					cards: newCards,
					pendingProposal: null,
					phase: newPhase,
					updatedAt: Date.now()
				};
			});
		},

		// User declines proposed card
		declineProposal: () => {
			update(state => ({
				...state,
				pendingProposal: null,
				phase: 'CONVERSATION'
			}));
		},

		// Move to arrangement play
		enterArrangementPlay: () => {
			update(state => ({
				...state,
				phase: 'ARRANGEMENT_PLAY',
				updatedAt: Date.now()
			}));
		},

		// Continue conversation (decline transition)
		continueConversation: () => {
			update(state => ({
				...state,
				phase: 'CONVERSATION'
			}));
		},

		// Change session phase
		setPhase: (phase) => {
			update(state => ({ ...state, phase }));
		},

		// Reset session (start fresh)
		reset: () => {
			const newSession = createDefaultSession();
			set(newSession);
			// Immediately save the new session
			if (browser) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify({
					id: newSession.id,
					messages: [],
					cards: [],
					phase: 'CONVERSATION',
					createdAt: newSession.createdAt,
					updatedAt: newSession.updatedAt
				}));
			}
		},

		// Clear localStorage completely (for debugging)
		clearStorage: () => {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	};
}

export const session = createSessionStore();

// Derived store: surfaced cards only (for arrangement mode)
export const surfacedCards = derived(session, $session =>
	$session.cards.filter(c => c.formationState === 'surfaced')
);

// Derived store: forming cards (submerged or rising)
export const formingCards = derived(session, $session =>
	$session.cards.filter(c => c.formationState !== 'surfaced')
);

// Derived store: ready for arrangement?
export const canArrange = derived(surfacedCards, $surfaced => $surfaced.length >= 3);

// Derived store: has any content?
export const hasContent = derived(session, $session =>
	$session.messages.length > 0 || $session.cards.length > 0
);
