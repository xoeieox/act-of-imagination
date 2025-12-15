import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase, isSupabaseConfigured } from './client.js';

/**
 * Sessions service - manages conversation sessions and messages
 *
 * Local-first approach:
 * - Sessions stored in localStorage for anonymous users
 * - Synced to Supabase for authenticated users
 */

const LOCAL_STORAGE_KEY = 'act-of-imagination-sessions';

// Store for sessions list
function createSessionsStore() {
	const { subscribe, set, update } = writable({
		sessions: [],
		currentSessionId: null,
		loading: false,
		error: null
	});

	return {
		subscribe,

		// Load all sessions
		async load() {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				let sessions = [];

				// Try Supabase first if authenticated
				if (isSupabaseConfigured() && browser) {
					const { data: { user } } = await supabase.auth.getUser();

					if (user) {
						const { data, error } = await supabase
							.from('sessions')
							.select('*')
							.eq('user_id', user.id)
							.order('updated_at', { ascending: false });

						if (error) {
							console.error('Error loading sessions from Supabase:', error);
						} else {
							sessions = data.map(s => ({
								id: s.id,
								title: s.title,
								createdAt: s.created_at,
								updatedAt: s.updated_at
							}));
						}
					}
				}

				// Fall back to localStorage
				if (sessions.length === 0 && browser) {
					const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
					if (stored) {
						try {
							sessions = JSON.parse(stored);
						} catch (e) {
							console.warn('Failed to parse stored sessions:', e);
						}
					}
				}

				set({ sessions, currentSessionId: null, loading: false, error: null });
			} catch (err) {
				console.error('Error loading sessions:', err);
				set({ sessions: [], currentSessionId: null, loading: false, error: err.message });
			}
		},

		// Create a new session
		async createSession(title = null) {
			const session = {
				id: crypto.randomUUID(),
				title: title || `Session ${new Date().toLocaleDateString()}`,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			// Try Supabase first if authenticated
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();

				if (user) {
					try {
						const { error } = await supabase
							.from('sessions')
							.insert({
								id: session.id,
								user_id: user.id,
								title: session.title
							});

						if (error) {
							console.error('Error creating session in Supabase:', error);
						}
					} catch (err) {
						console.error('Error creating session:', err);
					}
				}
			}

			// Update store and localStorage
			update(state => {
				const sessions = [session, ...state.sessions];

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
				}

				return { ...state, sessions, currentSessionId: session.id };
			});

			return session;
		},

		// Update session title
		async updateTitle(sessionId, title) {
			update(state => {
				const sessions = state.sessions.map(s =>
					s.id === sessionId
						? { ...s, title, updatedAt: new Date().toISOString() }
						: s
				);

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
				}

				return { ...state, sessions };
			});

			// Sync to Supabase
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					await supabase
						.from('sessions')
						.update({ title, updated_at: new Date().toISOString() })
						.eq('id', sessionId);
				}
			}
		},

		// Delete a session
		async deleteSession(sessionId) {
			update(state => {
				const sessions = state.sessions.filter(s => s.id !== sessionId);

				if (browser) {
					localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
				}

				return {
					...state,
					sessions,
					currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId
				};
			});

			// Sync to Supabase
			if (isSupabaseConfigured() && browser) {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					await supabase
						.from('sessions')
						.delete()
						.eq('id', sessionId);
				}
			}
		},

		// Set current session
		setCurrentSession(sessionId) {
			update(state => ({ ...state, currentSessionId: sessionId }));
		},

		// Clear store
		clear() {
			set({ sessions: [], currentSessionId: null, loading: false, error: null });
		}
	};
}

export const sessionsStore = createSessionsStore();

// Derived stores
export const sessions = derived(sessionsStore, $store => $store.sessions);
export const currentSessionId = derived(sessionsStore, $store => $store.currentSessionId);
export const sessionsLoading = derived(sessionsStore, $store => $store.loading);

/**
 * Messages service for a specific session
 */
export async function loadMessages(sessionId) {
	if (!sessionId) return [];

	// Try Supabase first if authenticated
	if (isSupabaseConfigured() && browser) {
		const { data: { user } } = await supabase.auth.getUser();

		if (user) {
			const { data, error } = await supabase
				.from('messages')
				.select('*')
				.eq('session_id', sessionId)
				.order('created_at', { ascending: true });

			if (!error && data) {
				return data.map(m => ({
					id: m.id,
					role: m.role,
					content: m.content,
					createdAt: m.created_at
				}));
			}
		}
	}

	// Fall back to localStorage
	if (browser) {
		const key = `act-of-imagination-messages-${sessionId}`;
		const stored = localStorage.getItem(key);
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch (e) {
				console.warn('Failed to parse stored messages:', e);
			}
		}
	}

	return [];
}

export async function saveMessage(sessionId, message) {
	if (!sessionId) return;

	// Save to localStorage immediately
	if (browser) {
		const key = `act-of-imagination-messages-${sessionId}`;
		const stored = localStorage.getItem(key);
		const messages = stored ? JSON.parse(stored) : [];
		messages.push(message);
		localStorage.setItem(key, JSON.stringify(messages));
	}

	// Sync to Supabase
	if (isSupabaseConfigured() && browser) {
		const { data: { user } } = await supabase.auth.getUser();

		if (user) {
			await supabase
				.from('messages')
				.insert({
					id: message.id,
					session_id: sessionId,
					role: message.role,
					content: message.content
				});

			// Update session timestamp
			await supabase
				.from('sessions')
				.update({ updated_at: new Date().toISOString() })
				.eq('id', sessionId);
		}
	}
}

export async function deleteMessages(sessionId) {
	if (!sessionId) return;

	// Clear localStorage
	if (browser) {
		const key = `act-of-imagination-messages-${sessionId}`;
		localStorage.removeItem(key);
	}

	// Sync to Supabase
	if (isSupabaseConfigured() && browser) {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			await supabase
				.from('messages')
				.delete()
				.eq('session_id', sessionId);
		}
	}
}

/**
 * Initialize sessions - call on app load
 */
export async function initSessions() {
	await sessionsStore.load();
}
