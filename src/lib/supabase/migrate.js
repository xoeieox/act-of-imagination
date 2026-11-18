import { browser } from '$app/environment';
import { supabase, isSupabaseConfigured } from './client.js';
import { syncCardsToSupabase } from './cards.js';
import { newId } from '$lib/uuid.js';

/**
 * Migration helper - migrates localStorage data to Supabase when user authenticates
 */

const MIGRATION_KEY = 'act-of-imagination-migrated';
const SESSION_KEY = 'act-of-imagination-session';
const CARDS_KEY = 'act-of-imagination-cards';
const ASSEMBLIES_KEY = 'act-of-imagination-assemblies';

/**
 * Check if migration is needed
 */
export function needsMigration() {
	if (!browser) return false;

	// Check if already migrated
	if (localStorage.getItem(MIGRATION_KEY)) return false;

	// Check if there's local data to migrate
	const hasSession = localStorage.getItem(SESSION_KEY);
	const hasCards = localStorage.getItem(CARDS_KEY);
	const hasAssemblies = localStorage.getItem(ASSEMBLIES_KEY);

	return hasSession || hasCards || hasAssemblies;
}

/**
 * Get summary of local data for migration prompt
 */
export function getMigrationSummary() {
	if (!browser) return null;

	let cardCount = 0;
	let messageCount = 0;
	let assemblyCount = 0;

	try {
		const session = localStorage.getItem(SESSION_KEY);
		if (session) {
			const data = JSON.parse(session);
			cardCount = data.cards?.length || 0;
			messageCount = data.messages?.length || 0;
		}

		const assemblies = localStorage.getItem(ASSEMBLIES_KEY);
		if (assemblies) {
			const data = JSON.parse(assemblies);
			assemblyCount = data.length || 0;
		}
	} catch (e) {
		console.warn('Failed to read local data for summary:', e);
	}

	if (cardCount === 0 && messageCount === 0 && assemblyCount === 0) {
		return null;
	}

	return {
		cardCount,
		messageCount,
		assemblyCount
	};
}

/**
 * Migrate all local data to Supabase
 */
export async function migrateToSupabase() {
	if (!browser || !isSupabaseConfigured()) return { success: false, error: 'Not available' };

	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) return { success: false, error: 'Not authenticated' };

	try {
		// Migrate cards
		const cardsJson = localStorage.getItem(CARDS_KEY);
		if (cardsJson) {
			const cards = JSON.parse(cardsJson);
			await syncCardsToSupabase(cards);
		}

		// Migrate session data (current conversation)
		const sessionJson = localStorage.getItem(SESSION_KEY);
		if (sessionJson) {
			const sessionData = JSON.parse(sessionJson);

			// Create a session for the current conversation
			if (sessionData.messages?.length > 0) {
				const sessionId = newId();

				// Create session
				await supabase.from('sessions').insert({
					id: sessionId,
					user_id: user.id,
					title: `Migrated Session - ${new Date().toLocaleDateString()}`
				});

				// Migrate messages
				for (const msg of sessionData.messages) {
					await supabase.from('messages').insert({
						id: msg.id,
						session_id: sessionId,
						role: msg.role,
						content: msg.content
					});
				}

				// Migrate cards from session if not already migrated
				if (sessionData.cards?.length > 0) {
					for (const card of sessionData.cards) {
						try {
							await supabase.from('cards').upsert({
								id: card.id,
								user_id: user.id,
								session_id: sessionId,
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
							console.warn('Card already exists or error:', err);
						}
					}
				}
			}
		}

		// Migrate assemblies
		const assembliesJson = localStorage.getItem(ASSEMBLIES_KEY);
		if (assembliesJson) {
			const assemblies = JSON.parse(assembliesJson);

			for (const assembly of assemblies) {
				try {
					// Create assembly
					await supabase.from('assemblies').insert({
						id: assembly.id,
						user_id: user.id,
						title: assembly.title,
						synopsis: assembly.synopsis
					});

					// Create assembly_cards if we have card references
					if (assembly.cards?.length > 0) {
						const assemblyCards = assembly.cards.map((c, i) => ({
							assembly_id: assembly.id,
							card_id: c.id,
							position: i
						}));

						// Note: This may fail if cards don't exist in the cards table
						// We'll try but ignore errors
						try {
							await supabase.from('assembly_cards').insert(assemblyCards);
						} catch (cardErr) {
							console.warn('Could not link assembly cards:', cardErr);
						}
					}

					// Create iterations
					if (assembly.iterations?.length > 0) {
						for (const iteration of assembly.iterations) {
							await supabase.from('assembly_iterations').insert({
								id: iteration.id,
								assembly_id: assembly.id,
								iteration_number: iteration.iterationNumber,
								narrative: iteration.narrative,
								card_snapshot: iteration.cardSnapshot,
								context_snapshot: iteration.contextSnapshot,
								is_starred: iteration.isStarred || false
							});
						}
					}
				} catch (err) {
					console.warn('Error migrating assembly:', err);
				}
			}
		}

		// Mark as migrated
		localStorage.setItem(MIGRATION_KEY, new Date().toISOString());

		return { success: true };
	} catch (err) {
		console.error('Migration error:', err);
		return { success: false, error: err.message };
	}
}

/**
 * Skip migration and mark as done
 */
export function skipMigration() {
	if (browser) {
		localStorage.setItem(MIGRATION_KEY, 'skipped');
	}
}

/**
 * Clear migration flag (for testing)
 */
export function resetMigration() {
	if (browser) {
		localStorage.removeItem(MIGRATION_KEY);
	}
}
