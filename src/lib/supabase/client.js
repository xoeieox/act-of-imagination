import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

/**
 * Supabase client for Act of Imagination
 *
 * Uses public environment variables that are safe to expose in the browser.
 * The anon key is designed to be public - security is handled by Row Level Security (RLS).
 */

// These are public env vars, safe for client-side
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate env vars are present
function validateEnv() {
	if (!supabaseUrl || !supabaseAnonKey) {
		console.warn('Supabase environment variables not configured. Running in local-only mode.');
		return false;
	}
	return true;
}

// Create client only if env vars are present
let supabase = null;

if (browser && validateEnv()) {
	supabase = createClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			autoRefreshToken: true,
			persistSession: true,
			detectSessionInUrl: true
		}
	});
}

/**
 * Check if Supabase is configured and available
 */
export function isSupabaseConfigured() {
	return supabase !== null;
}

/**
 * Get the Supabase client
 * Returns null if not configured (local-only mode)
 */
export function getSupabase() {
	return supabase;
}

export { supabase };
