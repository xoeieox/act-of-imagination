import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase, isSupabaseConfigured } from './client.js';

/**
 * Cards service - manages personal cards
 *
 * Local-first approach:
 * - Cards stored in localStorage for anonymous users
 * - Synced to Supabase for authenticated users
 */

const LOCAL_STORAGE_KEY = 'act-of-imagination-cards';

// Store for cards
function createCardsStore() {
	const { subscribe, set, update } = writable({
		cards: [],
		loading: false,
		error: null
	});

	return {
		subscribe,

		// Load all cards
		async load() {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				let cards = [];

				// Try Supabase first if authenticated
				if (isSupabaseConfigured() && browser) {
					const { data: { user } } = await supabase.auth.getUser();

					if (user) {
						const { data, error } = await supabase
							.from('cards')
							.select('*')
							.eq('user_id', user.id)
							.order('created_at', { ascending: false });

						if (error) {
							console.error('Error loading cards from Supabase:', error);
						} else {
							cards = data.map(c => ({
								id: c.id,
								sessionId: c.session_id,
								name: c.name,
								essence: c.essence,
								hint: c.hint,
								type: c.type,
								formationState: c.formation_state,
								depth: c.depth,
								sourceExcerpts: c.source_excerpts || [],
								createdAt: c.created_at,
								surfacedAt: c.surfaced_at
							}));
						}
					}
				}

				// Fall back to localStorage
				if (cards.length === 0 && browser) {
					const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
					if (stored) {
						try {
							cards = JSON.parse(stored);
						} catch (e) {
							console.warn('Failed to parse stored cards:', e);
						}
					}
				}

				set({ cards, loading: false, error: null });
			} catch (err) {
				console.error('Error loading cards:', err);
				set({ cards: [], loading: false, error: err.message });
			}
		},

		// Add a new card
		async addCard(card) {
			const newCard = {
				id: card.id || crypto.randomUUID(),
				sessionId: card.sessionId || null,
				name: card.name || null,
				essence: card.essence || null,
				hint: card.hint,
				type: card.type,
				formationState: card.formationState || 'submerged',
				depth: card.depth || 0.5,
				sourceExcerpts: card.sourceExcerpts || [],
				createdAt: new Date().toISOString(),
				surfacedAt: card.formationState === 'surfaced' ? new Date().toISOString() : null
			};

			// Update store and localStorage
			update(state => {
				const cards = [newCard, ...state.cards];

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cards));
				}

				return { ...state, cards };
			});

			// Sync to Supabase
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();

				if (user) {
					await supabase
						.from('cards')
						.insert({
							id: newCard.id,
							user_id: user.id,
							session_id: newCard.sessionId,
							name: newCard.name,
							essence: newCard.essence,
							hint: newCard.hint,
							type: newCard.type,
							formation_state: newCard.formationState,
							depth: newCard.depth,
							source_excerpts: newCard.sourceExcerpts
						});
				}
			}

			return newCard;
		},

		// Update a card
		async updateCard(cardId, updates) {
			update(state => {
				const cards = state.cards.map(c => {
					if (c.id !== cardId) return c;

					const updatedCard = { ...c, ...updates };

					// Set surfacedAt if transitioning to surfaced
					if (updates.formationState === 'surfaced' && c.formationState !== 'surfaced') {
						updatedCard.surfacedAt = new Date().toISOString();
					}

					return updatedCard;
				});

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cards));
				}

				return { ...state, cards };
			});

			// Sync to Supabase
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();

				if (user) {
					const supabaseUpdates = {};
					if (updates.name !== undefined) supabaseUpdates.name = updates.name;
					if (updates.essence !== undefined) supabaseUpdates.essence = updates.essence;
					if (updates.hint !== undefined) supabaseUpdates.hint = updates.hint;
					if (updates.formationState !== undefined) supabaseUpdates.formation_state = updates.formationState;
					if (updates.depth !== undefined) supabaseUpdates.depth = updates.depth;
					if (updates.sourceExcerpts !== undefined) supabaseUpdates.source_excerpts = updates.sourceExcerpts;
					if (updates.formationState === 'surfaced') supabaseUpdates.surfaced_at = new Date().toISOString();

					await supabase
						.from('cards')
						.update(supabaseUpdates)
						.eq('id', cardId);
				}
			}
		},

		// Delete a card
		async deleteCard(cardId) {
			update(state => {
				const cards = state.cards.filter(c => c.id !== cardId);

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cards));
				}

				return { ...state, cards };
			});

			// Sync to Supabase
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					await supabase
						.from('cards')
						.delete()
						.eq('id', cardId);
				}
			}
		},

		// Bulk set cards (for migration)
		setCards(cards) {
			set({ cards, loading: false, error: null });

			if (browser) {
				localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cards));
			}
		},

		// Clear store
		clear() {
			set({ cards: [], loading: false, error: null });
		}
	};
}

export const cardsStore = createCardsStore();

// Derived stores
export const cards = derived(cardsStore, $store => $store.cards);
export const cardsLoading = derived(cardsStore, $store => $store.loading);

// Filtered derived stores
export const surfacedCards = derived(cardsStore, $store =>
	$store.cards.filter(c => c.formationState === 'surfaced')
);

export const formingCards = derived(cardsStore, $store =>
	$store.cards.filter(c => c.formationState !== 'surfaced')
);

/**
 * Sync cards to Supabase (for migration)
 */
export async function syncCardsToSupabase(cards) {
	if (!isSupabaseConfigured() || !browser) return;

	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;

	for (const card of cards) {
		try {
			await supabase
				.from('cards')
				.upsert({
					id: card.id,
					user_id: user.id,
					session_id: card.sessionId || null,
					name: card.name,
					essence: card.essence,
					hint: card.hint,
					type: card.type,
					formation_state: card.formationState,
					depth: card.depth,
					source_excerpts: card.sourceExcerpts || [],
					surfaced_at: card.surfacedAt
				});
		} catch (err) {
			console.error('Error syncing card:', err);
		}
	}
}

/**
 * Initialize cards - call on app load
 */
export async function initCards() {
	await cardsStore.load();
}
