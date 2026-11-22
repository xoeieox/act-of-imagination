<script>
	let { card } = $props();

	// Visual properties based on formation state
	const stateStyles = {
		submerged: {
			opacity: 0.4,
			blur: 'blur-sm',
			waterLevel: 90
		},
		rising: {
			opacity: 0.7,
			blur: 'blur-[2px]',
			waterLevel: 50
		},
		surfaced: {
			opacity: 1,
			blur: '',
			waterLevel: 0
		}
	};

	let style = $derived(stateStyles[card.formationState] || stateStyles.submerged);

	// Expansion state for surfaced cards
	let isExpanded = $state(false);

	function toggleExpand() {
		if (card.formationState === 'surfaced') {
			isExpanded = !isExpanded;
		}
	}
</script>

<div
	class="card-container p-4 min-h-[100px] {card.formationState === 'surfaced'
		? 'animate-rise cursor-pointer hover:border-silver-400/40'
		: ''}"
	style="opacity: {style.opacity}"
	onclick={toggleExpand}
	onkeydown={(e) => e.key === 'Enter' && toggleExpand()}
	role={card.formationState === 'surfaced' ? 'button' : 'article'}
	tabindex={card.formationState === 'surfaced' ? 0 : -1}
>
	<!-- Water overlay for non-surfaced cards -->
	{#if card.formationState !== 'surfaced'}
		<div
			class="water-overlay"
			style="background: linear-gradient(
				180deg,
				rgba(15, 15, 26, 0.95) 0%,
				rgba(15, 15, 26, 0.8) {style.waterLevel}%,
				rgba(15, 15, 26, 0.4) 100%
			);"
		></div>
		<div class="shimmer-effect"></div>
	{/if}

	<!-- Card content -->
	<div class="relative z-10 {style.blur}">
		{#if card.formationState === 'surfaced' && card.name}
			<div class="flex items-start justify-between gap-2">
				<h3 class="font-serif text-silver-100 text-lg mb-2">
					{card.name}
				</h3>
				{#if card.sourceExcerpts?.length > 0}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 text-silver-400/40 flex-shrink-0 transition-transform duration-200 {isExpanded
							? 'rotate-180'
							: ''}"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
			</div>
			{#if card.essence}
				<p class="text-silver-300 text-sm">
					{card.essence}
				</p>
			{/if}

			<!-- Expanded content (symmetric expand/collapse,
			     grid-rows transition instead of mount/unmount so exit animates too) -->
			<div class="card-expand" class:open={isExpanded}>
				<div class="card-expand-inner">
					<div class="mt-3 pt-3 border-t border-silver-400/10 space-y-3">
						<!-- Type badge -->
						{#if card.type}
							<div class="flex items-center gap-2">
								<span class="text-silver-400/60 text-xs">Type:</span>
								<span class="px-2 py-0.5 bg-depth-700 text-silver-300 text-xs rounded capitalize">
									{card.type}
								</span>
							</div>
						{/if}

						<!-- Depth explanation -->
						{#if card.depth > 0}
							<div class="flex items-center gap-2">
								<span class="text-silver-400/60 text-xs">Depth:</span>
								<div class="flex space-x-0.5">
									{#each Array(Math.ceil(card.depth * 5)) as _, i}
										<div class="w-1.5 h-1.5 rounded-full bg-silver-400/50"></div>
									{/each}
								</div>
								<span class="text-silver-400/40 text-xs">
									({Math.round(card.depth * 100)}% formed)
								</span>
							</div>
						{/if}

						<!-- Source excerpts -->
						{#if card.sourceExcerpts?.length > 0}
							<div class="space-y-2">
								<span class="text-silver-400/60 text-xs">Sources:</span>
								{#each card.sourceExcerpts as excerpt}
									<blockquote
										class="pl-3 border-l-2 border-silver-400/20 text-silver-400 text-xs italic"
									>
										"{excerpt}"
									</blockquote>
								{/each}
							</div>
						{/if}

						<!-- Original hint if different -->
						{#if card.hint && card.hint !== card.essence}
							<div class="text-silver-400/40 text-xs">
								<span class="text-silver-400/60">First glimpse:</span> "{card.hint}"
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else if card.hint}
			<!-- Hint text that "swims" under the water -->
			<p class="text-silver-400/60 text-sm italic leading-relaxed swimming-text">
				{card.hint}
			</p>
		{:else}
			<!-- Placeholder when no hint yet -->
			<div class="space-y-2">
				<div class="h-4 bg-silver-400/10 rounded animate-pulse w-2/3"></div>
				<div class="h-3 bg-silver-400/5 rounded animate-pulse w-full"></div>
			</div>
		{/if}
	</div>

	<!-- Depth indicator (only show when not expanded for surfaced cards) -->
	{#if card.depth > 0 && !(card.formationState === 'surfaced' && isExpanded)}
		<div class="absolute bottom-2 right-2 flex space-x-0.5">
			{#each Array(Math.ceil(card.depth * 5)) as _, i}
				<div class="w-1.5 h-1.5 rounded-full bg-silver-400/30"></div>
			{/each}
		</div>
	{/if}
</div>
