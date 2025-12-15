<script>
	import { assembliesStore } from '$lib/supabase/assemblies.js';

	// Props
	let {
		cards = [],
		context = null,
		narrative = '',
		onSave = () => {},
		onClose = () => {}
	} = $props();

	let title = $state('');
	let synopsis = $state('');
	let isGeneratingSynopsis = $state(false);
	let isSaving = $state(false);
	let error = $state(null);

	// Generate default title
	let defaultTitle = $derived(() => {
		if (cards.length === 0) return 'Untitled Assembly';
		if (cards.length === 1) return cards[0].name;
		if (cards.length === 2) return `${cards[0].name} & ${cards[1].name}`;
		return `${cards[0].name}, ${cards[1].name} & more`;
	});

	// Auto-generate synopsis on mount
	$effect(() => {
		if (narrative && !synopsis) {
			generateSynopsis();
		}
	});

	async function generateSynopsis() {
		isGeneratingSynopsis = true;
		error = null;

		try {
			const response = await fetch('/api/synopsis', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cards,
					context,
					narrative
				})
			});

			if (!response.ok) {
				throw new Error('Failed to generate synopsis');
			}

			const data = await response.json();
			synopsis = data.synopsis;
		} catch (err) {
			console.error('Synopsis generation error:', err);
			// Generate a simple fallback synopsis
			synopsis = `An exploration of ${cards.map(c => c.name).join(', ')} in the context of ${context?.label || 'interaction'}.`;
		} finally {
			isGeneratingSynopsis = false;
		}
	}

	async function handleSave() {
		isSaving = true;
		error = null;

		try {
			const assembly = await assembliesStore.saveAssembly({
				title: title || defaultTitle(),
				synopsis,
				cards,
				context,
				narrative
			});

			onSave(assembly);
		} catch (err) {
			error = err.message;
		} finally {
			isSaving = false;
		}
	}
</script>

<!-- Modal backdrop -->
<div
	class="fixed inset-0 bg-depth-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	role="dialog"
	aria-modal="true"
>
	<div class="bg-depth-700 border border-silver-400/20 rounded-2xl max-w-lg w-full p-6 animate-rise">
		<h2 class="font-serif text-xl text-silver-100 mb-4">Save Assembly</h2>

		<!-- Preview of the arrangement -->
		<div class="mb-4 p-3 bg-depth-800/50 rounded-xl border border-silver-400/10">
			<div class="flex gap-2 mb-2">
				{#each cards as card}
					<span class="px-2 py-1 bg-depth-700 text-silver-300 text-xs rounded-lg">
						{card.name}
					</span>
				{/each}
			</div>
			<p class="text-silver-400 text-xs">
				in <span class="text-silver-300">{context?.label || 'unknown context'}</span>
			</p>
		</div>

		<!-- Title input -->
		<div class="mb-4">
			<label for="assembly-title" class="block text-silver-400 text-sm mb-1">Title</label>
			<input
				type="text"
				id="assembly-title"
				bind:value={title}
				placeholder={defaultTitle()}
				class="w-full px-3 py-2 bg-depth-800 border border-silver-400/20 rounded-lg
					text-silver-100 placeholder-silver-400/40
					focus:border-silver-400/40 focus:outline-none transition-colors"
			/>
		</div>

		<!-- Synopsis -->
		<div class="mb-4">
			<div class="flex items-center justify-between mb-1">
				<label for="assembly-synopsis" class="text-silver-400 text-sm">Synopsis</label>
				{#if isGeneratingSynopsis}
					<span class="text-silver-400/60 text-xs flex items-center gap-1">
						<span class="w-3 h-3 border border-silver-400/30 border-t-silver-400 rounded-full animate-spin"></span>
						Generating...
					</span>
				{/if}
			</div>
			<textarea
				id="assembly-synopsis"
				bind:value={synopsis}
				rows="3"
				placeholder="A brief summary of what this assembly explores..."
				class="w-full px-3 py-2 bg-depth-800 border border-silver-400/20 rounded-lg
					text-silver-100 placeholder-silver-400/40 resize-none
					focus:border-silver-400/40 focus:outline-none transition-colors"
			></textarea>
			<p class="text-silver-400/50 text-xs mt-1">
				This helps you remember what this assembly was about.
			</p>
		</div>

		<!-- Narrative preview (collapsed) -->
		<details class="mb-6">
			<summary class="text-silver-400 text-sm cursor-pointer hover:text-silver-300 transition-colors">
				View generated narrative
			</summary>
			<div class="mt-2 p-3 bg-depth-800/50 rounded-xl border border-silver-400/10 max-h-40 overflow-y-auto">
				<p class="text-silver-300 text-sm font-serif whitespace-pre-wrap">{narrative}</p>
			</div>
		</details>

		{#if error}
			<p class="text-red-400 text-sm mb-4">{error}</p>
		{/if}

		<!-- Actions -->
		<div class="flex gap-3">
			<button
				onclick={onClose}
				class="flex-1 px-4 py-2 rounded-lg
					border border-silver-400/20 text-silver-400
					hover:border-silver-400/40 hover:text-silver-300
					transition-all duration-200"
			>
				Cancel
			</button>
			<button
				onclick={handleSave}
				disabled={isSaving || isGeneratingSynopsis}
				class="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200
					bg-silver-400/10 text-silver-200 border border-silver-400/30
					hover:bg-silver-400/20 hover:border-silver-400/50
					disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if isSaving}
					<span class="flex items-center justify-center gap-2">
						<span class="w-4 h-4 border-2 border-silver-400/30 border-t-silver-400 rounded-full animate-spin"></span>
						Saving...
					</span>
				{:else}
					Save Assembly
				{/if}
			</button>
		</div>
	</div>
</div>
