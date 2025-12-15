import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase, isSupabaseConfigured } from './client.js';

/**
 * Auth store and helpers for Act of Imagination
 *
 * Local-first approach:
 * - Anonymous users work entirely with localStorage
 * - Authenticated users get Supabase persistence
 * - Migration prompt when user first authenticates
 */

// Auth state store
function createAuthStore() {
	const { subscribe, set, update } = writable({
		user: null,
		session: null,
		loading: true,
		error: null
	});

	return {
		subscribe,

		setUser: (user, session) => {
			update(state => ({ ...state, user, session, loading: false, error: null }));
		},

		setLoading: (loading) => {
			update(state => ({ ...state, loading }));
		},

		setError: (error) => {
			update(state => ({ ...state, error, loading: false }));
		},

		clear: () => {
			set({ user: null, session: null, loading: false, error: null });
		}
	};
}

export const auth = createAuthStore();

// Derived stores for convenience
export const user = derived(auth, $auth => $auth.user);
export const isAuthenticated = derived(auth, $auth => $auth.user !== null);
export const isLoading = derived(auth, $auth => $auth.loading);

/**
 * Initialize auth state listener
 * Call this in +layout.svelte onMount
 */
export async function initAuth() {
	if (!browser || !isSupabaseConfigured()) {
		auth.setLoading(false);
		return;
	}

	try {
		// Get initial session
		const { data: { session }, error } = await supabase.auth.getSession();

		if (error) {
			console.error('Error getting session:', error);
			auth.setError(error.message);
			return;
		}

		if (session) {
			auth.setUser(session.user, session);
		} else {
			auth.setLoading(false);
		}

		// Listen for auth changes
		supabase.auth.onAuthStateChange((event, session) => {
			if (session) {
				auth.setUser(session.user, session);
			} else {
				auth.clear();
			}
		});
	} catch (err) {
		console.error('Auth initialization error:', err);
		auth.setError(err.message);
	}
}

/**
 * Sign up with email and password
 */
export async function signUp(email, password) {
	if (!isSupabaseConfigured()) {
		throw new Error('Supabase is not configured');
	}

	auth.setLoading(true);

	const { data, error } = await supabase.auth.signUp({
		email,
		password
	});

	if (error) {
		auth.setError(error.message);
		throw error;
	}

	// Create profile if user was created
	if (data.user) {
		await createProfile(data.user.id);
	}

	return data;
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
	if (!isSupabaseConfigured()) {
		throw new Error('Supabase is not configured');
	}

	auth.setLoading(true);

	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password
	});

	if (error) {
		auth.setError(error.message);
		throw error;
	}

	return data;
}

/**
 * Sign out
 */
export async function signOut() {
	if (!isSupabaseConfigured()) {
		auth.clear();
		return;
	}

	const { error } = await supabase.auth.signOut();

	if (error) {
		console.error('Sign out error:', error);
		throw error;
	}

	auth.clear();
}

/**
 * Create user profile after signup
 */
async function createProfile(userId) {
	const { error } = await supabase
		.from('profiles')
		.insert({ id: userId });

	if (error && error.code !== '23505') { // Ignore duplicate key error
		console.error('Error creating profile:', error);
	}
}

/**
 * Get current user ID (or null if not authenticated)
 */
export function getCurrentUserId() {
	let userId = null;
	auth.subscribe(state => {
		userId = state.user?.id ?? null;
	})();
	return userId;
}

/**
 * Check if there's local data to migrate
 */
export function hasLocalDataToMigrate() {
	if (!browser) return false;
	const stored = localStorage.getItem('act-of-imagination-session');
	if (!stored) return false;

	try {
		const data = JSON.parse(stored);
		return (data.messages?.length > 0 || data.cards?.length > 0);
	} catch {
		return false;
	}
}
