<script>
	// Props
	let { iterations = [], onClose = () => {} } = $props();

	// Sort by iteration number
	let sortedIterations = $derived(
		[...iterations].sort((a, b) => a.iterationNumber - b.iterationNumber)
	);

	// Find differences in cards between iterations
	function getCardDifferences() {
		if (iterations.length < 2) return { added: [], removed: [], common: [] };

		const cards1 = new Map(iterations[0].cardSnapshot?.map((c) => [c.id, c]) || []);
		const cards2 = new Map(iterations[1].cardSnapshot?.map((c) => [c.id, c]) || []);

		const added = [];
		const removed = [];
		const common = [];

		cards1.forEach((card, id) => {
			if (cards2.has(id)) {
				common.push(card);
			} else {
				removed.push(card);
			}
		});

		cards2.forEach((card, id) => {
			if (!cards1.has(id)) {
				added.push(card);
			}
		});

		return { added, removed, common };
	}

	let cardDiffs = $derived(getCardDifferences());

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

<!-- Modal backdrop -->
<div
	class="fixed inset-0 bg-depth-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	role="dialog"
	aria-modal="true"
>
	<div
		class="bg-depth-700 border border-silver-400/20 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col animate-rise"
	>
		<!-- Header -->
		<div class="p-4 border-b border-silver-400/10 flex items-center justify-between">
			<h2 class="font-serif text-xl text-silver-100">Compare Iterations</h2>
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

		<!-- Card differences summary -->
		{#if iterations.length === 2}
			<div class="p-3 bg-depth-800/50 border-b border-silver-400/10">
				<div class="flex items-center gap-4 text-xs">
					{#if cardDiffs.removed.length > 0}
						<span class="text-red-400">
							- {cardDiffs.removed.map((c) => c.name).join(', ')}
						</span>
					{/if}
					{#if cardDiffs.added.length > 0}
						<span class="text-emerald-400">
							+ {cardDiffs.added.map((c) => c.name).join(', ')}
						</span>
					{/if}
					{#if cardDiffs.common.length > 0 && (cardDiffs.added.length > 0 || cardDiffs.removed.length > 0)}
						<span class="text-silver-400/60">
							Common: {cardDiffs.common.map((c) => c.name).join(', ')}
						</span>
					{/if}
					{#if cardDiffs.added.length === 0 && cardDiffs.removed.length === 0}
						<span class="text-silver-400/60">Same cards used</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Comparison columns -->
		<div class="flex-1 overflow-auto p-4">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
				{#each sortedIterations as iteration, i (iteration.id)}
					<div
						class="flex flex-col bg-depth-800/30 rounded-xl border border-silver-400/10 overflow-hidden"
					>
						<!-- Iteration header -->
						<div class="p-3 border-b border-silver-400/10 bg-depth-800/50">
							<div class="flex items-center justify-between mb-2">
								<span class="text-silver-200 font-medium">
									#{iteration.iterationNumber}
								</span>
								<span class="text-silver-400/60 text-xs">
									{formatDate(iteration.createdAt)}
								</span>
							</div>

							<!-- Cards -->
							<div class="flex gap-1 flex-wrap mb-2">
								{#each iteration.cardSnapshot || [] as card}
									{@const isRemoved = i === 0 && cardDiffs.removed.some((c) => c.id === card.id)}
									{@const isAdded = i === 1 && cardDiffs.added.some((c) => c.id === card.id)}
									<span
										class="px-1.5 py-0.5 text-xs rounded
										{isRemoved
											? 'bg-red-900/30 text-red-300 border border-red-400/30'
											: isAdded
												? 'bg-emerald-900/30 text-emerald-300 border border-emerald-400/30'
												: 'bg-depth-700 text-silver-400'}"
									>
										{card.name}
									</span>
								{/each}
							</div>

							<!-- Context -->
							<p class="text-silver-400/60 text-xs">
								Context: <span class="text-silver-400">{iteration.contextSnapshot?.label}</span>
							</p>
						</div>

						<!-- Narrative -->
						<div class="flex-1 p-4 overflow-y-auto">
							<p class="text-silver-300 text-sm font-serif whitespace-pre-wrap leading-relaxed">
								{iteration.narrative}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Footer -->
		<div class="p-4 border-t border-silver-400/10">
			<button
				onclick={onClose}
				class="w-full px-4 py-2 rounded-lg font-medium transition-all duration-200
					bg-silver-400/10 text-silver-200 border border-silver-400/30
					hover:bg-silver-400/20"
			>
				Close
			</button>
		</div>
	</div>
</div>
