import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase, isSupabaseConfigured } from './client.js';

/**
 * Assemblies service - manages saved arrangements and iterations
 *
 * Local-first approach:
 * - Assemblies stored in localStorage for anonymous users
 * - Synced to Supabase for authenticated users
 */

const LOCAL_STORAGE_KEY = 'act-of-imagination-assemblies';

// Store for assemblies
function createAssembliesStore() {
	const { subscribe, set, update } = writable({
		assemblies: [],
		loading: false,
		error: null
	});

	return {
		subscribe,

		// Load assemblies
		async load() {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				let assemblies = [];

				// Try Supabase first if authenticated
				if (isSupabaseConfigured() && browser) {
					const { data: { user } } = await supabase.auth.getUser();

					if (user) {
						const { data, error } = await supabase
							.from('assemblies')
							.select(`
								*,
								assembly_cards (
									card_id,
									position,
									cards (id, name, essence, type)
								),
								assembly_iterations (
									id,
									iteration_number,
									narrative,
									card_snapshot,
									context_snapshot,
									is_starred,
									created_at
								)
							`)
							.eq('user_id', user.id)
							.order('updated_at', { ascending: false });

						if (error) {
							console.error('Error loading assemblies from Supabase:', error);
						} else {
							assemblies = data.map(a => ({
								id: a.id,
								title: a.title,
								synopsis: a.synopsis,
								cards: a.assembly_cards
									.sort((x, y) => x.position - y.position)
									.map(ac => ac.cards),
								iterations: a.assembly_iterations.sort((x, y) => x.iteration_number - y.iteration_number),
								createdAt: a.created_at,
								updatedAt: a.updated_at
							}));
						}
					}
				}

				// Fall back to localStorage
				if (assemblies.length === 0 && browser) {
					const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
					if (stored) {
						try {
							assemblies = JSON.parse(stored);
						} catch (e) {
							console.warn('Failed to parse stored assemblies:', e);
						}
					}
				}

				set({ assemblies, loading: false, error: null });
			} catch (err) {
				console.error('Error loading assemblies:', err);
				set({ assemblies: [], loading: false, error: err.message });
			}
		},

		// Save a new assembly
		async saveAssembly({ title, synopsis, cards, context, narrative }) {
			const assembly = {
				id: crypto.randomUUID(),
				title: title || generateDefaultTitle(cards),
				synopsis,
				cards: cards.map((c, i) => ({
					id: c.id,
					name: c.name,
					essence: c.essence,
					type: c.type,
					position: i
				})),
				iterations: [{
					id: crypto.randomUUID(),
					iterationNumber: 1,
					narrative,
					cardSnapshot: cards.map((c, i) => ({
						id: c.id,
						name: c.name,
						essence: c.essence,
						position: i
					})),
					contextSnapshot: {
						id: context.id,
						name: context.name,
						label: context.label,
						prompt: context.prompt
					},
					isStarred: false,
					createdAt: new Date().toISOString()
				}],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			// Try Supabase first if authenticated
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();

				if (user) {
					try {
						// Create assembly
						const { data: assemblyData, error: assemblyError } = await supabase
							.from('assemblies')
							.insert({
								id: assembly.id,
								user_id: user.id,
								title: assembly.title,
								synopsis: assembly.synopsis
							})
							.select()
							.single();

						if (assemblyError) throw assemblyError;

						// Create assembly_cards
						const assemblyCards = cards.map((c, i) => ({
							assembly_id: assembly.id,
							card_id: c.id,
							position: i
						}));

						const { error: cardsError } = await supabase
							.from('assembly_cards')
							.insert(assemblyCards);

						if (cardsError) {
							console.error('Error saving assembly cards:', cardsError);
							// Continue - assembly was created
						}

						// Create first iteration
						const { error: iterationError } = await supabase
							.from('assembly_iterations')
							.insert({
								id: assembly.iterations[0].id,
								assembly_id: assembly.id,
								iteration_number: 1,
								context_id: context.id?.startsWith('system-') ? null : context.id,
								narrative,
								card_snapshot: assembly.iterations[0].cardSnapshot,
								context_snapshot: assembly.iterations[0].contextSnapshot,
								is_starred: false
							});

						if (iterationError) {
							console.error('Error saving iteration:', iterationError);
						}
					} catch (err) {
						console.error('Error saving assembly to Supabase:', err);
						// Continue to save locally
					}
				}
			}

			// Update store and localStorage
			update(state => {
				const assemblies = [assembly, ...state.assemblies];

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(assemblies));
				}

				return { ...state, assemblies };
			});

			return assembly;
		},

		// Add an iteration to an existing assembly
		async addIteration(assemblyId, { context, narrative, cards }) {
			let newIteration = null;

			update(state => {
				const assemblies = state.assemblies.map(a => {
					if (a.id !== assemblyId) return a;

					const iterationNumber = a.iterations.length + 1;
					newIteration = {
						id: crypto.randomUUID(),
						iterationNumber,
						narrative,
						cardSnapshot: cards.map((c, i) => ({
							id: c.id,
							name: c.name,
							essence: c.essence,
							position: i
						})),
						contextSnapshot: {
							id: context.id,
							name: context.name,
							label: context.label,
							prompt: context.prompt
						},
						isStarred: false,
						createdAt: new Date().toISOString()
					};

					return {
						...a,
						iterations: [...a.iterations, newIteration],
						updatedAt: new Date().toISOString()
					};
				});

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(assemblies));
				}

				return { ...state, assemblies };
			});

			// Sync to Supabase if authenticated
			if (newIteration && isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();

				if (user) {
					await supabase
						.from('assembly_iterations')
						.insert({
							id: newIteration.id,
							assembly_id: assemblyId,
							iteration_number: newIteration.iterationNumber,
							context_id: context.id?.startsWith('system-') ? null : context.id,
							narrative,
							card_snapshot: newIteration.cardSnapshot,
							context_snapshot: newIteration.contextSnapshot,
							is_starred: false
						});

					await supabase
						.from('assemblies')
						.update({ updated_at: new Date().toISOString() })
						.eq('id', assemblyId);
				}
			}

			return newIteration;
		},

		// Toggle star on an iteration
		async toggleStar(assemblyId, iterationId) {
			let newStarred = false;

			update(state => {
				const assemblies = state.assemblies.map(a => {
					if (a.id !== assemblyId) return a;

					return {
						...a,
						iterations: a.iterations.map(it => {
							if (it.id !== iterationId) return it;
							newStarred = !it.isStarred;
							return { ...it, isStarred: newStarred };
						})
					};
				});

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(assemblies));
				}

				return { ...state, assemblies };
			});

			// Sync to Supabase
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					await supabase
						.from('assembly_iterations')
						.update({ is_starred: newStarred })
						.eq('id', iterationId);
				}
			}
		},

		// Delete an iteration
		async deleteIteration(assemblyId, iterationId) {
			update(state => {
				const assemblies = state.assemblies.map(a => {
					if (a.id !== assemblyId) return a;

					return {
						...a,
						iterations: a.iterations.filter(it => it.id !== iterationId)
					};
				});

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(assemblies));
				}

				return { ...state, assemblies };
			});

			// Sync to Supabase
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					await supabase
						.from('assembly_iterations')
						.delete()
						.eq('id', iterationId);
				}
			}
		},

		// Delete an assembly
		async deleteAssembly(assemblyId) {
			update(state => {
				const assemblies = state.assemblies.filter(a => a.id !== assemblyId);

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(assemblies));
				}

				return { ...state, assemblies };
			});

			// Sync to Supabase
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					await supabase
						.from('assemblies')
						.delete()
						.eq('id', assemblyId);
				}
			}
		},

		// Get a single assembly by ID
		getById(id) {
			let assembly = null;
			this.subscribe(state => {
				assembly = state.assemblies.find(a => a.id === id);
			})();
			return assembly;
		},

		// Clear store
		clear() {
			set({ assemblies: [], loading: false, error: null });
		}
	};
}

// Generate a default title from card names
function generateDefaultTitle(cards) {
	if (cards.length === 0) return 'Untitled Assembly';
	if (cards.length === 1) return cards[0].name;
	if (cards.length === 2) return `${cards[0].name} & ${cards[1].name}`;
	return `${cards[0].name}, ${cards[1].name} & ${cards.length - 2} more`;
}

export const assembliesStore = createAssembliesStore();

// Derived stores
export const assemblies = derived(assembliesStore, $store => $store.assemblies);
export const assembliesLoading = derived(assembliesStore, $store => $store.loading);

/**
 * Initialize assemblies - call on app load
 */
export async function initAssemblies() {
	await assembliesStore.load();
}
