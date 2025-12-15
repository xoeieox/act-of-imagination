<script>
	import { needsMigration, getMigrationSummary, migrateToSupabase, skipMigration } from '$lib/supabase/migrate.js';

	let {
		onComplete = () => {}
	} = $props();

	let isMigrating = $state(false);
	let error = $state(null);

	const summary = getMigrationSummary();

	async function handleMigrate() {
		isMigrating = true;
		error = null;

		const result = await migrateToSupabase();

		if (result.success) {
			onComplete();
		} else {
			error = result.error;
			isMigrating = false;
		}
	}

	function handleSkip() {
		skipMigration();
		onComplete();
	}
</script>

<div
	class="fixed inset-0 bg-depth-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
	role="dialog"
	aria-modal="true"
>
	<div class="bg-depth-700 border border-silver-400/20 rounded-2xl max-w-md w-full p-6 animate-rise">
		<h2 class="font-serif text-xl text-silver-100 mb-2">Sync your data?</h2>

		<p class="text-silver-400 text-sm mb-4">
			You have existing data stored locally. Would you like to sync it to your account?
		</p>

		<!-- Summary of local data -->
		{#if summary}
			<div class="bg-depth-800/50 rounded-xl p-4 mb-6 border border-silver-400/10">
				<div class="flex justify-around text-center">
					{#if summary.cardCount > 0}
						<div>
							<p class="text-silver-200 text-xl font-serif">{summary.cardCount}</p>
							<p class="text-silver-400/60 text-xs">cards</p>
						</div>
					{/if}
					{#if summary.messageCount > 0}
						<div>
							<p class="text-silver-200 text-xl font-serif">{summary.messageCount}</p>
							<p class="text-silver-400/60 text-xs">messages</p>
						</div>
					{/if}
					{#if summary.assemblyCount > 0}
						<div>
							<p class="text-silver-200 text-xl font-serif">{summary.assemblyCount}</p>
							<p class="text-silver-400/60 text-xs">assemblies</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if error}
			<p class="text-red-400 text-sm mb-4">{error}</p>
		{/if}

		<!-- Actions -->
		<div class="flex gap-3">
			<button
				onclick={handleSkip}
				disabled={isMigrating}
				class="flex-1 px-4 py-2 rounded-lg
					border border-silver-400/20 text-silver-400
					hover:border-silver-400/40 hover:text-silver-300
					transition-all duration-200
					disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Skip
			</button>
			<button
				onclick={handleMigrate}
				disabled={isMigrating}
				class="flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200
					bg-silver-400/10 text-silver-200 border border-silver-400/30
					hover:bg-silver-400/20 hover:border-silver-400/50
					disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if isMigrating}
					<span class="flex items-center justify-center gap-2">
						<span class="w-4 h-4 border-2 border-silver-400/30 border-t-silver-400 rounded-full animate-spin"></span>
						Syncing...
					</span>
				{:else}
					Sync to cloud
				{/if}
			</button>
		</div>

		<p class="text-silver-400/40 text-xs text-center mt-4">
			Your data will remain on this device either way.
		</p>
	</div>
</div>
