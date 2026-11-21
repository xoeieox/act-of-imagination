<script>
	// Compact model selector (aoi-modelselector-v0, 2026-11-21).
	//
	// Renders ONLY when the operator registry is non-empty ({#if} on
	// $modelStore.catalog.length below - registry unconfigured = hidden =
	// byte-identical to the pre-selector chrome). Labels are the only
	// registry content that can ever reach this component: the catalog
	// carries {key,label} and nothing else (Kyma catalog rule).
	//
	// Lives inside the hamburger menu chrome, matching the aoi-motion
	// idiom: enters ~300ms ease-out (menu entries come in at 480; the
	// selector is subordinate chrome), exits ~180ms ease-in.
	import { fade } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { modelStore } from '$lib/stores/model.js';

	$effect(() => {
		// Catalog fetch is a no-op outside the browser; one call per mount.
		modelStore.load();
	});

	function handleChange(event) {
		const value = event.currentTarget.value;
		modelStore.select(value === '' ? null : value);
	}
</script>

{#if $modelStore.catalog.length > 0}
	<div
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
				<option value={model.key}>{model.label}</option>
			{/each}
		</select>
	</div>
{/if}
