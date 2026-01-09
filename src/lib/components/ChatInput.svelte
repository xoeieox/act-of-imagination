<script>
	let { onSend, disabled = false } = $props();
	let inputValue = $state('');
	let textareaEl = $state(null);

	// Min and max heights (in pixels)
	const MIN_HEIGHT = 72; // ~3 rows
	const MAX_HEIGHT = 200; // ~8 rows

	function handleSubmit(e) {
		e.preventDefault();
		if (inputValue.trim() && !disabled) {
			onSend(inputValue);
			inputValue = '';
			// Reset height after sending
			if (textareaEl) {
				textareaEl.style.height = `${MIN_HEIGHT}px`;
			}
		}
	}

	function handleKeydown(e) {
		// Submit on Enter (without Shift)
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	}

	function handleInput() {
		if (!textareaEl) return;

		// Reset height to auto to get accurate scrollHeight
		textareaEl.style.height = 'auto';

		// Calculate new height within bounds
		const newHeight = Math.min(Math.max(textareaEl.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
		textareaEl.style.height = `${newHeight}px`;
	}
</script>

<form onsubmit={handleSubmit} class="relative">
	<textarea
		bind:this={textareaEl}
		bind:value={inputValue}
		onkeydown={handleKeydown}
		oninput={handleInput}
		{disabled}
		placeholder="Share what's on your mind..."
		style="min-height: {MIN_HEIGHT}px; max-height: {MAX_HEIGHT}px;"
		class="w-full bg-depth-700 border border-silver-400/20 rounded-xl px-4 py-3 pr-12
			text-silver-200 placeholder-silver-400/50
			focus:outline-none focus:border-silver-400/40 focus:ring-1 focus:ring-silver-400/20
			resize-none transition-colors duration-200 overflow-y-auto
			disabled:opacity-50 disabled:cursor-not-allowed"
	></textarea>

	<button
		type="submit"
		disabled={disabled || !inputValue.trim()}
		class="absolute right-3 bottom-3 p-2 rounded-lg
			bg-silver-400/10 text-silver-300
			hover:bg-silver-400/20 hover:text-silver-100
			disabled:opacity-30 disabled:cursor-not-allowed
			transition-all duration-200"
		aria-label="Send message"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
			<path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
		</svg>
	</button>
</form>
