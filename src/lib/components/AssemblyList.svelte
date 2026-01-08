<script>
	import { onMount } from 'svelte';
	import { assembliesStore, assemblies, initAssemblies } from '$lib/supabase/assemblies.js';

	// Props
	let {
		onSelectAssembly = () => {},
		onClose = () => {}
	} = $props();

	let loaded = $state(false);
	let searchQuery = $state('');

	onMount(async () => {
		await initAssemblies();
		loaded = true;
	});

	// Filter assemblies by search
	let filteredAssemblies = $derived(() => {
		if (!searchQuery.trim()) return $assemblies;

		const query = searchQuery.toLowerCase();
		return $assemblies.filter(a =>
			a.title?.toLowerCase().includes(query) ||
			a.synopsis?.toLowerCase().includes(query) ||
			a.cards?.some(c => c.name?.toLowerCase().includes(query))
		);
	});

	async function handleDelete(assembly, e) {
		e.stopPropagation();
		if (confirm(`Delete "${assembly.title}"? This will remove all iterations and cannot be undone.`)) {
			await assembliesStore.deleteAssembly(assembly.id);
		}
	}

	function formatDate(dateStr) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="assembly-list h-full flex flex-col">
	<!-- Header -->
	<div class="p-4 border-b border-silver-400/10">
		<div class="flex items-center justify-between mb-3">
			<h3 class="font-serif text-silver-200 text-lg">Saved Assemblies</h3>
			<button
				onclick={onClose}
				class="text-silver-400 hover:text-silver-300 transition-colors"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
				</svg>
			</button>
		</div>

		<!-- Search -->
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search assemblies..."
			class="w-full px-3 py-2 bg-depth-800 border border-silver-400/20 rounded-lg
				text-silver-100 placeholder-silver-400/40 text-sm
				focus:border-silver-400/40 focus:outline-none transition-colors"
		/>
	</div>

	<!-- Assembly list -->
	<div class="flex-1 overflow-y-auto">
		{#if !loaded}
			<div class="p-6 text-center">
				<span class="w-6 h-6 border-2 border-silver-400/30 border-t-silver-400 rounded-full animate-spin inline-block"></span>
			</div>
		{:else if filteredAssemblies().length === 0}
			<div class="p-6 text-center">
				{#if $assemblies.length === 0}
					<p class="text-silver-400/60 text-sm mb-2">No assemblies saved yet</p>
					<p class="text-silver-400/40 text-xs">
						Create an arrangement and save it to see it here.
					</p>
				{:else}
					<p class="text-silver-400/60 text-sm">No assemblies match your search</p>
				{/if}
			</div>
		{:else}
			<div class="divide-y divide-silver-400/10">
				{#each filteredAssemblies() as assembly (assembly.id)}
					<div
						role="button"
						tabindex="0"
						onclick={() => onSelectAssembly(assembly)}
						onkeydown={(e) => e.key === 'Enter' && onSelectAssembly(assembly)}
						class="w-full p-4 text-left hover:bg-depth-700/50 transition-colors group cursor-pointer"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<h4 class="font-serif text-silver-200 mb-1 truncate">
									{assembly.title || 'Untitled'}
								</h4>

								{#if assembly.synopsis}
									<p class="text-silver-400 text-sm mb-2 line-clamp-2">
										{assembly.synopsis}
									</p>
								{/if}

								<!-- Cards preview -->
								<div class="flex gap-1 flex-wrap mb-2">
									{#each assembly.cards?.slice(0, 3) || [] as card}
										<span class="px-1.5 py-0.5 bg-depth-700 text-silver-400 text-xs rounded">
											{card.name}
										</span>
									{/each}
									{#if assembly.cards?.length > 3}
										<span class="text-silver-400/50 text-xs">
											+{assembly.cards.length - 3} more
										</span>
									{/if}
								</div>

								<!-- Meta -->
								<div class="flex items-center gap-3 text-silver-400/60 text-xs">
									<span>{formatDate(assembly.createdAt)}</span>
									<span>{assembly.iterations?.length || 0} iterations</span>
									{#if assembly.iterations?.some(it => it.isStarred)}
										<span class="flex items-center gap-1">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
												<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
											</svg>
											{assembly.iterations.filter(it => it.isStarred).length}
										</span>
									{/if}
								</div>
							</div>

							<!-- Delete button (shows on hover) -->
							<button
								onclick={(e) => handleDelete(assembly, e)}
								class="opacity-0 group-hover:opacity-100 p-2 text-silver-400/50 hover:text-red-400 transition-all duration-200"
								title="Delete assembly"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
									<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Summary -->
	<div class="p-3 border-t border-silver-400/10 bg-depth-800/30">
		<p class="text-silver-400/60 text-xs text-center">
			{$assemblies.length} assemblies
		</p>
	</div>
</div>
