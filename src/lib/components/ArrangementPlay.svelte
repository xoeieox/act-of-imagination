<script>
	import { session, surfacedCards } from '$lib/stores/session.js';
	import ContextDeck from './ContextDeck.svelte';
	import AssemblySave from './AssemblySave.svelte';
	import { SYSTEM_CONTEXTS } from '$lib/data/contexts.js';
	import { assemblies, initAssemblies } from '$lib/supabase/assemblies.js';
	import { onMount } from 'svelte';

	// Arrangement slots (3 slots for MVP)
	let slots = $state([null, null, null]);
	let selectedContext = $state(SYSTEM_CONTEXTS[0]); // Default to first system context
	let generatedNarrative = $state('');
	let isGenerating = $state(false);
	let error = $state(null);
	let showSaveModal = $state(false);
	let savedMessage = $state(null);

	// Timeline state
	let timelineLoaded = $state(false);
	let filterCardIds = $state(new Set());
	let expandedIterationId = $state(null);

	onMount(async () => {
		await initAssemblies();
		timelineLoaded = true;
	});

	// Available cards (not in slots)
	let availableCards = $derived(
		$surfacedCards.filter(card => !slots.includes(card))
	);

	// Filled slots count
	let filledCount = $derived(slots.filter(s => s !== null).length);

	// Flatten all iterations from all assemblies for the timeline
	let allIterations = $derived(() => {
		const iterations = [];
		$assemblies.forEach(assembly => {
			assembly.iterations?.forEach(iteration => {
				iterations.push({
					...iteration,
					assemblyTitle: assembly.title,
					assemblyId: assembly.id
				});
			});
		});
		// Sort by date, newest first
		return iterations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
	});

	// Get unique cards across all iterations for filtering
	let allCards = $derived(() => {
		const cardMap = new Map();
		allIterations().forEach(it => {
			it.cardSnapshot?.forEach(card => {
				if (!cardMap.has(card.id)) {
					cardMap.set(card.id, card);
				}
			});
		});
		return Array.from(cardMap.values());
	});

	// Filter iterations by selected cards
	let filteredIterations = $derived(() => {
		if (filterCardIds.size === 0) return allIterations();

		return allIterations().filter(it => {
			const iterationCardIds = new Set(it.cardSnapshot?.map(c => c.id) || []);
			return Array.from(filterCardIds).every(id => iterationCardIds.has(id));
		});
	});

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

	function toggleExpandIteration(id) {
		expandedIterationId = expandedIterationId === id ? null : id;
	}

	// Drag and drop state
	let draggedCard = $state(null);
	let dragOverSlot = $state(null);

	function placeCard(card, slotIndex) {
		slots[slotIndex] = card;
	}

	function removeCard(slotIndex) {
		slots[slotIndex] = null;
	}

	// Drag and drop handlers
	function handleDragStart(e, card) {
		draggedCard = card;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', card.id);
	}

	function handleDragEnd() {
		draggedCard = null;
		dragOverSlot = null;
	}

	function handleDragOver(e, slotIndex) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		dragOverSlot = slotIndex;
	}

	function handleDragLeave() {
		dragOverSlot = null;
	}

	function handleDrop(e, slotIndex) {
		e.preventDefault();
		if (draggedCard && slots[slotIndex] === null) {
			placeCard(draggedCard, slotIndex);
		}
		draggedCard = null;
		dragOverSlot = null;
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

	function formatDate(dateStr) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	// Get cards currently in slots
	let placedCards = $derived(slots.filter(s => s !== null));
</script>

<div class="h-full w-full flex flex-col overflow-hidden">
	<!-- Header -->
	<div class="p-4 border-b border-silver-400/10 flex items-center flex-shrink-0 max-w-7xl mx-auto w-full">
		<div class="w-64 flex-shrink-0 hidden lg:block">
			<button
				onclick={backToConversation}
				class="text-silver-400 hover:text-silver-300 transition-colors flex items-center gap-2"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
				</svg>
				<span class="hidden sm:inline">Back to conversation</span>
			</button>
		</div>
		<!-- Mobile back button -->
		<button
			onclick={backToConversation}
			class="text-silver-400 hover:text-silver-300 transition-colors lg:hidden"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
			</svg>
		</button>
		<h2 class="font-serif text-silver-200 flex-1 text-center">Arrangement Play</h2>
		<div class="w-64 flex-shrink-0 hidden lg:flex justify-end">
			<button
				onclick={clearSlots}
				class="text-silver-400 hover:text-silver-300 transition-colors text-sm"
			>
				Clear
			</button>
		</div>
		<!-- Mobile clear button -->
		<button
			onclick={clearSlots}
			class="text-silver-400 hover:text-silver-300 transition-colors text-sm lg:hidden"
		>
			Clear
		</button>
	</div>

	<!-- Three column layout -->
	<div class="flex-1 flex w-full max-w-7xl mx-auto overflow-hidden">
		<!-- Left: Timeline -->
		<aside class="w-64 border-r border-silver-400/10 flex-shrink-0 hidden lg:flex flex-col">
			<div class="p-3 border-b border-silver-400/10">
				<h3 class="text-sm text-silver-400 uppercase tracking-wider">History</h3>
			</div>

			<!-- Filter by cards -->
			{#if allCards().length > 0}
				<div class="p-3 border-b border-silver-400/10">
					<div class="flex items-center gap-1.5 flex-wrap">
						<span class="text-silver-400/60 text-xs w-full mb-1">Filter:</span>
						{#each allCards() as card (card.id)}
							<button
								onclick={() => toggleCardFilter(card.id)}
								class="px-1.5 py-0.5 text-xs rounded transition-all duration-200
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
								class="text-silver-400/60 hover:text-silver-400 text-xs underline ml-1"
							>
								Clear
							</button>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Iterations list -->
			<div class="flex-1 overflow-y-auto">
				{#if !timelineLoaded}
					<div class="p-6 text-center">
						<span class="w-5 h-5 border-2 border-silver-400/30 border-t-silver-400 rounded-full animate-spin inline-block"></span>
					</div>
				{:else if filteredIterations().length === 0}
					<div class="p-6 text-center">
						<p class="text-silver-400/50 text-sm">
							{allIterations().length === 0 ? 'No arrangements yet' : 'No matches'}
						</p>
					</div>
				{:else}
					<div class="divide-y divide-silver-400/5">
						{#each filteredIterations() as iteration (iteration.id)}
							<div class="iteration-item">
								<div
									class="p-3 cursor-pointer hover:bg-depth-700/50 transition-colors"
									onclick={() => toggleExpandIteration(iteration.id)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && toggleExpandIteration(iteration.id)}
								>
									<div class="flex items-center gap-2 mb-1">
										<span class="text-silver-300 text-xs font-medium truncate">
											{iteration.assemblyTitle}
										</span>
										{#if iteration.isStarred}
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
												<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
											</svg>
										{/if}
									</div>

									<!-- Cards used -->
									<div class="flex gap-1 flex-wrap mb-1">
										{#each iteration.cardSnapshot?.slice(0, 3) || [] as card}
											<span class="px-1 py-0.5 bg-depth-700 text-silver-400/80 text-[10px] rounded">
												{card.name}
											</span>
										{/each}
									</div>

									<div class="flex items-center justify-between">
										<span class="text-silver-400/50 text-[10px]">
											{formatDate(iteration.createdAt)}
										</span>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4 text-silver-400/30 transition-transform duration-200
												{expandedIterationId === iteration.id ? 'rotate-180' : ''}"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
										</svg>
									</div>
								</div>

								<!-- Expanded content -->
								{#if expandedIterationId === iteration.id}
									<div class="px-3 pb-3 animate-rise">
										<div class="p-2 bg-depth-800/50 rounded-lg border border-silver-400/10 mb-2 max-h-32 overflow-y-auto">
											<p class="text-silver-300 text-xs font-serif leading-relaxed">
												{iteration.narrative}
											</p>
										</div>
										<p class="text-silver-400/50 text-[10px]">
											in {iteration.contextSnapshot?.label || 'unknown'}
										</p>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Summary -->
			<div class="p-2 border-t border-silver-400/10 bg-depth-800/30 flex-shrink-0">
				<p class="text-silver-400/50 text-xs text-center">
					{allIterations().length} arrangements
				</p>
			</div>
		</aside>

		<!-- Center: Main arrangement area (scrollable) -->
		<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
			<div class="flex-1 overflow-y-auto p-6">
				<div class="max-w-2xl mx-auto w-full pb-8">
				<!-- Slots -->
				<div class="flex justify-center gap-3 sm:gap-4 mb-6 flex-wrap">
					{#each slots as slot, i}
						<div
							class="w-28 h-36 sm:w-36 sm:h-44 rounded-xl border-2 border-dashed
								{slot ? 'border-silver-400/40 bg-depth-700' : dragOverSlot === i ? 'border-silver-300 bg-depth-700/50 scale-105' : 'border-silver-400/20 bg-depth-800/50'}
								flex flex-col items-center justify-center transition-all duration-200"
							ondragover={(e) => !slot && handleDragOver(e, i)}
							ondragleave={handleDragLeave}
							ondrop={(e) => handleDrop(e, i)}
							role="region"
							aria-label="Card slot {i + 1}"
						>
							{#if slot}
								<div class="p-2 sm:p-3 text-center">
									<h4 class="font-serif text-silver-200 text-xs sm:text-sm mb-1 sm:mb-2">{slot.name}</h4>
									<p class="text-silver-400 text-[10px] sm:text-xs mb-2 sm:mb-3 line-clamp-3">{slot.essence}</p>
									<button
										onclick={() => removeCard(i)}
										class="text-silver-400/50 hover:text-silver-300 text-[10px] sm:text-xs"
									>
										Remove
									</button>
								</div>
							{:else}
								<span class="text-silver-400/30 text-xs sm:text-sm">
									{dragOverSlot === i ? 'Drop here' : `Slot ${i + 1}`}
								</span>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Context selector -->
				<div class="mb-6">
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
						class="px-6 sm:px-8 py-3 rounded-xl font-medium transition-all duration-200
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
					<p class="text-center text-silver-400/50 text-sm mb-6">
						Place at least 2 cards to generate an interaction
					</p>
				{/if}

				<!-- Error display -->
				{#if error}
					<p class="text-center text-red-400/80 text-sm mb-4">{error}</p>
				{/if}

				<!-- Generated narrative (full text, no clipping) -->
				{#if generatedNarrative}
					<div class="animate-rise">
						<div class="bg-depth-700 border border-silver-400/20 rounded-2xl p-6 mb-4">
							<p class="text-silver-200 font-serif leading-relaxed whitespace-pre-wrap text-base sm:text-lg">
								{generatedNarrative}
							</p>
						</div>

						<!-- Save button -->
						<div class="flex justify-center gap-3">
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

		<!-- Right: Your Cards -->
		<aside class="w-64 p-4 border-l border-silver-400/10 flex-shrink-0 hidden lg:flex flex-col overflow-y-auto">
			<h2 class="text-sm text-silver-400 uppercase tracking-wider mb-4">Your Cards</h2>
			<div class="space-y-3">
				{#each availableCards as card (card.id)}
					<div
						draggable="true"
						ondragstart={(e) => handleDragStart(e, card)}
						ondragend={handleDragEnd}
						onclick={() => {
							const emptyIndex = slots.findIndex(s => s === null);
							if (emptyIndex !== -1) placeCard(card, emptyIndex);
						}}
						class="card-container p-4 min-h-[100px] cursor-grab active:cursor-grabbing hover:glow-subtle
							{draggedCard?.id === card.id ? 'opacity-50 scale-95' : ''}"
						role="button"
						tabindex="0"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								const emptyIndex = slots.findIndex(s => s === null);
								if (emptyIndex !== -1) placeCard(card, emptyIndex);
							}
						}}
					>
						<h3 class="font-serif text-silver-100 text-lg mb-2">{card.name}</h3>
						{#if card.essence}
							<p class="text-silver-300 text-sm">{card.essence}</p>
						{/if}
					</div>
				{/each}
				{#if availableCards.length === 0}
					<p class="text-silver-400/50 text-sm italic">All cards placed</p>
				{/if}
			</div>
		</aside>
	</div>

	<!-- Mobile: Cards drawer (shown at bottom on smaller screens) -->
	<div class="lg:hidden border-t border-silver-400/10 p-4 flex-shrink-0">
		<h2 class="text-sm text-silver-400 uppercase tracking-wider mb-3">Your Cards</h2>
		<div class="flex gap-3 overflow-x-auto pb-2">
			{#each availableCards as card (card.id)}
				<div
					draggable="true"
					ondragstart={(e) => handleDragStart(e, card)}
					ondragend={handleDragEnd}
					onclick={() => {
						const emptyIndex = slots.findIndex(s => s === null);
						if (emptyIndex !== -1) placeCard(card, emptyIndex);
					}}
					class="card-container p-3 min-w-[140px] cursor-grab active:cursor-grabbing hover:glow-subtle flex-shrink-0
						{draggedCard?.id === card.id ? 'opacity-50 scale-95' : ''}"
					role="button"
					tabindex="0"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							const emptyIndex = slots.findIndex(s => s === null);
							if (emptyIndex !== -1) placeCard(card, emptyIndex);
						}
					}}
				>
					<h4 class="font-serif text-silver-200 text-sm mb-1">{card.name}</h4>
					<p class="text-silver-400 text-xs line-clamp-2">{card.essence}</p>
				</div>
			{/each}
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
