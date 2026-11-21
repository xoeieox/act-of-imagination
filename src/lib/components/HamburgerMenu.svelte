<script>
	import { goto } from '$app/navigation';
	import { session, surfacedCards } from '$lib/stores/session.js';
	import { navigation } from '$lib/stores/navigation.js';
	import { assemblies } from '$lib/supabase/assemblies.js';
	import { isAuthenticated, signOut } from '$lib/supabase/auth.js';
	import { isSupabaseConfigured } from '$lib/supabase/client.js';
	// aoi-motion 2026-11-17: menu enters ~320ms, exits ~200ms (slide back a
	// touch faster than it came out, per Erah).
	import { fade, fly } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';

	let cardCount = $derived($surfacedCards.length);
	let assemblyCount = $derived($assemblies.length);

	function handleNavigate(view) {
		switch (view) {
			case 'home':
				navigation.showHome();
				goto('/');
				break;
			case 'conversation':
				navigation.clearView();
				goto('/');
				break;
			case 'cards':
				navigation.showCards();
				break;
			case 'assemblies':
				navigation.showAssemblies();
				break;
			case 'arrangement':
				navigation.closeMenu();
				session.enterArrangementPlay();
				break;
			default:
				navigation.closeMenu();
		}
	}

	async function handleSignOut() {
		await signOut();
		navigation.closeMenu();
	}

	// Close on escape key
	function handleKeydown(e) {
		if (e.key === 'Escape' && $navigation.menuOpen) {
			navigation.closeMenu();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $navigation.menuOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-depth-900/60 backdrop-blur-sm z-40"
		onclick={() => navigation.closeMenu()}
		role="button"
		tabindex="-1"
		in:fade={{ duration: 400 }}
		out:fade={{ duration: 260 }}
	></div>

	<!-- Menu panel -->
	<div
		class="fixed left-0 top-0 h-full w-72 bg-depth-800 border-r border-silver-400/20 z-50 flex flex-col"
		in:fly={{ x: -28, duration: 480, easing: cubicOut }}
		out:fly={{ x: -28, duration: 300, easing: cubicIn }}
	>
		<!-- Header -->
		<div class="p-4 border-b border-silver-400/10 flex items-center justify-between">
			<h2 class="font-serif text-silver-200">Act of Imagination</h2>
			<button
				onclick={() => navigation.closeMenu()}
				class="text-silver-400 hover:text-silver-300 transition-colors"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>

		<!-- Navigation items -->
		<nav class="flex-1 py-2">
			<button
				onclick={() => handleNavigate('home')}
				class="w-full px-4 py-3 flex items-center gap-3 text-silver-300 hover:text-silver-100 hover:bg-depth-700/50 transition-colors"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
					/>
				</svg>
				Home
			</button>

			<button
				onclick={() => handleNavigate('conversation')}
				class="w-full px-4 py-3 flex items-center gap-3 text-silver-300 hover:text-silver-100 hover:bg-depth-700/50 transition-colors"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
					/>
				</svg>
				Conversation
			</button>

			<button
				onclick={() => handleNavigate('cards')}
				class="w-full px-4 py-3 flex items-center justify-between text-silver-300 hover:text-silver-100 hover:bg-depth-700/50 transition-colors"
			>
				<span class="flex items-center gap-3">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
					Cards
				</span>
				{#if cardCount > 0}
					<span class="px-2 py-0.5 bg-depth-700 text-silver-400 text-xs rounded-full">
						{cardCount}
					</span>
				{/if}
			</button>

			<button
				onclick={() => handleNavigate('assemblies')}
				class="w-full px-4 py-3 flex items-center justify-between text-silver-300 hover:text-silver-100 hover:bg-depth-700/50 transition-colors"
			>
				<span class="flex items-center gap-3">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
						/>
					</svg>
					Assemblies
				</span>
				{#if assemblyCount > 0}
					<span class="px-2 py-0.5 bg-depth-700 text-silver-400 text-xs rounded-full">
						{assemblyCount}
					</span>
				{/if}
			</button>

			<!-- Availability ruling 2026-11-21: the arrangement table is always open. -->
			<div class="my-2 mx-4 border-t border-silver-400/10"></div>

			<button
				onclick={() => handleNavigate('arrangement')}
				class="w-full px-4 py-3 flex items-center gap-3 text-silver-300 hover:text-silver-100 hover:bg-depth-700/50 transition-colors"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				Arrange cards
			</button>
		</nav>

		<!-- Auth section -->
		<div class="border-t border-silver-400/10 p-4">
			{#if isSupabaseConfigured()}
				{#if $isAuthenticated}
					<button
						onclick={handleSignOut}
						class="w-full px-4 py-2 flex items-center gap-3 text-silver-400 hover:text-silver-300 transition-colors"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
							/>
						</svg>
						Sign out
					</button>
				{:else}
					<a
						href="/auth"
						onclick={() => navigation.closeMenu()}
						class="w-full px-4 py-2 flex items-center gap-3 text-silver-400 hover:text-silver-300 transition-colors"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
							/>
						</svg>
						Sign in to sync
					</a>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	/* aoi-motion 2026-11-17: slide-in keyframes retired in favour of
	   svelte in:/out:fly transitions (symmetric enter/exit). */
</style>
