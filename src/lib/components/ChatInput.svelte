<script>
	let { onSend, disabled = false } = $props();
	let inputValue = $state('');

	function handleSubmit(e) {
		e.preventDefault();
		if (inputValue.trim() && !disabled) {
			onSend(inputValue);
			inputValue = '';
		}
	}

	function handleKeydown(e) {
		// Submit on Enter (without Shift)
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	}
</script>

<form onsubmit={handleSubmit} class="relative">
	<textarea
		bind:value={inputValue}
		onkeydown={handleKeydown}
		{disabled}
		placeholder="Share what's on your mind..."
		rows="3"
		class="w-full bg-depth-700 border border-silver-400/20 rounded-xl px-4 py-3 pr-12
			text-silver-200 placeholder-silver-400/50
			focus:outline-none focus:border-silver-400/40 focus:ring-1 focus:ring-silver-400/20
			resize-none transition-all duration-200
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
