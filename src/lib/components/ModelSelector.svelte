<script>
	// Compact model selector + model management entry (design ratified
	// 2026-11-21).
	//
	// The select renders ONLY when the combined catalog is non-empty
	// ({#if} below - registry unconfigured = hidden = byte-identical to the
	// pre-selector chrome). Labels + masked metadata (status badge, draft
	// warning) are the only catalog content that can ever reach this
	// component: rows are {key,label,source,status?,hasKey?,keyLast4?} and
	// nothing else (catalog privacy rule, invariant I-9).
	//
	// Under the select, a 'Manage models' entry opens the full in-app
	// management panel (ModelManager): end users add/test/save their own
	// models with no file editing. The entry is visible once the catalog
	// has loaded, even when empty - an empty registry must still be
	// self-serviceable.
	//
	// Motion idiom unchanged: enters ~300ms ease-out, exits ~180ms ease-in.
	import { fade } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { modelStore } from '$lib/stores/model.js';
	import ModelManager from './ModelManager.svelte';

	$effect(() => {
		// Catalog fetch is a no-op outside the browser; one call per mount.
		modelStore.load();
	});

	let managing = $state(false);

	const selectedRow = $derived(
		$modelStore.catalog.find((row) => row.key === $modelStore.selected) ?? null
	);

	function handleChange(event) {
		const value = event.currentTarget.value;
		modelStore.select(value === '' ? null : value);
	}
</script>

{#if $modelStore.catalog.length > 0}
	<div
		id="aoi-model-block"
		class="px-4 py-3 border-t border-silver-400/10"
		in:fade={{ duration: 300, easing: cubicOut }}
		out:fade={{ duration: 180, easing: cubicIn }}
	>
		<label
			class="block text-xs uppercase tracking-widest text-silver-400 mb-2"
			for="aoi-model-select"
		>
			Model
		</label>
		<select
			id="aoi-model-select"
			class="w-full bg-depth-900 text-silver-200 text-sm border border-silver-400/20 rounded-lg px-3 py-2 focus:outline-none focus:border-silver-400/40"
			value={$modelStore.selected ?? ''}
			onchange={handleChange}
		>
			<option value="">Lane default</option>
			{#each $modelStore.catalog as model (model.key)}
				<option value={model.key}>{model.label}{model.status === 'draft' ? ' (draft)' : ''}</option>
			{/each}
		</select>
		{#if selectedRow && selectedRow.status === 'draft'}
			<!-- Draft selection warns inline (UI-side only; drafts stay
			     send-able - the server never blocks a saved row). -->
			<p
				id="aoi-draft-warning"
				class="mt-2 text-xs text-amber-300/80 leading-snug"
				in:fade={{ duration: 200, easing: cubicOut }}
			>
				This model is a draft - it has not passed a connection test yet.
			</p>
		{/if}
	</div>
{/if}

{#if $modelStore.loaded}
	<div id="aoi-manage-block" class="px-4 py-2 border-t border-silver-400/10">
		<button
			id="aoi-manage-models"
			onclick={() => (managing = !managing)}
			class="w-full text-left text-xs uppercase tracking-widest text-silver-400 hover:text-silver-200 transition-colors"
			aria-expanded={managing}
		>
			{managing ? 'Close model manager' : 'Manage models'}
		</button>
	</div>

	{#if managing}
		<div
			id="aoi-model-manager"
			class="px-4 py-3 border-t border-silver-400/10 max-h-[60vh] overflow-y-auto"
			in:fade={{ duration: 300, easing: cubicOut }}
			out:fade={{ duration: 180, easing: cubicIn }}
		>
			<ModelManager />
		</div>
	{/if}
{/if}
