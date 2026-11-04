<script>
	import { session, surfacedCards } from '$lib/stores/session.js';

	function enterArrangement() {
		session.enterArrangementPlay();
	}

	function continueConversation() {
		session.continueConversation();
	}
</script>

<!-- Subtle overlay -->
<div class="fixed inset-0 bg-depth-900/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
	<div class="bg-depth-700 border border-silver-400/20 rounded-2xl max-w-lg w-full p-6 animate-rise">
		<!-- Header -->
		<h2 class="font-serif text-xl text-silver-100 mb-2">A constellation has formed</h2>
		<p class="text-silver-400 text-sm mb-6">
			{$surfacedCards.length} cards have surfaced from the depths. You can now arrange them to see how they interact - or continue the conversation to surface more.
		</p>

		<!-- Preview of surfaced cards -->
		<div class="flex flex-wrap gap-2 mb-6">
			{#each $surfacedCards as card (card.id)}
				<div class="bg-depth-600 border border-silver-400/20 rounded-lg px-3 py-2">
					<span class="font-serif text-silver-200 text-sm">{card.name}</span>
				</div>
			{/each}
		</div>

		<!-- Actions -->
		<div class="flex gap-3">
			<button
				onclick={continueConversation}
				class="flex-1 px-4 py-3 rounded-lg
					border border-silver-400/20 text-silver-400
					hover:border-silver-400/40 hover:text-silver-300
					transition-all duration-200"
			>
				Continue exploring
			</button>
			<button
				onclick={enterArrangement}
				class="flex-1 px-4 py-3 rounded-lg
					bg-silver-400/10 text-silver-200 border border-silver-400/30
					hover:bg-silver-400/20 hover:text-silver-100
					transition-all duration-200"
			>
				Arrange & witness
			</button>
		</div>
	</div>
</div>
