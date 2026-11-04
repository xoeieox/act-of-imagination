<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { session, hasContent } from '$lib/stores/session.js';
	import { navigation } from '$lib/stores/navigation.js';
	import { auth, initAuth, isAuthenticated, signOut } from '$lib/supabase/auth.js';
	import { isSupabaseConfigured } from '$lib/supabase/client.js';
	import { needsMigration } from '$lib/supabase/migrate.js';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import MigrationPrompt from '$lib/components/MigrationPrompt.svelte';

	let { children } = $props();
	let showConfirm = $state(false);
	let showAuthMenu = $state(false);
	let showMigration = $state(false);
	let checkedMigration = $state(false);

	// Initialize auth on mount
	onMount(() => {
		initAuth();
	});

	// Check for migration when user authenticates
	$effect(() => {
		if ($isAuthenticated && !checkedMigration) {
			checkedMigration = true;
			if (needsMigration()) {
				showMigration = true;
			}
		}
	});

	function handleMigrationComplete() {
		showMigration = false;
	}

	function handleNewSession() {
		if ($hasContent) {
			showConfirm = true;
		} else {
			session.reset();
		}
	}

	function confirmReset() {
		session.reset();
		showConfirm = false;
	}

	function cancelReset() {
		showConfirm = false;
	}

	function toggleAuthMenu() {
		showAuthMenu = !showAuthMenu;
	}

	async function handleSignOut() {
		await signOut();
		showAuthMenu = false;
	}
</script>

<div class="h-screen flex flex-col overflow-hidden">
	<!-- Header -->
	<header class="py-4 px-6 border-b border-silver-400/10 flex items-center justify-between">
		<!-- Left: Hamburger menu button -->
		<div class="w-32 flex items-center">
			<button
				onclick={() => navigation.openMenu()}
				class="p-1 text-silver-400 hover:text-silver-300 transition-colors"
				aria-label="Open menu"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>

			<!-- Sync status indicator -->
			{#if isSupabaseConfigured()}
				<span class="ml-2 flex items-center gap-1 text-silver-400/60 text-xs">
					{#if $auth.loading}
						<span class="w-1.5 h-1.5 bg-silver-400/50 rounded-full"></span>
					{:else if $isAuthenticated}
						<span class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
					{:else}
						<span class="w-1.5 h-1.5 bg-silver-400/30 rounded-full"></span>
					{/if}
				</span>
			{/if}
		</div>

		<h1 class="font-serif text-xl text-silver-100 tracking-wide">
			Act of Imagination
		</h1>

		<div class="w-32 flex justify-end">
			{#if $hasContent}
				<button
					onclick={handleNewSession}
					class="text-silver-400 hover:text-silver-300 text-sm transition-colors"
					title="Start a new session"
				>
					New session
				</button>
			{/if}
		</div>
	</header>

	<!-- Confirmation modal -->
	{#if showConfirm}
		<div class="fixed inset-0 bg-depth-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div class="bg-depth-700 border border-silver-400/20 rounded-2xl max-w-sm w-full p-6 animate-rise">
				<h2 class="font-serif text-lg text-silver-100 mb-2">Start fresh?</h2>
				<p class="text-silver-400 text-sm mb-6">
					This will clear your current conversation and cards. This cannot be undone.
				</p>
				<div class="flex gap-3">
					<button
						onclick={cancelReset}
						class="flex-1 px-4 py-2 rounded-lg
							border border-silver-400/20 text-silver-400
							hover:border-silver-400/40 hover:text-silver-300
							transition-all duration-200"
					>
						Keep exploring
					</button>
					<button
						onclick={confirmReset}
						class="flex-1 px-4 py-2 rounded-lg
							bg-red-900/30 text-red-300 border border-red-400/30
							hover:bg-red-900/50 hover:text-red-200
							transition-all duration-200"
					>
						Start fresh
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Main content -->
	<main class="flex-1 flex overflow-hidden">
		{@render children()}
	</main>
</div>

<!-- Hamburger Menu -->
<HamburgerMenu />

<!-- Migration Prompt -->
{#if showMigration}
	<MigrationPrompt onComplete={handleMigrationComplete} />
{/if}
