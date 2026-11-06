<script>
	import { session } from '$lib/stores/session.js';
	import { PRESETS, CARD_TYPES, FORMATION_STATES, createCard } from '$lib/dev/presets.js';

	const phases = ['CONVERSATION', 'CARD_PROPOSAL', 'TRANSITION', 'ARRANGEMENT_PLAY'];

	// Card being edited
	let editingCard = $state(null);

	function loadPreset(presetKey) {
		session.loadPreset(PRESETS[presetKey]);
	}

	function addQuickCard(formationState) {
		const card = createCard({ formationState });
		if (formationState === 'surfaced') {
			card.name = 'Test Card ' + ($session.cards.length + 1);
			card.essence = 'A test card created from the dev panel';
			card.depth = 1.0;
		} else if (formationState === 'rising') {
			card.depth = 0.6;
		}
		session.addCard(card);
	}

	function transitionCard(cardId, newState) {
		const card = $session.cards.find((c) => c.id === cardId);
		const updates = { formationState: newState };

		if (newState === 'surfaced') {
			updates.name = card?.name || 'Auto-Surfaced Card';
			updates.essence = card?.essence || 'Automatically surfaced from dev panel';
			updates.depth = 1.0;
		} else if (newState === 'rising') {
			updates.depth = 0.6;
		} else {
			updates.depth = 0.3;
		}

		session.updateCard(cardId, updates);
	}

	function triggerTestProposal() {
		session.setPendingProposal({
			hint: 'A shape emerging from the conversation',
			name: 'Test Proposed Card',
			essence:
				'This is a test essence for the proposal modal. It should be long enough to verify the textarea sizing is adequate for reading and editing.',
			type: 'theme'
		});
	}

	function startEditCard(card) {
		editingCard = { ...card };
	}

	function saveEditCard() {
		if (!editingCard) return;
		const { id, ...updates } = editingCard;
		session.updateCard(id, updates);
		editingCard = null;
	}

	function cancelEdit() {
		editingCard = null;
	}
</script>

<div class="min-h-screen bg-depth-900 text-silver-200 p-6">
	<div class="max-w-4xl mx-auto space-y-6">
		<!-- Header -->
		<header class="flex items-center justify-between border-b border-silver-400/20 pb-4">
			<h1 class="text-2xl font-serif text-silver-100">Dev Control Panel</h1>
			<div class="flex gap-3">
				<button
					onclick={() => session.reset()}
					class="px-4 py-2 bg-red-900/30 text-red-300 rounded-lg hover:bg-red-900/50 transition-colors"
				>
					Reset All
				</button>
				<a
					href="/"
					class="px-4 py-2 bg-depth-700 text-silver-300 rounded-lg hover:bg-depth-600 transition-colors"
				>
					Back to App
				</a>
			</div>
		</header>

		<!-- Phase Control -->
		<section class="bg-depth-700 rounded-xl p-4">
			<h2 class="text-sm uppercase tracking-wider text-silver-400 mb-3">Phase Control</h2>
			<div class="flex flex-wrap gap-2 mb-3">
				{#each phases as phase}
					<button
						onclick={() => session.setPhase(phase)}
						class="px-4 py-2 rounded-lg transition-all text-sm
							{$session.phase === phase
							? 'bg-silver-400/20 text-silver-100 border border-silver-400/40'
							: 'bg-depth-600 text-silver-400 hover:text-silver-300 hover:bg-depth-500'}"
					>
						{phase.replace('_', ' ')}
					</button>
				{/each}
			</div>
			<p class="text-sm text-silver-400">
				Current: <span class="text-silver-200 font-medium">{$session.phase}</span>
			</p>
		</section>

		<!-- Session State -->
		<section class="bg-depth-700 rounded-xl p-4">
			<h2 class="text-sm uppercase tracking-wider text-silver-400 mb-3">Session State</h2>
			<div class="flex flex-wrap gap-6 mb-4 text-sm">
				<span>Messages: <strong class="text-silver-100">{$session.messages.length}</strong></span>
				<span>Cards: <strong class="text-silver-100">{$session.cards.length}</strong></span>
				<span
					>Surfaced: <strong class="text-silver-100"
						>{$session.cards.filter((c) => c.formationState === 'surfaced').length}</strong
					></span
				>
				<span
					>Pending Proposal: <strong class="text-silver-100"
						>{$session.pendingProposal ? 'Yes' : 'No'}</strong
					></span
				>
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					onclick={() => session.clearMessages()}
					class="px-3 py-1.5 bg-depth-600 rounded text-sm hover:bg-depth-500 transition-colors"
				>
					Clear Messages
				</button>
				<button
					onclick={() => session.clearCards()}
					class="px-3 py-1.5 bg-depth-600 rounded text-sm hover:bg-depth-500 transition-colors"
				>
					Clear Cards
				</button>
				<button
					onclick={triggerTestProposal}
					class="px-3 py-1.5 bg-silver-400/10 border border-silver-400/30 rounded text-sm hover:bg-silver-400/20 transition-colors"
				>
					Trigger Proposal Modal
				</button>
			</div>
		</section>

		<!-- Presets -->
		<section class="bg-depth-700 rounded-xl p-4">
			<h2 class="text-sm uppercase tracking-wider text-silver-400 mb-3">Load Preset</h2>
			<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
				{#each Object.entries(PRESETS) as [key, preset]}
					<button
						onclick={() => loadPreset(key)}
						class="p-3 bg-depth-600 rounded-lg text-left hover:bg-depth-500 transition-all"
					>
						<span class="block text-silver-200 text-sm font-medium">{preset.name}</span>
						<span class="block text-silver-400 text-xs mt-1">{preset.description}</span>
					</button>
				{/each}
			</div>
		</section>

		<!-- Cards -->
		<section class="bg-depth-700 rounded-xl p-4">
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-sm uppercase tracking-wider text-silver-400">
					Cards ({$session.cards.length})
				</h2>
				<div class="flex gap-2">
					<button
						onclick={() => addQuickCard('submerged')}
						class="px-3 py-1.5 bg-depth-600 rounded text-sm hover:bg-depth-500 transition-colors opacity-60 hover:opacity-100"
					>
						+ Submerged
					</button>
					<button
						onclick={() => addQuickCard('rising')}
						class="px-3 py-1.5 bg-depth-600 rounded text-sm hover:bg-depth-500 transition-colors opacity-80 hover:opacity-100"
					>
						+ Rising
					</button>
					<button
						onclick={() => addQuickCard('surfaced')}
						class="px-3 py-1.5 bg-silver-400/10 border border-silver-400/30 rounded text-sm hover:bg-silver-400/20 transition-colors"
					>
						+ Surfaced
					</button>
				</div>
			</div>

			<div class="space-y-2">
				{#each $session.cards as card (card.id)}
					<div
						class="flex items-center justify-between p-3 bg-depth-600 rounded-lg
						{card.formationState === 'submerged'
							? 'opacity-60'
							: card.formationState === 'rising'
								? 'opacity-80'
								: ''}"
					>
						<div class="flex-1 min-w-0 mr-4">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="text-silver-200 truncate">
									{card.name || card.hint || 'Unnamed'}
								</span>
								<span
									class="text-xs px-2 py-0.5 rounded bg-depth-500 text-silver-400
									{card.formationState === 'surfaced' ? 'bg-silver-400/20 text-silver-200' : ''}"
								>
									{card.formationState}
								</span>
								<span class="text-xs text-silver-500">{card.type}</span>
								<span class="text-xs text-silver-500">d:{card.depth.toFixed(1)}</span>
							</div>
						</div>
						<div class="flex gap-1 flex-shrink-0">
							{#if card.formationState !== 'submerged'}
								<button
									onclick={() => transitionCard(card.id, 'submerged')}
									class="px-2 py-1 text-xs bg-depth-500 rounded hover:bg-depth-400 transition-colors"
								>
									Submerge
								</button>
							{/if}
							{#if card.formationState !== 'rising'}
								<button
									onclick={() => transitionCard(card.id, 'rising')}
									class="px-2 py-1 text-xs bg-depth-500 rounded hover:bg-depth-400 transition-colors"
								>
									Rise
								</button>
							{/if}
							{#if card.formationState !== 'surfaced'}
								<button
									onclick={() => transitionCard(card.id, 'surfaced')}
									class="px-2 py-1 text-xs bg-silver-400/20 rounded hover:bg-silver-400/30 transition-colors"
								>
									Surface
								</button>
							{/if}
							<button
								onclick={() => startEditCard(card)}
								class="px-2 py-1 text-xs bg-depth-500 rounded hover:bg-depth-400 transition-colors"
							>
								Edit
							</button>
							<button
								onclick={() => session.deleteCard(card.id)}
								class="px-2 py-1 text-xs bg-red-900/30 text-red-300 rounded hover:bg-red-900/50 transition-colors"
							>
								Del
							</button>
						</div>
					</div>
				{/each}

				{#if $session.cards.length === 0}
					<p class="text-silver-400/50 text-sm italic py-8 text-center">
						No cards yet. Add one above or load a preset.
					</p>
				{/if}
			</div>
		</section>

		<!-- Messages Preview -->
		{#if $session.messages.length > 0}
			<section class="bg-depth-700 rounded-xl p-4">
				<h2 class="text-sm uppercase tracking-wider text-silver-400 mb-3">
					Messages ({$session.messages.length})
				</h2>
				<div class="space-y-2 max-h-64 overflow-y-auto">
					{#each $session.messages as message}
						<div
							class="p-2 rounded text-sm
							{message.role === 'user' ? 'bg-depth-600 ml-8' : 'bg-depth-800 mr-8'}"
						>
							<span class="text-xs text-silver-500 uppercase">{message.role}</span>
							<p class="text-silver-300 mt-1 line-clamp-2">{message.content}</p>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<!-- Edit Card Modal -->
{#if editingCard}
	<div
		class="fixed inset-0 bg-depth-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
	>
		<div class="bg-depth-700 border border-silver-400/20 rounded-2xl max-w-lg w-full p-6">
			<h2 class="font-serif text-xl text-silver-100 mb-4">Edit Card</h2>

			<div class="space-y-4">
				<div>
					<label class="block text-xs text-silver-400 uppercase tracking-wider mb-1">Name</label>
					<input
						type="text"
						bind:value={editingCard.name}
						class="w-full bg-depth-600 border border-silver-400/20 rounded-lg text-silver-200 p-2
							focus:outline-none focus:border-silver-400/40"
						placeholder="Card name (null for forming cards)"
					/>
				</div>

				<div>
					<label class="block text-xs text-silver-400 uppercase tracking-wider mb-1">Essence</label>
					<textarea
						bind:value={editingCard.essence}
						rows="3"
						class="w-full bg-depth-600 border border-silver-400/20 rounded-lg text-silver-200 p-2
							focus:outline-none focus:border-silver-400/40 resize-y min-h-[80px]"
						placeholder="What this card represents..."></textarea>
				</div>

				<div>
					<label class="block text-xs text-silver-400 uppercase tracking-wider mb-1">Hint</label>
					<input
						type="text"
						bind:value={editingCard.hint}
						class="w-full bg-depth-600 border border-silver-400/20 rounded-lg text-silver-200 p-2
							focus:outline-none focus:border-silver-400/40"
						placeholder="Evocative hint text..."
					/>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div>
						<label class="block text-xs text-silver-400 uppercase tracking-wider mb-1">Type</label>
						<select
							bind:value={editingCard.type}
							class="w-full bg-depth-600 border border-silver-400/20 rounded-lg text-silver-200 p-2
								focus:outline-none focus:border-silver-400/40"
						>
							{#each CARD_TYPES as type}
								<option value={type}>{type}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block text-xs text-silver-400 uppercase tracking-wider mb-1">State</label>
						<select
							bind:value={editingCard.formationState}
							class="w-full bg-depth-600 border border-silver-400/20 rounded-lg text-silver-200 p-2
								focus:outline-none focus:border-silver-400/40"
						>
							{#each FORMATION_STATES as state}
								<option value={state}>{state}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block text-xs text-silver-400 uppercase tracking-wider mb-1"
							>Depth ({editingCard.depth.toFixed(1)})</label
						>
						<input
							type="range"
							bind:value={editingCard.depth}
							min="0"
							max="1"
							step="0.1"
							class="w-full mt-2"
						/>
					</div>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					onclick={cancelEdit}
					class="flex-1 px-4 py-2 rounded-lg border border-silver-400/20 text-silver-400
						hover:border-silver-400/40 hover:text-silver-300 transition-all"
				>
					Cancel
				</button>
				<button
					onclick={saveEditCard}
					class="flex-1 px-4 py-2 rounded-lg bg-silver-400/10 text-silver-200 border border-silver-400/30
						hover:bg-silver-400/20 hover:text-silver-100 transition-all"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
