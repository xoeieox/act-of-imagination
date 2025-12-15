<script>
	import { session } from '$lib/stores/session.js';

	let { proposal } = $props();

	// Initialize editable fields - use $effect to reset if proposal changes
	let editedName = $state('');
	let editedEssence = $state('');

	$effect(() => {
		editedName = proposal.name;
		editedEssence = proposal.essence;
	});

	function accept() {
		session.acceptProposal(editedName, editedEssence);
	}

	function decline() {
		session.declineProposal();
	}
</script>

<!-- Modal backdrop -->
<div class="fixed inset-0 bg-depth-900/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
	<!-- Modal content -->
	<div class="bg-depth-700 border border-silver-400/20 rounded-2xl max-w-lg w-full p-6 animate-rise">
		<!-- Header -->
		<h2 class="font-serif text-xl text-silver-100 mb-2">Something wants to surface</h2>
		<p class="text-silver-400 text-sm mb-6">
			A shape has risen from the depths. Does this name feel right?
		</p>

		<!-- Card preview with editing -->
		<div class="card-container p-4 mb-6">
			<div class="shimmer-effect opacity-30"></div>
			<div class="relative z-10">
				<!-- Editable name -->
				<input
					type="text"
					bind:value={editedName}
					class="w-full bg-transparent border-b border-silver-400/30
						font-serif text-lg text-silver-100
						focus:outline-none focus:border-silver-400/60
						pb-1 mb-3"
					placeholder="Card name..."
				/>

				<!-- Editable essence -->
				<textarea
					bind:value={editedEssence}
					rows="4"
					class="w-full bg-transparent border border-silver-400/20 rounded-lg
						text-silver-300 text-sm p-3
						focus:outline-none focus:border-silver-400/40
						resize-y min-h-[100px] max-h-[200px]"
					placeholder="What does this represent..."
				></textarea>

				<!-- Type badge -->
				<div class="mt-3 flex items-center gap-2">
					<span class="text-xs text-silver-400 uppercase tracking-wider">Type:</span>
					<span class="text-xs text-silver-300 bg-depth-600 px-2 py-1 rounded">
						{proposal.type}
					</span>
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex gap-3">
			<button
				onclick={decline}
				class="flex-1 px-4 py-2 rounded-lg
					border border-silver-400/20 text-silver-400
					hover:border-silver-400/40 hover:text-silver-300
					transition-all duration-200"
			>
				Not yet
			</button>
			<button
				onclick={accept}
				class="flex-1 px-4 py-2 rounded-lg
					bg-silver-400/10 text-silver-200 border border-silver-400/30
					hover:bg-silver-400/20 hover:text-silver-100
					transition-all duration-200"
			>
				Yes, surface it
			</button>
		</div>
	</div>
</div>
