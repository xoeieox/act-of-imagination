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
</script>

<div
	class="card-container p-4 min-h-[100px] {card.formationState === 'surfaced' ? 'animate-rise' : ''}"
	style="opacity: {style.opacity}"
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
			<h3 class="font-serif text-silver-100 text-lg mb-2">
				{card.name}
			</h3>
			{#if card.essence}
				<p class="text-silver-300 text-sm">
					{card.essence}
				</p>
			{/if}
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

	<!-- Depth indicator -->
	{#if card.depth > 0}
		<div class="absolute bottom-2 right-2 flex space-x-0.5">
			{#each Array(Math.ceil(card.depth * 5)) as _, i}
				<div class="w-1.5 h-1.5 rounded-full bg-silver-400/30"></div>
			{/each}
		</div>
	{/if}
</div>
