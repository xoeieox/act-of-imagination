import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase, isSupabaseConfigured } from './client.js';
import { SYSTEM_CONTEXTS, getSystemContext } from '$lib/data/contexts.js';
import { newId } from '$lib/uuid.js';

/**
 * Contexts service - manages system and user-created contexts
 *
 * Local-first approach:
 * - System contexts always available from local data
 * - User contexts stored in localStorage for anonymous users
 * - User contexts synced to Supabase for authenticated users
 */

const LOCAL_STORAGE_KEY = 'act-of-imagination-user-contexts';

// Store for user-created contexts
function createContextsStore() {
	const { subscribe, set, update } = writable({
		userContexts: [],
		loading: false,
		error: null
	});

	return {
		subscribe,

		// Load user contexts from localStorage or Supabase
		async load() {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				let userContexts = [];

				// Try Supabase first if authenticated
				if (isSupabaseConfigured() && browser) {
					const {
						data: { user }
					} = await supabase.auth.getUser();

					if (user) {
						const { data, error } = await supabase
							.from('contexts')
							.select('*')
							.eq('user_id', user.id)
							.eq('is_system', false)
							.order('created_at', { ascending: false });

						if (error) {
							console.error('Error loading contexts from Supabase:', error);
						} else {
							userContexts = data.map((c) => ({
								id: c.id,
								name: c.name,
								label: c.label,
								description: c.description,
								prompt: c.prompt,
								isSystem: false,
								createdAt: c.created_at
							}));
						}
					}
				}

				// Fall back to localStorage
				if (userContexts.length === 0 && browser) {
					const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
					if (stored) {
						try {
							userContexts = JSON.parse(stored);
						} catch (e) {
							console.warn('Failed to parse stored contexts:', e);
						}
					}
				}

				set({ userContexts, loading: false, error: null });
			} catch (err) {
				console.error('Error loading contexts:', err);
				set({ userContexts: [], loading: false, error: err.message });
			}
		},

		// Add a new user context
		async addContext(context) {
			const newContext = {
				id: context.id || newId(),
				name: context.name,
				label: context.label,
				description: context.description,
				prompt: context.prompt,
				isSystem: false,
				createdAt: new Date().toISOString()
			};

			// Try Supabase first if authenticated
			if (isSupabaseConfigured() && browser) {
				const {
					data: { user }
				} = await supabase.auth.getUser();

				if (user) {
					const { data, error } = await supabase
						.from('contexts')
						.insert({
							id: newContext.id,
							user_id: user.id,
							name: newContext.name,
							label: newContext.label,
							description: newContext.description,
							prompt: newContext.prompt,
							is_system: false
						})
						.select()
						.single();

					if (error) {
						console.error('Error saving context to Supabase:', error);
						throw error;
					}

					newContext.id = data.id;
				}
			}

			// Update store
			update((state) => {
				const userContexts = [...state.userContexts, newContext];

				// Save to localStorage as backup
				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userContexts));
				}

				return { ...state, userContexts };
			});

			return newContext;
		},

		// Update a user context
		async updateContext(id, updates) {
			// Try Supabase first if authenticated
			if (isSupabaseConfigured() && browser) {
				const {
					data: { user }
				} = await supabase.auth.getUser();

				if (user) {
					const { error } = await supabase
						.from('contexts')
						.update({
							name: updates.name,
							label: updates.label,
							description: updates.description,
							prompt: updates.prompt
						})
						.eq('id', id)
						.eq('user_id', user.id);

					if (error) {
						console.error('Error updating context in Supabase:', error);
						throw error;
					}
				}
			}

			// Update store
			update((state) => {
				const userContexts = state.userContexts.map((c) =>
					c.id === id ? { ...c, ...updates } : c
				);

				// Save to localStorage
				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userContexts));
				}

				return { ...state, userContexts };
			});
		},

		// Delete a user context
		async deleteContext(id) {
			// Try Supabase first if authenticated
			if (isSupabaseConfigured() && browser) {
				const {
					data: { user }
				} = await supabase.auth.getUser();

				if (user) {
					const { error } = await supabase
						.from('contexts')
						.delete()
						.eq('id', id)
						.eq('user_id', user.id);

					if (error) {
						console.error('Error deleting context from Supabase:', error);
						throw error;
					}
				}
			}

			// Update store
			update((state) => {
				const userContexts = state.userContexts.filter((c) => c.id !== id);

				// Save to localStorage
				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userContexts));
				}

				return { ...state, userContexts };
			});
		},

		// Clear store
		clear() {
			set({ userContexts: [], loading: false, error: null });
		}
	};
}

export const contextsStore = createContextsStore();

// Derived store: all contexts (system + user)
export const allContexts = derived(contextsStore, ($store) => {
	return [...SYSTEM_CONTEXTS, ...$store.userContexts];
});

// Derived store: just user contexts
export const userContexts = derived(contextsStore, ($store) => $store.userContexts);

/**
 * Get a context by ID (checks both system and user contexts)
 */
export function getContext(id, userContextsList = []) {
	// Check system contexts first
	const systemContext = getSystemContext(id);
	if (systemContext) return systemContext;

	// Check user contexts
	return userContextsList.find((c) => c.id === id);
}

/**
 * Initialize contexts - call on app load
 */
export async function initContexts() {
	await contextsStore.load();
}
