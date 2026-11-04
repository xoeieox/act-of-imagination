<script>
	import { surfacedCards, formingCards } from '$lib/stores/session.js';

	// Props
	let {
		onClose = () => {}
	} = $props();

	let searchQuery = $state('');
	let filterType = $state('all');

	// Card types
	const cardTypes = ['all', 'theme', 'figure', 'place', 'tension', 'object'];

	// Filter cards
	let filteredCards = $derived(() => {
		let cards = $surfacedCards;

		if (filterType !== 'all') {
			cards = cards.filter(c => c.type === filterType);
		}

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			cards = cards.filter(c =>
				c.name?.toLowerCase().includes(query) ||
				c.essence?.toLowerCase().includes(query)
			);
		}

		return cards;
	});

	// Group by type
	let cardsByType = $derived(() => {
		const groups = {};
		$surfacedCards.forEach(card => {
			const type = card.type || 'other';
			if (!groups[type]) groups[type] = [];
			groups[type].push(card);
		});
		return groups;
	});

	function getTypeLabel(type) {
		const labels = {
			theme: 'Themes',
			figure: 'Figures',
			place: 'Places',
			tension: 'Tensions',
			object: 'Objects',
			other: 'Other'
		};
		return labels[type] || type;
	}

	function getTypeColor(type) {
		const colors = {
			theme: 'text-purple-400',
			figure: 'text-blue-400',
			place: 'text-emerald-400',
			tension: 'text-red-400',
			object: 'text-yellow-400'
		};
		return colors[type] || 'text-silver-400';
	}
</script>

<div class="card-library h-full flex flex-col">
	<!-- Header -->
	<div class="p-4 border-b border-silver-400/10">
		<div class="flex items-center justify-between mb-3">
			<h3 class="font-serif text-silver-200 text-lg">Your Cards</h3>
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
			placeholder="Search cards..."
			class="w-full px-3 py-2 bg-depth-800 border border-silver-400/20 rounded-lg
				text-silver-100 placeholder-silver-400/40 text-sm mb-3
				focus:border-silver-400/40 focus:outline-none transition-colors"
		/>

		<!-- Type filter -->
		<div class="flex gap-2 flex-wrap">
			{#each cardTypes as type}
				<button
					onclick={() => filterType = type}
					class="px-3 py-1 text-xs rounded-lg transition-all duration-200
						{filterType === type
							? 'bg-silver-400/20 text-silver-200 border border-silver-400/40'
							: 'bg-depth-700 text-silver-400 border border-silver-400/10 hover:border-silver-400/30'}"
				>
					{type === 'all' ? 'All' : getTypeLabel(type)}
				</button>
			{/each}
		</div>
	</div>

	<!-- Cards list -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if $surfacedCards.length === 0}
			<div class="text-center py-8">
				<p class="text-silver-400/60 text-sm mb-2">No cards surfaced yet</p>
				<p class="text-silver-400/40 text-xs">
					Start a conversation to discover the cards within.
				</p>
			</div>
		{:else if filteredCards().length === 0}
			<div class="text-center py-8">
				<p class="text-silver-400/60 text-sm">No cards match your search</p>
			</div>
		{:else}
			<div class="grid gap-3">
				{#each filteredCards() as card (card.id)}
					<div class="card-item p-4 bg-depth-700 border border-silver-400/10 rounded-xl hover:border-silver-400/30 transition-colors">
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h4 class="font-serif text-silver-200">{card.name}</h4>
									<span class="text-xs {getTypeColor(card.type)}">
										{card.type}
									</span>
								</div>
								<p class="text-silver-400 text-sm">
									{card.essence}
								</p>
							</div>

							<!-- Depth indicator -->
							{#if card.depth}
								<div class="flex flex-col items-center gap-1">
									<div class="w-2 h-8 bg-depth-800 rounded-full overflow-hidden">
										<div
											class="w-full bg-silver-400/30 rounded-full transition-all"
											style="height: {card.depth * 100}%"
										></div>
									</div>
									<span class="text-silver-400/40 text-xs">{Math.round(card.depth * 100)}%</span>
								</div>
							{/if}
						</div>

						<!-- Source excerpts (collapsed) -->
						{#if card.sourceExcerpts?.length > 0}
							<details class="mt-3">
								<summary class="text-silver-400/60 text-xs cursor-pointer hover:text-silver-400 transition-colors">
									{card.sourceExcerpts.length} source excerpt{card.sourceExcerpts.length > 1 ? 's' : ''}
								</summary>
								<div class="mt-2 space-y-2">
									{#each card.sourceExcerpts as excerpt}
										<p class="text-silver-400/80 text-xs italic pl-3 border-l border-silver-400/20">
											"{excerpt}"
										</p>
									{/each}
								</div>
							</details>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Forming cards section -->
		{#if $formingCards.length > 0}
			<div class="mt-6">
				<h4 class="text-silver-400/60 text-xs uppercase tracking-wider mb-3">Still forming...</h4>
				<div class="space-y-2">
					{#each $formingCards as card (card.id)}
						<div class="p-3 bg-depth-800/50 border border-silver-400/10 rounded-lg opacity-60">
							<p class="text-silver-400 text-sm italic">{card.hint}</p>
							<div class="flex items-center gap-2 mt-1">
								<span class="text-silver-400/40 text-xs">{card.formationState}</span>
								<span class="text-silver-400/40 text-xs">&middot;</span>
								<span class="text-silver-400/40 text-xs">{card.type}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Summary -->
	<div class="p-3 border-t border-silver-400/10 bg-depth-800/30">
		<div class="flex justify-center gap-4 text-silver-400/60 text-xs">
			<span>{$surfacedCards.length} surfaced</span>
			{#if $formingCards.length > 0}
				<span>&middot;</span>
				<span>{$formingCards.length} forming</span>
			{/if}
		</div>
	</div>
</div>
