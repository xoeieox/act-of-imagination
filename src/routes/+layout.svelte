<script>
	import '../app.css';
	import { session, hasContent } from '$lib/stores/session.js';

	let { children } = $props();
	let showConfirm = $state(false);

	function handleNewSession() {
		if ($hasContent) {
			showConfirm = true;
		} else {
			session.reset();
		}
	}

	function confirmReset() {
		session.reset();
		showConfirm = false;
	}

	function cancelReset() {
		showConfirm = false;
	}
</script>

<div class="min-h-screen flex flex-col">
	<!-- Header -->
	<header class="py-4 px-6 border-b border-silver-400/10 flex items-center justify-between">
		<div class="w-24">
			<!-- Spacer for centering -->
		</div>

		<h1 class="font-serif text-xl text-silver-100 tracking-wide">
			Act of Imagination
		</h1>

		<div class="w-24 flex justify-end">
			{#if $hasContent}
				<button
					onclick={handleNewSession}
					class="text-silver-400 hover:text-silver-300 text-sm transition-colors"
					title="Start a new session"
				>
					New session
				</button>
			{/if}
		</div>
	</header>

	<!-- Confirmation modal -->
	{#if showConfirm}
		<div class="fixed inset-0 bg-depth-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div class="bg-depth-700 border border-silver-400/20 rounded-2xl max-w-sm w-full p-6 animate-rise">
				<h2 class="font-serif text-lg text-silver-100 mb-2">Start fresh?</h2>
				<p class="text-silver-400 text-sm mb-6">
					This will clear your current conversation and cards. This cannot be undone.
				</p>
				<div class="flex gap-3">
					<button
						onclick={cancelReset}
						class="flex-1 px-4 py-2 rounded-lg
							border border-silver-400/20 text-silver-400
							hover:border-silver-400/40 hover:text-silver-300
							transition-all duration-200"
					>
						Keep exploring
					</button>
					<button
						onclick={confirmReset}
						class="flex-1 px-4 py-2 rounded-lg
							bg-red-900/30 text-red-300 border border-red-400/30
							hover:bg-red-900/50 hover:text-red-200
							transition-all duration-200"
					>
						Start fresh
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Main content -->
	<main class="flex-1 flex">
		{@render children()}
	</main>
</div>
