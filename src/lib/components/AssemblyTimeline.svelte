<script>
	import { assembliesStore, assemblies } from '$lib/supabase/assemblies.js';

	// Props
	let {
		assembly: assemblyProp = null,
		onSelectIteration = () => {},
		onCompare = () => {},
		onClose = () => {}
	} = $props();

	// Get reactive assembly from store to ensure star updates show immediately
	let assembly = $derived($assemblies.find((a) => a.id === assemblyProp?.id) || assemblyProp);

	let selectedIterations = $state(new Set());
	let isCompareMode = $state(false);
	let expandedId = $state(null);
	let filterCardIds = $state(new Set());

	// Get unique cards across all iterations for filtering
	let allCards = $derived(() => {
		if (!assembly?.iterations) return [];
		const cardMap = new Map();
		assembly.iterations.forEach((it) => {
			it.cardSnapshot?.forEach((card) => {
				if (!cardMap.has(card.id)) {
					cardMap.set(card.id, card);
				}
			});
		});
		return Array.from(cardMap.values());
	});

	// Filter iterations by selected cards
	let filteredIterations = $derived(() => {
		if (!assembly?.iterations) return [];
		if (filterCardIds.size === 0) return assembly.iterations;

		return assembly.iterations.filter((it) => {
			const iterationCardIds = new Set(it.cardSnapshot?.map((c) => c.id) || []);
			return Array.from(filterCardIds).every((id) => iterationCardIds.has(id));
		});
	});

	function toggleExpand(id) {
		expandedId = expandedId === id ? null : id;
	}

	function toggleSelect(id) {
		const newSet = new Set(selectedIterations);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIterations = newSet;
	}

	function toggleCardFilter(cardId) {
		const newSet = new Set(filterCardIds);
		if (newSet.has(cardId)) {
			newSet.delete(cardId);
		} else {
			newSet.add(cardId);
		}
		filterCardIds = newSet;
	}

	function clearFilters() {
		filterCardIds = new Set();
	}

	function startCompare() {
		if (selectedIterations.size >= 2) {
			const selected = assembly.iterations.filter((it) => selectedIterations.has(it.id));
			onCompare(selected);
		}
	}

	function exitCompareMode() {
		isCompareMode = false;
		selectedIterations = new Set();
	}

	async function handleStar(iterationId) {
		await assembliesStore.toggleStar(assembly.id, iterationId);
	}

	async function handleDelete(iterationId) {
		if (confirm('Delete this iteration? This cannot be undone.')) {
			await assembliesStore.deleteIteration(assembly.id, iterationId);
		}
	}

	function formatDate(dateStr) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<div class="assembly-timeline h-full flex flex-col">
	<!-- Header -->
	<div class="p-4 border-b border-silver-400/10">
		<div class="flex items-center justify-between mb-2">
			<h3 class="font-serif text-silver-200">{assembly?.title || 'Assembly Timeline'}</h3>
			<button onclick={onClose} class="text-silver-400 hover:text-silver-300 transition-colors">
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
		{#if assembly?.synopsis}
			<p class="text-silver-400 text-sm">{assembly.synopsis}</p>
		{/if}
	</div>

	<!-- Filter by cards -->
	{#if allCards().length > 0}
		<div class="p-3 border-b border-silver-400/10">
			<div class="flex items-center gap-2 flex-wrap">
				<span class="text-silver-400/60 text-xs">Filter by cards:</span>
				{#each allCards() as card (card.id)}
					<button
						onclick={() => toggleCardFilter(card.id)}
						class="px-2 py-1 text-xs rounded transition-all duration-200
							{filterCardIds.has(card.id)
							? 'bg-silver-400/20 text-silver-200 border border-silver-400/40'
							: 'bg-depth-700 text-silver-400 border border-silver-400/10 hover:border-silver-400/30'}"
					>
						{card.name}
					</button>
				{/each}
				{#if filterCardIds.size > 0}
					<button
						onclick={clearFilters}
						class="text-silver-400/60 hover:text-silver-400 text-xs underline"
					>
						Clear
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Compare mode controls -->
	{#if isCompareMode}
		<div
			class="p-3 bg-depth-800/50 border-b border-silver-400/10 flex items-center justify-between"
		>
			<span class="text-silver-400 text-sm">
				{selectedIterations.size} selected
			</span>
			<div class="flex gap-2">
				<button
					onclick={exitCompareMode}
					class="px-3 py-1 text-xs text-silver-400 hover:text-silver-300 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={startCompare}
					disabled={selectedIterations.size < 2}
					class="px-3 py-1 text-xs rounded transition-all duration-200
						{selectedIterations.size >= 2
						? 'bg-silver-400/20 text-silver-200'
						: 'bg-depth-700 text-silver-400/50 cursor-not-allowed'}"
				>
					Compare
				</button>
			</div>
		</div>
	{:else}
		<div class="p-3 border-b border-silver-400/10 flex justify-end">
			<button
				onclick={() => (isCompareMode = true)}
				class="text-silver-400 hover:text-silver-300 text-xs transition-colors"
			>
				Select to compare
			</button>
		</div>
	{/if}

	<!-- Iterations list -->
	<div class="flex-1 overflow-y-auto">
		{#if filteredIterations().length === 0}
			<div class="p-6 text-center">
				<p class="text-silver-400/50 text-sm">No iterations match the filter</p>
			</div>
		{:else}
			<div class="divide-y divide-silver-400/10">
				{#each filteredIterations() as iteration (iteration.id)}
					<div class="iteration-item">
						<!-- Iteration header -->
						<div
							class="p-4 flex items-start gap-3 cursor-pointer hover:bg-depth-700/50 transition-colors"
							onclick={() => toggleExpand(iteration.id)}
							role="button"
							tabindex="0"
						>
							{#if isCompareMode}
								<button
									onclick={(e) => {
										e.stopPropagation();
										toggleSelect(iteration.id);
									}}
									class="mt-1 w-4 h-4 rounded border transition-colors
										{selectedIterations.has(iteration.id)
										? 'bg-silver-400/30 border-silver-400'
										: 'border-silver-400/30 hover:border-silver-400/60'}"
								>
									{#if selectedIterations.has(iteration.id)}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4 text-silver-200"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									{/if}
								</button>
							{/if}

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="text-silver-200 text-sm font-medium">
										#{iteration.iterationNumber}
									</span>
									{#if iteration.isStarred}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4 text-yellow-400"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
											/>
										</svg>
									{/if}
									<span class="text-silver-400/60 text-xs">
										{formatDate(iteration.createdAt)}
									</span>
								</div>

								<!-- Cards used -->
								<div class="flex gap-1 flex-wrap mb-2">
									{#each iteration.cardSnapshot || [] as card}
										<span class="px-1.5 py-0.5 bg-depth-700 text-silver-400 text-xs rounded">
											{card.name}
										</span>
									{/each}
								</div>

								<!-- Context -->
								<p class="text-silver-400/60 text-xs">
									in <span class="text-silver-400"
										>{iteration.contextSnapshot?.label || 'unknown'}</span
									>
								</p>
							</div>

							<!-- Expand indicator -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5 text-silver-400/50 transition-transform duration-200
									{expandedId === iteration.id ? 'rotate-180' : ''}"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>

						<!-- Expanded content -->
						{#if expandedId === iteration.id}
							<div class="px-4 pb-4 animate-rise">
								<!-- Narrative -->
								<div class="p-3 bg-depth-800/50 rounded-xl border border-silver-400/10 mb-3">
									<p class="text-silver-300 text-sm font-serif whitespace-pre-wrap leading-relaxed">
										{iteration.narrative}
									</p>
								</div>

								<!-- Actions -->
								<div class="flex gap-2">
									<button
										onclick={() => handleStar(iteration.id)}
										class="px-3 py-1.5 text-xs rounded transition-all duration-200
											{iteration.isStarred
											? 'bg-yellow-900/30 text-yellow-300 border border-yellow-400/30'
											: 'bg-depth-700 text-silver-400 border border-silver-400/10 hover:border-silver-400/30'}"
									>
										{iteration.isStarred ? 'Unstar' : 'Star'}
									</button>
									<button
										onclick={() => onSelectIteration(iteration)}
										class="px-3 py-1.5 text-xs rounded bg-depth-700 text-silver-400 border border-silver-400/10 hover:border-silver-400/30 transition-all duration-200"
									>
										Load arrangement
									</button>
									<button
										onclick={() => handleDelete(iteration.id)}
										class="px-3 py-1.5 text-xs rounded bg-red-900/20 text-red-400 border border-red-400/20 hover:border-red-400/40 transition-all duration-200"
									>
										Delete
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Summary -->
	<div class="p-3 border-t border-silver-400/10 bg-depth-800/30">
		<p class="text-silver-400/60 text-xs text-center">
			{assembly?.iterations?.length || 0} iterations
			{#if assembly?.iterations?.some((it) => it.isStarred)}
				&middot; {assembly.iterations.filter((it) => it.isStarred).length} starred
			{/if}
		</p>
	</div>
</div>
