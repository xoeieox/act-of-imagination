<script>
	// Kyma-style model management panel (aoi-model-manager-v0, 2026-11-21).
	//
	// End users set up and test their own models entirely in the UI:
	//   - operator rows are read-only (managed by file on the server);
	//   - '+ Add model' opens the form: Label, Base URL, Model ID, API key
	//     (password field; may stay empty for local vLLM), Max tokens;
	//   - 'Test connection' shows the verdict + latency + sample line;
	//     a failing test blocks Save-as-healthy (Save as draft stays open);
	//   - edits PATCH the row (blank fields keep the stored values, the
	//     key shows masked as its last-4 fragment, and an explicit
	//     'remove key' clears the stored key);
	//   - after any mutation the selector state refreshes via
	//     modelStore.refresh(); the stored pick re-validates against the
	//     combined registry exactly as before.
	//
	// The panel only ever sees {key,label,source,status,hasKey,keyLast4}
	// rows (Kyma catalog rule): editing an existing row therefore shows
	// blank endpoint fields meaning "unchanged - type to replace".
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { modelStore } from '$lib/stores/model.js';

	/** @type {null | {mode:'add'|'edit', key?: string}} */
	let form = $state(null);
	let label = $state('');
	let endpoint = $state('');
	let modelId = $state('');
	let secret = $state('');
	let tokenCap = $state('');
	let removeKey = $state(false);
	let testing = $state(false);
	/** @type {{ok:boolean, verdict:string}|null} */
	let verdict = $state(null);
	/** @type {string|null} */
	let notice = $state(null);
	let confirmDelete = $state(null);

	const formValid = $derived(label.trim() !== '' && modelId.trim() !== '' && endpointOk(endpoint));
	const canSaveHealthy = $derived(formValid && verdict !== null && verdict.ok === true);
	const canSaveDraft = $derived(formValid && verdict === null);

	function endpointOk(value) {
		const v = String(value || '').trim();
		return /^https?:\/\//i.test(v);
	}

	function openAdd() {
		form = { mode: 'add' };
		label = '';
		endpoint = '';
		modelId = '';
		secret = '';
		tokenCap = '';
		removeKey = false;
		verdict = null;
		notice = null;
	}

	function openEdit(row) {
		form = { mode: 'edit', key: row.key };
		label = row.label;
		// The server never ships endpoint values back (catalog rule): blank
		// fields on save mean "keep the stored value"; keyLast4 confirms
		// which stored key is in play without exposing it.
		endpoint = '';
		modelId = '';
		secret = '';
		tokenCap = '';
		removeKey = false;
		verdict = null;
		notice = null;
	}

	function payload() {
		const body = {
			label: label.trim(),
			maxTokens: tokenCap.trim() === '' ? undefined : Number(tokenCap)
		};
		if (endpoint.trim() !== '') body.baseUrl = endpoint.trim();
		if (modelId.trim() !== '') body.model = modelId.trim();
		if (form?.mode === 'edit') {
			if (secret !== '') body.apiKey = secret;
			if (removeKey) body.apiKey = '';
		} else if (secret !== '') {
			body.apiKey = secret;
		}
		return body;
	}

	async function runTest() {
		if (!endpointOk(endpoint) || modelId.trim() === '') {
			notice = 'Enter the base URL and model id to test.';
			return;
		}
		testing = true;
		verdict = null;
		notice = null;
		try {
			const res = await fetch('/api/models/test', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					baseUrl: endpoint.trim(),
					model: modelId.trim(),
					...(secret !== '' ? { apiKey: secret } : {}),
					...(tokenCap.trim() === '' ? {} : { maxTokens: Number(tokenCap) })
				})
			});
			const data = await res.json();
			if (!res.ok) {
				verdict = { ok: false, verdict: `could not run the test (${data.error || 'error'})` };
			} else if (data.ok) {
				const legs =
					data.leg === 'both' ? 'models listing + chat' : `chat only (listing leg: ${data.leg})`;
				verdict = {
					ok: true,
					verdict: `healthy - ${data.latencyMs} ms - ${legs} - ${data.sample || 'ok'}`
				};
			} else {
				verdict = {
					ok: false,
					verdict: `failed${data.leg ? ` (${data.leg} leg passed only)` : ''} - ${data.error || 'no response'} - save as draft instead`
				};
			}
		} catch {
			verdict = { ok: false, verdict: 'connection test unreachable' };
		} finally {
			testing = false;
		}
	}

	async function save(status) {
		notice = null;
		const body = { ...payload(), status };
		try {
			const url =
				form?.mode === 'edit' ? `/api/models/${encodeURIComponent(form.key)}` : '/api/models';
			const res = await fetch(url, {
				method: form?.mode === 'edit' ? 'PATCH' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				notice =
					data.error === 'operator_model_readonly'
						? 'Operator models are managed by file.'
						: data.error || 'save failed';
				return;
			}
			await modelStore.refresh();
			form = null;
			verdict = null;
		} catch {
			notice = 'server unreachable';
		}
	}

	async function removeRow(key) {
		if (confirmDelete !== key) {
			confirmDelete = key;
			return;
		}
		confirmDelete = null;
		try {
			await fetch(`/api/models/${encodeURIComponent(key)}`, { method: 'DELETE' });
			await modelStore.refresh();
		} catch {
			notice = 'server unreachable';
		}
	}

	const operatorRows = $derived($modelStore.catalog.filter((row) => row.source === 'operator'));
	const userRows = $derived($modelStore.catalog.filter((row) => row.source === 'user'));
</script>

<div id="aoi-model-manager-body" class="text-sm" in:fade={{ duration: 200, easing: cubicOut }}>
	{#if !form}
		<h3 class="text-xs uppercase tracking-widest text-silver-400 mt-1 mb-1">Operator models</h3>
		{#if operatorRows.length === 0}
			<p class="text-xs text-silver-400/70 mb-2">none configured.</p>
		{:else}
			<ul class="mb-3">
				{#each operatorRows as row (row.key)}
					<li
						id="aoi-mm-op-{row.key}"
						class="flex items-center justify-between gap-2 py-1 text-sm text-silver-300"
					>
						<span>{row.label}</span>
						<span class="text-[10px] uppercase tracking-wider text-silver-400/60"
							>managed by file</span
						>
					</li>
				{/each}
			</ul>
		{/if}

		<h3 class="text-xs uppercase tracking-widest text-silver-400 mb-1">Your models</h3>
		{#if userRows.length === 0}
			<p class="text-xs text-silver-400/70 mb-2">No models yet - add one below.</p>
		{:else}
			<ul class="mb-2">
				{#each userRows as row (row.key)}
					<li
						id="aoi-mm-row-{row.key}"
						class="flex items-center justify-between gap-2 py-1 text-sm text-silver-200"
					>
						<span>
							{row.label}
							{#if row.status === 'draft'}
								<span class="text-[10px] uppercase tracking-wider text-amber-300/80">draft</span>
							{/if}
							{#if row.hasKey}
								<span class="text-[10px] text-silver-400/60">key ••{row.keyLast4 || '****'}</span>
							{/if}
						</span>
						<span class="flex gap-2 shrink-0">
							<button
								onclick={() => openEdit(row)}
								class="text-xs text-silver-400 hover:text-silver-200 transition-colors"
							>
								edit
							</button>
							<button
								onclick={() => removeRow(row.key)}
								class="text-xs {confirmDelete === row.key
									? 'text-red-300'
									: 'text-silver-400 hover:text-silver-200'} transition-colors"
							>
								{confirmDelete === row.key ? 'confirm?' : 'delete'}
							</button>
						</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if notice}
			<p id="aoi-mm-notice" class="text-xs text-red-300/90 mb-2">{notice}</p>
		{/if}

		<button
			id="aoi-mm-add"
			onclick={openAdd}
			class="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-silver-400/20 text-silver-200 hover:border-silver-400/40 transition-colors"
		>
			+ Add model
		</button>
	{:else}
		<h3 class="text-xs uppercase tracking-widest text-silver-400 mb-2">
			{form.mode === 'edit' ? 'Edit model' : 'Add model'}
		</h3>
		<label class="block text-xs text-silver-400 mb-1" for="aoi-mm-label">Label</label>
		<input
			id="aoi-mm-label"
			class="w-full bg-depth-900 text-silver-200 text-sm border border-silver-400/20 rounded-lg px-3 py-2 mb-2"
			bind:value={label}
			placeholder="My cloud model"
		/>
		<label class="block text-xs text-silver-400 mb-1" for="aoi-mm-baseurl">Base URL</label>
		<input
			id="aoi-mm-baseurl"
			class="w-full bg-depth-900 text-silver-200 text-sm border border-silver-400/20 rounded-lg px-3 py-2 mb-2"
			bind:value={endpoint}
			placeholder={form.mode === 'edit'
				? '(unchanged - type to replace)'
				: 'https://api.openai.com/v1 · https://openrouter.ai/api/v1 · http://<tailnet-ip>:8000/v1'}
		/>
		<label class="block text-xs text-silver-400 mb-1" for="aoi-mm-model">Model ID</label>
		<input
			id="aoi-mm-model"
			class="w-full bg-depth-900 text-silver-200 text-sm border border-silver-400/20 rounded-lg px-3 py-2 mb-2"
			bind:value={modelId}
			placeholder={form.mode === 'edit' ? '(unchanged - type to replace)' : 'model-id'}
		/>
		<label class="block text-xs text-silver-400 mb-1" for="aoi-mm-apikey"
			>API key (optional for local servers)</label
		>
		<input
			id="aoi-mm-apikey"
			type="password"
			class="w-full bg-depth-900 text-silver-200 text-sm border border-silver-400/20 rounded-lg px-3 py-2 mb-1"
			bind:value={secret}
			placeholder={form.mode === 'edit' ? '(stored key kept)' : 'sk-… (leave empty for local)'}
			autocomplete="off"
		/>
		{#if form.mode === 'edit'}
			<label class="flex items-center gap-2 text-xs text-silver-400 mb-2">
				<input type="checkbox" bind:checked={removeKey} />
				remove stored key
			</label>
		{/if}
		<label class="block text-xs text-silver-400 mb-1" for="aoi-mm-maxtokens"
			>Max tokens (optional)</label
		>
		<input
			id="aoi-mm-maxtokens"
			class="w-full bg-depth-900 text-silver-200 text-sm border border-silver-400/20 rounded-lg px-3 py-2 mb-3"
			bind:value={tokenCap}
			placeholder="4096"
			inputmode="numeric"
		/>

		<div class="flex flex-wrap gap-2 mb-2">
			<button
				id="aoi-mm-test"
				onclick={runTest}
				disabled={testing || !endpointOk(endpoint) || modelId.trim() === ''}
				class="px-3 py-2 text-sm rounded-lg border border-silver-400/30 text-silver-200 hover:border-silver-400/60 disabled:opacity-40 transition-colors"
			>
				{testing ? 'Testing…' : 'Test connection'}
			</button>
			<button
				id="aoi-mm-save-healthy"
				onclick={() => save('healthy')}
				disabled={!canSaveHealthy}
				title={canSaveHealthy ? '' : 'a passing connection test is required'}
				class="px-3 py-2 text-sm rounded-lg border border-emerald-400/40 text-emerald-200 hover:border-emerald-400/70 disabled:opacity-40 transition-colors"
			>
				Save
			</button>
			<button
				id="aoi-mm-save-draft"
				onclick={() => save('draft')}
				disabled={!canSaveDraft}
				class="px-3 py-2 text-sm rounded-lg border border-amber-400/30 text-amber-200 hover:border-amber-400/60 disabled:opacity-40 transition-colors"
			>
				Save as draft
			</button>
			<button
				id="aoi-mm-cancel"
				onclick={() => (form = null)}
				class="px-3 py-2 text-sm rounded-lg text-silver-400 hover:text-silver-200 transition-colors"
			>
				Cancel
			</button>
		</div>

		{#if verdict}
			<p
				id="aoi-mm-verdict"
				class="text-xs leading-snug {verdict.ok ? 'text-emerald-300/90' : 'text-red-300/90'}"
				in:fade={{ duration: 200, easing: cubicOut }}
			>
				{verdict.verdict}
			</p>
		{/if}
		{#if notice}
			<p id="aoi-mm-notice" class="text-xs text-red-300/90 mt-1">{notice}</p>
		{/if}
	{/if}
</div>
