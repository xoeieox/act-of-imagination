<script>
	import { session, formingCards, surfacedCards, hasContent } from '$lib/stores/session.js';
	import { navigation } from '$lib/stores/navigation.js';
	import Message from '$lib/components/Message.svelte';
	import Card from '$lib/components/Card.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import CardProposal from '$lib/components/CardProposal.svelte';
	import TransitionPrompt from '$lib/components/TransitionPrompt.svelte';
	import ArrangementPlay from '$lib/components/ArrangementPlay.svelte';
	import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
	import AssemblyList from '$lib/components/AssemblyList.svelte';
	import CardLibrary from '$lib/components/CardLibrary.svelte';
	import AssemblyTimeline from '$lib/components/AssemblyTimeline.svelte';
	import IterationComparison from '$lib/components/IterationComparison.svelte';

	let messagesContainer = $state(null);

	// View state for panels (driven by navigation store)
	let showAssemblies = $derived($navigation.currentView === 'assemblies');
	let showCards = $derived($navigation.currentView === 'cards');
	let showTimeline = $state(false);
	let selectedAssembly = $state(null);
	let comparisonIterations = $state(null);

	// Show welcome screen for returning users with no active conversation
	let showWelcome = $derived(
		$session.messages.length === 0 &&
		$session.phase === 'CONVERSATION' &&
		($surfacedCards.length > 0 || $hasContent)
	);

	function handleSelectAssembly(assembly) {
		selectedAssembly = assembly;
		navigation.clearView();
		showTimeline = true;
	}

	function handleCompare(iterations) {
		comparisonIterations = iterations;
	}

	function handleSelectIteration(iteration) {
		// Load the iteration's cards into arrangement play
		// For now, just go to arrangement mode
		showTimeline = false;
		selectedAssembly = null;
		session.enterArrangementPlay();
	}

	function handleNewSession() {
		session.reset();
	}

	function handleViewCards() {
		navigation.showCards();
		showTimeline = false;
	}

	function handleViewAssemblies() {
		navigation.showAssemblies();
		showTimeline = false;
	}

	function handleStartArrangement() {
		session.enterArrangementPlay();
	}

	function closeAllPanels() {
		navigation.clearView();
		showTimeline = false;
		selectedAssembly = null;
		comparisonIterations = null;
	}

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		if ($session.messages.length && messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	});

	async function handleSend(content) {
		if (!content.trim() || $session.isLoading) return;

		// Add user message
		session.addUserMessage(content);
		session.setLoading(true);
		session.setError(null);

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: $session.messages,
					cards: $session.cards
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get response');
			}

			const data = await response.json();
			session.addAssistantMessage(data.content);

			// Handle any card formation events from the API
			if (data.cardEvents && data.cardEvents.length > 0) {
				session.processCardEvents(data.cardEvents);
			}
		} catch (error) {
			session.setError(error.message);
		} finally {
			session.setLoading(false);
		}
	}
</script>

<!-- Arrangement Play Mode -->
{#if $session.phase === 'ARRANGEMENT_PLAY'}
	<ArrangementPlay />

<!-- Card Proposal Modal -->
{:else if $session.phase === 'CARD_PROPOSAL' && $session.pendingProposal}
	<CardProposal proposal={$session.pendingProposal} />
	<!-- Show conversation behind the modal -->
	<div class="flex-1 flex w-full max-w-7xl mx-auto opacity-50 pointer-events-none">
		<!-- Same conversation layout but dimmed -->
		<aside class="w-64 p-4 border-r border-silver-400/10 hidden lg:block">
			<div class="space-y-3">
				{#each $formingCards as card (card.id)}
					<Card {card} />
				{/each}
			</div>
		</aside>
		<div class="flex-1 flex flex-col max-w-2xl mx-auto w-full">
			<div class="flex-1 overflow-y-auto p-6 space-y-4">
				{#each $session.messages as message (message.id)}
					<Message {message} />
				{/each}
			</div>
		</div>
		<aside class="w-64 p-4 border-l border-silver-400/10 hidden lg:block">
			<div class="space-y-3">
				{#each $surfacedCards as card (card.id)}
					<Card {card} />
				{/each}
			</div>
		</aside>
	</div>

<!-- Transition Prompt Modal -->
{:else if $session.phase === 'TRANSITION'}
	<TransitionPrompt />
	<!-- Show conversation behind the modal -->
	<div class="flex-1 flex w-full max-w-7xl mx-auto opacity-50 pointer-events-none">
		<aside class="w-64 p-4 border-r border-silver-400/10 hidden lg:block">
			<div class="space-y-3">
				{#each $formingCards as card (card.id)}
					<Card {card} />
				{/each}
			</div>
		</aside>
		<div class="flex-1 flex flex-col max-w-2xl mx-auto w-full">
			<div class="flex-1 overflow-y-auto p-6 space-y-4">
				{#each $session.messages as message (message.id)}
					<Message {message} />
				{/each}
			</div>
		</div>
		<aside class="w-64 p-4 border-l border-silver-400/10 hidden lg:block">
			<div class="space-y-3">
				{#each $surfacedCards as card (card.id)}
					<Card {card} />
				{/each}
			</div>
		</aside>
	</div>

<!-- Normal Conversation Mode -->
{:else}
	<div class="flex-1 flex w-full max-w-7xl mx-auto overflow-hidden">
		<!-- Left Cards Panel -->
		<aside class="w-64 p-4 border-r border-silver-400/10 hidden lg:block overflow-y-auto flex-shrink-0">
			<h2 class="text-sm text-silver-400 uppercase tracking-wider mb-4">Forming</h2>
			<div class="space-y-3">
				{#each $formingCards as card (card.id)}
					<Card {card} />
				{/each}
				{#if $formingCards.length === 0}
					<p class="text-silver-400/50 text-sm italic">
						Shapes will appear here as they begin to form...
					</p>
				{/if}
			</div>
		</aside>

		<!-- Center Conversation -->
		<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
			<!-- Messages -->
			<div
				bind:this={messagesContainer}
				class="flex-1 overflow-y-auto p-6 space-y-4 max-w-2xl mx-auto w-full"
			>
				{#if showWelcome}
					<!-- Welcome screen for returning users -->
					<WelcomeScreen
						onNewSession={handleNewSession}
						onViewCards={handleViewCards}
						onViewAssemblies={handleViewAssemblies}
						onStartArrangement={handleStartArrangement}
					/>
				{:else if $session.messages.length === 0}
					<!-- Welcome state for new users -->
					<div class="h-full flex items-center justify-center">
						<div class="text-center max-w-md">
							<p class="text-silver-300 font-serif text-lg mb-2">
								Welcome.
							</p>
							<p class="text-silver-400 text-sm">
								This is a space for exploration. Share what's on your mind - a thought, a dream, a tension you've been holding. We'll see what wants to surface.
							</p>
						</div>
					</div>
				{:else}
					{#each $session.messages as message (message.id)}
						<Message {message} />
					{/each}

					{#if $session.isLoading}
						<div class="flex justify-start">
							<div class="message-assistant px-4 py-3">
								<div class="flex space-x-1">
									<span class="w-2 h-2 bg-silver-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
									<span class="w-2 h-2 bg-silver-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
									<span class="w-2 h-2 bg-silver-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Error display -->
			{#if $session.error}
				<div class="px-6 py-2">
					<p class="text-red-400 text-sm text-center">{$session.error}</p>
				</div>
			{/if}

			<!-- Input -->
			<div class="p-6 border-t border-silver-400/10 max-w-2xl mx-auto w-full">
				<ChatInput onSend={handleSend} disabled={$session.isLoading} />
			</div>
		</div>

		<!-- Right Cards Panel -->
		<aside class="w-64 p-4 border-l border-silver-400/10 hidden lg:block overflow-y-auto flex-shrink-0">
			<h2 class="text-sm text-silver-400 uppercase tracking-wider mb-4">Surfaced</h2>
			<div class="space-y-3">
				{#each $surfacedCards as card (card.id)}
					<Card {card} />
				{/each}
				{#if $surfacedCards.length === 0}
					<p class="text-silver-400/50 text-sm italic">
						Named cards will appear here...
					</p>
				{/if}
			</div>

			<!-- Quick access to arrangement if cards available -->
			{#if $surfacedCards.length >= 3}
				<div class="mt-6 pt-4 border-t border-silver-400/10">
					<button
						onclick={() => session.enterArrangementPlay()}
						class="w-full px-3 py-2 rounded-lg text-sm
							bg-silver-400/10 text-silver-300 border border-silver-400/20
							hover:bg-silver-400/20 hover:text-silver-200
							transition-all duration-200"
					>
						Arrange cards
					</button>
				</div>
			{/if}
		</aside>
	</div>
{/if}

<!-- Overlay Panels -->
{#if showAssemblies}
	<div class="fixed inset-0 bg-depth-900/90 backdrop-blur-sm z-40 flex items-center justify-center p-4">
		<div class="bg-depth-800 border border-silver-400/20 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-rise">
			<div class="p-4 border-b border-silver-400/10 flex items-center justify-between">
				<h2 class="font-serif text-xl text-silver-100">Your Assemblies</h2>
				<button
					onclick={closeAllPanels}
					class="text-silver-400 hover:text-silver-200 transition-colors"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto p-4">
				<AssemblyList
					onSelect={handleSelectAssembly}
				/>
			</div>
		</div>
	</div>
{/if}

{#if showCards}
	<div class="fixed inset-0 bg-depth-900/90 backdrop-blur-sm z-40 flex items-center justify-center p-4">
		<div class="bg-depth-800 border border-silver-400/20 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-rise">
			<div class="p-4 border-b border-silver-400/10 flex items-center justify-between">
				<h2 class="font-serif text-xl text-silver-100">Your Cards</h2>
				<button
					onclick={closeAllPanels}
					class="text-silver-400 hover:text-silver-200 transition-colors"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto p-4">
				<CardLibrary />
			</div>
		</div>
	</div>
{/if}

{#if showTimeline && selectedAssembly}
	<div class="fixed inset-0 bg-depth-900/90 backdrop-blur-sm z-40 flex items-center justify-center p-4">
		<div class="bg-depth-800 border border-silver-400/20 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-rise">
			<div class="p-4 border-b border-silver-400/10 flex items-center justify-between">
				<h2 class="font-serif text-xl text-silver-100">{selectedAssembly.title}</h2>
				<button
					onclick={closeAllPanels}
					class="text-silver-400 hover:text-silver-200 transition-colors"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto p-4">
				<AssemblyTimeline
					assembly={selectedAssembly}
					onCompare={handleCompare}
					onSelectIteration={handleSelectIteration}
				/>
			</div>
		</div>
	</div>
{/if}

<!-- Iteration Comparison Modal -->
{#if comparisonIterations}
	<IterationComparison
		iterations={comparisonIterations}
		onClose={() => comparisonIterations = null}
	/>
{/if}
