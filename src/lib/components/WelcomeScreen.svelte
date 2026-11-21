<script>
	import { onMount } from 'svelte';
	import { surfacedCards } from '$lib/stores/session.js';
	import { assemblies, initAssemblies } from '$lib/supabase/assemblies.js';

	// Props
	let {
		onNewSession = () => {},
		onViewAssemblies = () => {},
		onViewCards = () => {},
		onStartArrangement = () => {}
	} = $props();

	let loaded = $state(false);

	onMount(async () => {
		await initAssemblies();
		loaded = true;
	});

	// Stats
	let cardCount = $derived($surfacedCards.length);
	let assemblyCount = $derived($assemblies.length);
	let totalIterations = $derived(
		$assemblies.reduce((sum, a) => sum + (a.iterations?.length || 0), 0)
	);
</script>

<div class="welcome-screen flex flex-col items-center justify-center h-full p-6">
	<div class="max-w-md w-full text-center">
		<!-- Title -->
		<h2 class="font-serif text-2xl text-silver-100 mb-2">Welcome back</h2>
		<p class="text-silver-400 text-sm mb-8"> What would you like to explore today? </p>

		<!-- Quick stats -->
		{#if loaded && (cardCount > 0 || assemblyCount > 0)}
			<div class="flex justify-center gap-6 mb-8">
				{#if cardCount > 0}
					<div class="text-center">
						<p class="text-silver-200 text-2xl font-serif">{cardCount}</p>
						<p class="text-silver-400/60 text-xs">cards</p>
					</div>
				{/if}
				{#if assemblyCount > 0}
					<div class="text-center">
						<p class="text-silver-200 text-2xl font-serif">{assemblyCount}</p>
						<p class="text-silver-400/60 text-xs">assemblies</p>
					</div>
				{/if}
				{#if totalIterations > 0}
					<div class="text-center">
						<p class="text-silver-200 text-2xl font-serif">{totalIterations}</p>
						<p class="text-silver-400/60 text-xs">iterations</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Action buttons -->
		<div class="space-y-3">
			<!-- Primary action: New or Continue -->
			<button
				onclick={onNewSession}
				class="w-full px-6 py-4 rounded-xl font-medium transition-all duration-200
					bg-silver-400/10 text-silver-200 border border-silver-400/30
					hover:bg-silver-400/20 hover:border-silver-400/50 hover:glow-subtle"
			>
				<span class="flex items-center justify-center gap-3">
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
							d="M12 4v16m8-8H4"
						/>
					</svg>
					Start new conversation
				</span>
			</button>

			<!-- Availability ruling 2026-11-21: no card-count lock on the door. -->
			<button
				onclick={onStartArrangement}
				class="w-full px-6 py-4 rounded-xl font-medium transition-all duration-200
						bg-depth-700 text-silver-300 border border-silver-400/20
						hover:border-silver-400/40 hover:text-silver-200"
			>
				<span class="flex items-center justify-center gap-3">
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
					Arrange existing cards
				</span>
			</button>

			<!-- Secondary actions -->
			<div class="flex gap-3 pt-2">
				{#if cardCount > 0}
					<button
						onclick={onViewCards}
						class="flex-1 px-4 py-3 rounded-xl text-sm transition-all duration-200
							bg-depth-800/50 text-silver-400 border border-silver-400/10
							hover:border-silver-400/30 hover:text-silver-300"
					>
						View cards
					</button>
				{/if}

				{#if assemblyCount > 0}
					<button
						onclick={onViewAssemblies}
						class="flex-1 px-4 py-3 rounded-xl text-sm transition-all duration-200
							bg-depth-800/50 text-silver-400 border border-silver-400/10
							hover:border-silver-400/30 hover:text-silver-300"
					>
						View assemblies
					</button>
				{/if}
			</div>
		</div>

		<!-- Hint text -->
		<p class="mt-8 text-silver-400/40 text-xs">
			{#if cardCount === 0}
				Start a conversation to discover the cards within. The arrangement table is open whenever
				you wish.
			{:else if cardCount < 3}
				An arrangement places three cards together. Surface {3 - cardCount} more card{3 -
					cardCount >
				1
					? 's'
					: ''} to weave an interaction - or sit at the table now and converse until they surface.
			{:else}
				Your cards await arrangement.
			{/if}
		</p>
	</div>
</div>
