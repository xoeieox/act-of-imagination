<script>
	import { onMount } from 'svelte';
	import { allContexts, contextsStore, initContexts } from '$lib/supabase/contexts.js';

	// Props
	let {
		selected = null,
		onSelect = () => {}
	} = $props();

	let expanded = $state(false);
	let loaded = $state(false);

	onMount(async () => {
		await initContexts();
		loaded = true;
	});

	function handleSelect(context) {
		onSelect(context);
	}

	function toggleExpanded() {
		expanded = !expanded;
	}

	// Show first 4 contexts when collapsed, all when expanded
	let visibleContexts = $derived(
		expanded ? $allContexts : $allContexts.slice(0, 4)
	);

	let hasMore = $derived($allContexts.length > 4);
</script>

<div class="context-deck">
	<!-- Context grid -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
		{#each visibleContexts as context (context.id)}
			<button
				onclick={() => handleSelect(context)}
				class="context-card p-3 rounded-xl text-left transition-all duration-200
					{selected?.id === context.id
						? 'bg-silver-400/20 border-silver-400/40 ring-1 ring-silver-400/30'
						: 'bg-depth-700 border-silver-400/10 hover:border-silver-400/30 hover:bg-depth-600'}
					border"
				title={context.prompt}
			>
				<div class="flex items-start justify-between gap-2">
					<h4 class="font-serif text-silver-200 text-sm leading-tight">
						{context.label}
					</h4>
					{#if !context.isSystem}
						<span class="w-1.5 h-1.5 bg-emerald-400/60 rounded-full flex-shrink-0 mt-1"
							title="Custom context"></span>
					{/if}
				</div>
				<p class="text-silver-400/70 text-xs mt-1 line-clamp-2">
					{context.description}
				</p>
			</button>
		{/each}

		<!-- Create new context card (shown when expanded) -->
		{#if expanded}
			<a
				href="/?mode=create-context"
				class="context-card p-3 rounded-xl text-left transition-all duration-200
					bg-depth-800/50 border-silver-400/10 hover:border-silver-400/30
					border border-dashed flex flex-col items-center justify-center min-h-[80px]"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-silver-400/50 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				<span class="text-silver-400/50 text-xs">Create context</span>
			</a>
		{/if}
	</div>

	<!-- Expand/collapse toggle -->
	{#if hasMore || expanded}
		<button
			onclick={toggleExpanded}
			class="mt-2 text-silver-400/60 hover:text-silver-400 text-xs transition-colors flex items-center gap-1 mx-auto"
		>
			{#if expanded}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
				</svg>
				Show less
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
				Show all {$allContexts.length} contexts
			{/if}
		</button>
	{/if}

	<!-- Selected context details -->
	{#if selected}
		<div class="mt-4 p-3 bg-depth-800/50 rounded-xl border border-silver-400/10">
			<p class="text-silver-400 text-xs italic">
				"{selected.prompt}"
			</p>
		</div>
	{/if}
</div>

<style>
	.context-card {
		min-height: 70px;
	}
</style>
