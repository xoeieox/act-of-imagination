<script>
	import { session, surfacedCards } from '$lib/stores/session.js';
	import ContextDeck from './ContextDeck.svelte';
	import AssemblySave from './AssemblySave.svelte';
	import { SYSTEM_CONTEXTS } from '$lib/data/contexts.js';

	// Arrangement slots (3 slots for MVP)
	let slots = $state([null, null, null]);
	let selectedContext = $state(SYSTEM_CONTEXTS[0]); // Default to first system context
	let generatedNarrative = $state('');
	let isGenerating = $state(false);
	let error = $state(null);
	let showSaveModal = $state(false);
	let savedMessage = $state(null);

	// Available cards (not in slots)
	let availableCards = $derived(
		$surfacedCards.filter(card => !slots.includes(card))
	);

	// Filled slots count
	let filledCount = $derived(slots.filter(s => s !== null).length);

	function placeCard(card, slotIndex) {
		slots[slotIndex] = card;
	}

	function removeCard(slotIndex) {
		slots[slotIndex] = null;
	}

	function clearSlots() {
		slots = [null, null, null];
		generatedNarrative = '';
	}

	function handleContextSelect(context) {
		selectedContext = context;
	}

	async function generateInteraction() {
		if (filledCount < 2 || !selectedContext) return;

		isGenerating = true;
		error = null;
		generatedNarrative = '';

		try {
			const response = await fetch('/api/arrange', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cards: slots.filter(s => s !== null),
					context: selectedContext // Pass full context object
				})
			});

			if (!response.ok) {
				throw new Error('Failed to generate interaction');
			}

			const data = await response.json();
			generatedNarrative = data.narrative;
		} catch (err) {
			error = err.message;
		} finally {
			isGenerating = false;
		}
	}

	function backToConversation() {
		session.setPhase('CONVERSATION');
	}

	function openSaveModal() {
		showSaveModal = true;
	}

	function handleSaved(assembly) {
		showSaveModal = false;
		savedMessage = `Saved "${assembly.title}"`;
		// Clear message after 3 seconds
		setTimeout(() => {
			savedMessage = null;
		}, 3000);
	}

	// Get cards currently in slots
	let placedCards = $derived(slots.filter(s => s !== null));
</script>

<div class="min-h-screen flex flex-col">
	<!-- Header -->
	<div class="p-4 border-b border-silver-400/10 flex items-center justify-between">
		<button
			onclick={backToConversation}
			class="text-silver-400 hover:text-silver-300 transition-colors flex items-center gap-2"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
			</svg>
			Back to conversation
		</button>
		<h2 class="font-serif text-silver-200">Arrangement Play</h2>
		<button
			onclick={clearSlots}
			class="text-silver-400 hover:text-silver-300 transition-colors text-sm"
		>
			Clear
		</button>
	</div>

	<div class="flex-1 flex flex-col lg:flex-row">
		<!-- Available Cards -->
		<aside class="lg:w-64 p-4 border-b lg:border-b-0 lg:border-r border-silver-400/10">
			<h3 class="text-sm text-silver-400 uppercase tracking-wider mb-3">Your Cards</h3>
			<div class="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
				{#each availableCards as card (card.id)}
					<button
						onclick={() => {
							// Find first empty slot
							const emptyIndex = slots.findIndex(s => s === null);
							if (emptyIndex !== -1) placeCard(card, emptyIndex);
						}}
						class="card-container p-3 min-w-[140px] lg:min-w-0 text-left hover:glow-subtle cursor-pointer"
					>
						<h4 class="font-serif text-silver-200 text-sm mb-1">{card.name}</h4>
						<p class="text-silver-400 text-xs line-clamp-2">{card.essence}</p>
					</button>
				{/each}
				{#if availableCards.length === 0}
					<p class="text-silver-400/50 text-sm italic">All cards placed</p>
				{/if}
			</div>
		</aside>

		<!-- Main arrangement area -->
		<div class="flex-1 p-6 flex flex-col">
			<!-- Slots -->
			<div class="flex justify-center gap-4 mb-6">
				{#each slots as slot, i}
					<div
						class="w-40 h-48 rounded-xl border-2 border-dashed
							{slot ? 'border-silver-400/40 bg-depth-700' : 'border-silver-400/20 bg-depth-800/50'}
							flex flex-col items-center justify-center transition-all duration-200"
					>
						{#if slot}
							<div class="p-3 text-center">
								<h4 class="font-serif text-silver-200 text-sm mb-2">{slot.name}</h4>
								<p class="text-silver-400 text-xs mb-3 line-clamp-3">{slot.essence}</p>
								<button
									onclick={() => removeCard(i)}
									class="text-silver-400/50 hover:text-silver-300 text-xs"
								>
									Remove
								</button>
							</div>
						{:else}
							<span class="text-silver-400/30 text-sm">Slot {i + 1}</span>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Context selector -->
			<div class="mb-6 max-w-2xl mx-auto w-full">
				<h3 class="text-sm text-silver-400 uppercase tracking-wider mb-3 text-center">Choose a context</h3>
				<ContextDeck
					selected={selectedContext}
					onSelect={handleContextSelect}
				/>
			</div>

			<!-- Generate button -->
			<div class="flex justify-center mb-6">
				<button
					onclick={generateInteraction}
					disabled={filledCount < 2 || isGenerating}
					class="px-8 py-3 rounded-xl font-medium transition-all duration-200
						{filledCount >= 2
							? 'bg-silver-400/10 text-silver-200 border border-silver-400/30 hover:bg-silver-400/20 hover:glow-subtle'
							: 'bg-depth-700 text-silver-400/50 border border-silver-400/10 cursor-not-allowed'}"
				>
					{#if isGenerating}
						<span class="flex items-center gap-2">
							<span class="w-4 h-4 border-2 border-silver-400/30 border-t-silver-400 rounded-full animate-spin"></span>
							Witnessing...
						</span>
					{:else}
						Witness the interaction
					{/if}
				</button>
			</div>

			{#if filledCount < 2 && !generatedNarrative}
				<p class="text-center text-silver-400/50 text-sm">
					Place at least 2 cards to generate an interaction
				</p>
			{/if}

			<!-- Error display -->
			{#if error}
				<p class="text-center text-red-400/80 text-sm mb-4">{error}</p>
			{/if}

			<!-- Generated narrative -->
			{#if generatedNarrative}
				<div class="max-w-2xl mx-auto">
					<div class="bg-depth-700 border border-silver-400/20 rounded-2xl p-6 animate-rise">
						<p class="text-silver-200 font-serif leading-relaxed whitespace-pre-wrap">
							{generatedNarrative}
						</p>
					</div>

					<!-- Save button -->
					<div class="flex justify-center mt-4 gap-3">
						<button
							onclick={openSaveModal}
							class="px-6 py-2 rounded-lg text-sm transition-all duration-200
								bg-emerald-900/30 text-emerald-300 border border-emerald-400/30
								hover:bg-emerald-900/50 hover:text-emerald-200"
						>
							Save this assembly
						</button>
					</div>

					<!-- Saved message -->
					{#if savedMessage}
						<p class="text-center text-emerald-400 text-sm mt-3 animate-rise">
							{savedMessage}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Save modal -->
{#if showSaveModal}
	<AssemblySave
		cards={placedCards}
		context={selectedContext}
		narrative={generatedNarrative}
		onSave={handleSaved}
		onClose={() => showSaveModal = false}
	/>
{/if}
