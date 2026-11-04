<script>
	let { message } = $props();

	let isUser = $derived(message.role === 'user');
</script>

<div class="flex {isUser ? 'justify-end' : 'justify-start'}">
	<div class="{isUser ? 'message-user' : 'message-assistant'} px-4 py-3 max-w-[80%]">
		<p class="text-silver-200 whitespace-pre-wrap">{message.content}</p>
	</div>
</div>
