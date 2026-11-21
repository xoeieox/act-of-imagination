<script>
	import { session, formingCards, surfacedCards, hasContent } from '$lib/stores/session.js';
	// aoi-motion 2026-11-17: one motion language across screens - enter
	// ~300ms ease-out, exit ~180ms ease-in.
	import { fade, fly } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';
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
	import LaneGate from '$lib/components/LaneGate.svelte';

	// Honest first run (F-3): lane configuration state from the server load -
	// rendered into the initial HTML with zero API fetch.
	let { data } = $props();

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
		// Build a pseudo-assembly from the iteration's card snapshot
		// This allows ArrangementPlay to load the cards by name matching
		const pseudoAssembly = {
			cards: iteration.cardSnapshot || [],
			iterations: [iteration]
		};

		showTimeline = false;
		selectedAssembly = null;
		loadedAssembly = pseudoAssembly;
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

	function handleLoadAssembly(assembly) {
		// Close the modal
		navigation.clearView();

		// The assembly's cards need to be loaded - we'll emit an event
		// that ArrangementPlay can listen to, or we store the loaded assembly
		// For now, we'll just enter arrangement mode - the actual loading
		// would require ArrangementPlay to accept initial slots
		loadedAssembly = assembly;
		session.enterArrangementPlay();
	}

	// Track loaded assembly for ArrangementPlay
	let loadedAssembly = $state(null);

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

	// Track the last failed request for retry capability
	let lastFailedRequest = $state(null);

	async function handleSend(content, isRetry = false) {
		if (!content.trim() || $session.isLoading) return;

		// Add user message (skip if this is a retry - message already exists)
		if (!isRetry) {
			session.addUserMessage(content);
		}
		session.setLoading(true);
		session.setError(null);
		lastFailedRequest = null;

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
				const errorData = await response.json().catch(() => ({}));
				if (response.status === 501 && errorData.error === 'llm_lane_unconfigured') {
					// Fail-closed lane state (I-2): carry the env-var hint through
					// instead of swallowing it behind the generic connect error.
					const laneError = new Error(errorData.hint || 'No model lane is configured yet.');
					laneError.laneUnconfigured = true;
					throw laneError;
				}
				throw new Error(errorData.details || 'Unable to connect. Please try again.');
			}

			const data = await response.json();

			// Only add assistant message if there's actual content
			if (data.content && data.content.trim()) {
				session.addAssistantMessage(data.content);
			}

			// Handle any card formation events from the API
			if (data.cardEvents && data.cardEvents.length > 0) {
				session.processCardEvents(data.cardEvents);
			}
		} catch (error) {
			// Store failed request for retry
			lastFailedRequest = { content };

			// User-friendly error messages
			let friendlyMessage = 'Something went wrong. Your message has been saved.';
			if (error.laneUnconfigured) {
				friendlyMessage = error.message;
			} else if (error.message.includes('fetch')) {
				friendlyMessage = 'Connection lost. Your message is safe - tap retry when ready.';
			} else if (error.message.includes('API') || error.message.includes('key')) {
				friendlyMessage = 'Service temporarily unavailable. Your message is saved.';
			}
			session.setError(friendlyMessage);
		} finally {
			session.setLoading(false);
		}
	}

	function handleRetry() {
		if (lastFailedRequest) {
			handleSend(lastFailedRequest.content, true);
		}
	}

	function dismissError() {
		session.setError(null);
		lastFailedRequest = null;
	}
</script>

{#if data && !data.lanesConfigured}
	<LaneGate hint={data.laneHint ?? ''} />
{/if}

<!-- Arrangement Play Mode -->
{#if $session.phase === 'ARRANGEMENT_PLAY'}
	<div
		class="h-full w-full flex flex-col"
		in:fly={{ y: 12, duration: 600, easing: cubicOut }}
		out:fade={{ duration: 320, easing: cubicIn }}
	>
		<ArrangementPlay initialAssembly={loadedAssembly} onLoaded={() => (loadedAssembly = null)} />
	</div>

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
		<aside class="w-80 pl-4 pr-5 py-4 border-l border-silver-400/10 hidden lg:block">
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
		<aside class="w-80 pl-4 pr-5 py-4 border-l border-silver-400/10 hidden lg:block">
			<div class="space-y-3">
				{#each $surfacedCards as card (card.id)}
					<Card {card} />
				{/each}
			</div>
		</aside>
	</div>

	<!-- Normal Conversation Mode -->
{:else}
	<div
		class="flex-1 flex w-full max-w-7xl mx-auto overflow-hidden"
		in:fade={{ duration: 450 }}
		out:fade={{ duration: 260 }}
	>
		<!-- Left Cards Panel -->
		<aside
			class="w-64 p-4 border-r border-silver-400/10 hidden lg:block overflow-y-auto flex-shrink-0"
		>
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
							<p class="text-silver-300 font-serif text-lg mb-2"> Welcome. </p>
							<p class="text-silver-400 text-sm">
								This is a space for exploration. Share what's on your mind - a thought, a dream, a
								tension you've been holding. We'll see what wants to surface.
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
									<span
										class="w-2 h-2 bg-silver-400 rounded-full animate-bounce"
										style="animation-delay: 0ms"
									></span>
									<span
										class="w-2 h-2 bg-silver-400 rounded-full animate-bounce"
										style="animation-delay: 150ms"
									></span>
									<span
										class="w-2 h-2 bg-silver-400 rounded-full animate-bounce"
										style="animation-delay: 300ms"
									></span>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Error display with retry -->
			{#if $session.error}
				<div class="px-6 py-3 bg-depth-700/50 border-t border-red-400/20">
					<div class="max-w-2xl mx-auto flex items-center justify-between gap-4">
						<p class="text-red-300 text-sm flex-1">{$session.error}</p>
						<div class="flex gap-2 flex-shrink-0">
							{#if lastFailedRequest}
								<button
									onclick={handleRetry}
									class="px-3 py-1.5 text-sm rounded-lg
										bg-silver-400/10 text-silver-300 border border-silver-400/20
										hover:bg-silver-400/20 hover:text-silver-200
										transition-all duration-200"
								>
									Retry
								</button>
							{/if}
							<button
								onclick={dismissError}
								class="px-3 py-1.5 text-sm rounded-lg
									text-silver-400 hover:text-silver-300
									transition-colors"
								aria-label="Dismiss error"
							>
								Dismiss
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Input -->
			<div class="p-6 border-t border-silver-400/10 max-w-2xl mx-auto w-full">
				<ChatInput onSend={handleSend} disabled={$session.isLoading} />
			</div>
		</div>

		<!-- Right Cards Panel -->
		<aside
			class="w-80 pl-4 pr-5 py-4 border-l border-silver-400/10 hidden lg:block overflow-y-auto flex-shrink-0"
			style="scrollbar-gutter: stable;"
		>
			<h2 class="text-sm text-silver-400 uppercase tracking-wider mb-4">Surfaced</h2>
			<div class="space-y-3">
				{#each $surfacedCards as card (card.id)}
					<Card {card} />
				{/each}
				{#if $surfacedCards.length === 0}
					<p class="text-silver-400/50 text-sm italic"> Named cards will appear here... </p>
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
	<div
		class="fixed inset-0 bg-depth-900/90 backdrop-blur-sm z-40 flex items-center justify-center p-4"
		in:fade={{ duration: 400 }}
		out:fade={{ duration: 260 }}
	>
		<div
			class="bg-depth-800 border border-silver-400/20 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
			in:fly={{ y: 18, duration: 600, easing: cubicOut }}
		>
			<div class="p-4 border-b border-silver-400/10 flex items-center justify-between">
				<h2 class="font-serif text-xl text-silver-100">Your Assemblies</h2>
				<button
					onclick={closeAllPanels}
					class="text-silver-400 hover:text-silver-200 transition-colors"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto p-4">
				<AssemblyList
					onSelectAssembly={handleSelectAssembly}
					onLoadAssembly={handleLoadAssembly}
					onClose={closeAllPanels}
				/>
			</div>
		</div>
	</div>
{/if}

{#if showCards}
	<div
		class="fixed inset-0 bg-depth-900/90 backdrop-blur-sm z-40 flex items-center justify-center p-4"
		in:fade={{ duration: 400 }}
		out:fade={{ duration: 260 }}
	>
		<div
			class="bg-depth-800 border border-silver-400/20 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
			in:fly={{ y: 18, duration: 600, easing: cubicOut }}
		>
			<div class="p-4 border-b border-silver-400/10 flex items-center justify-between">
				<h2 class="font-serif text-xl text-silver-100">Your Cards</h2>
				<button
					onclick={closeAllPanels}
					class="text-silver-400 hover:text-silver-200 transition-colors"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
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
	<div
		class="fixed inset-0 bg-depth-900/90 backdrop-blur-sm z-40 flex items-center justify-center p-4"
		in:fade={{ duration: 400 }}
		out:fade={{ duration: 260 }}
	>
		<div
			class="bg-depth-800 border border-silver-400/20 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
			in:fly={{ y: 18, duration: 600, easing: cubicOut }}
		>
			<div class="p-4 border-b border-silver-400/10 flex items-center justify-between">
				<h2 class="font-serif text-xl text-silver-100">{selectedAssembly.title}</h2>
				<button
					onclick={closeAllPanels}
					class="text-silver-400 hover:text-silver-200 transition-colors"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
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
		onClose={() => (comparisonIterations = null)}
	/>
{/if}
