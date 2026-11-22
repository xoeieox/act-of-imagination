<!--
	Honest first run.

	The zero-lane state rendered by the shell's server load - it appears in
	the initial HTML with zero API fetch. The hint text arrives as data from
	+page.server.js (computed by the server-only lane module), so env-var
	names never enter the client bundle (I-6).
-->
<script>
	let { hint = '' } = $props();
</script>

<div
	id="lane-gate"
	role="status"
	class="mx-auto my-4 max-w-2xl rounded-xl border border-silver-400/20 bg-depth-700/60 px-5 py-4"
>
	<h2 class="font-serif text-silver-100 text-base mb-1">Configure a lane to begin</h2>
	<p class="text-silver-400 text-sm mb-2">
		No model lane is configured yet. This app fails closed by design: personal conversation material
		never leaves your machine unless you point it at an OpenAI-compatible endpoint you run yourself.
	</p>
	<p class="text-silver-400/80 text-xs leading-relaxed">
		{hint}
	</p>
</div>
