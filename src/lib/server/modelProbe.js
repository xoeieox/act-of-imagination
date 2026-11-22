/**
 * Connection probe for the model manager (2026-11-21).
 *
 * Deliberately imports no filesystem module at all (locked by
 * check-invariants I-9): the test path can never persist anything - probe
 * payloads live only for the duration of the request.
 *
 * Relay lesson: a bare 404 on GET {base}/models while chat works is
 * a KNOWN relay quirk, so the probe runs GET {base}/models FIRST and a
 * minimal chat round-trip SECOND, and reports which leg(s) passed. The
 * chat leg is the decisive verdict: ok=true only when a minimal
 * completion actually came back (a failing test blocks save-as-healthy).
 *
 * Redaction: any error string is scrubbed of the apiKey value and capped,
 * so an upstream echo can never carry the credential back to a client.
 */

const TIMEOUT_MS = 15000;

function redact(text, secret) {
	let out = typeof text === 'string' ? text : String(text ?? '');
	const secrets = Array.isArray(secret) ? secret : [secret];
	for (const s of secrets) {
		if (typeof s === 'string' && s !== '' && out.includes(s)) {
			out = out.split(s).join('[redacted]');
		}
	}
	return out.slice(0, 300);
}

async function timed(fetchImpl, url, init, timeoutMs) {
	const started = Date.now();
	const ctrl = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		ctrl.abort();
	}, timeoutMs);
	try {
		const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
		return { res, ms: Date.now() - started };
	} catch (err) {
		const wrapped = new Error(`probe fetch failed: ${classifyProbeError(err, timedOut)}`);
		wrapped.probeClass = classifyProbeError(err, timedOut);
		throw wrapped;
	} finally {
		clearTimeout(timer);
	}
}

function firstModelId(data) {
	const list = Array.isArray(data?.data)
		? data.data
		: Array.isArray(data?.models)
			? data.models
			: null;
	if (!list) return null;
	const first = list.find((m) => m && typeof m.id === 'string' && m.id);
	return first ? first.id : null;
}

/**
 * Classify a thrown fetch error into an honest failure class so the
 * verdict line matches what actually happened (fixed 2026-11-21: a
 * refused connection must read as transport-unreachable, not as a
 * generic probe failure).
 *   'timeout'    - the probe timer aborted the request
 *   'transport'  - curl-7-style: connection refused / host unreachable
 *   'unknown'    - neither (never claims a class it cannot support)
 */
function classifyProbeError(err, timedOut) {
	if (timedOut) return 'timeout';
	const name = typeof err?.name === 'string' ? err.name : '';
	const causeName = typeof err?.cause?.name === 'string' ? err.cause.name : '';
	const code = String(err?.cause?.code || err?.code || '').toUpperCase();
	const causeMsg = String(err?.cause?.message || '');
	if (name === 'AbortError' || causeName === 'AbortError') return 'timeout';
	if (/^E(CONNREFUSED|CONNRESET|HOSTUNREACH|NETUNREACH|NOTFOUND|AI_AGAIN|PIPE)$/.test(code))
		return 'transport';
	if (/^UND_ERR_(CONNECT|SOCKET)/.test(code)) return 'transport';
	if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ECONNRESET|ENOTFOUND/i.test(causeMsg))
		return 'transport';
	if (name === 'TypeError' && err?.cause) return 'transport';
	return 'unknown';
}

/**
 * Probe one OpenAI-compatible config {baseUrl, model, apiKey?, maxTokens?}
 * plus the advanced-auth trio {authMode?, extraHeaders?, userAgent?}
 * (2026-11-21): the probe carries the FULL auth config so a
 * passing Test proves the exotic wire shape too; every advanced VALUE
 * is redaction-list material.
 * Returns { ok, latencyMs, leg, sample?, error? } where leg is
 * 'both' | 'chat' | 'models' | null:
 *   ok=true  -> chat round-trip succeeded (leg 'both' if the listing
 *               answered too, 'chat' when /models 404'd - the quirk)
 *   ok=false -> chat leg failed; leg 'models' means the listing answered
 *               but chat did not (reachable-but-broken: draft only).
 * Never throws; every failure surfaces as a generic redacted error.
 */
export async function probeModelConfig(config, { fetchImpl, timeoutMs = TIMEOUT_MS } = {}) {
	const doFetch = fetchImpl || globalThis.fetch;
	if (typeof doFetch !== 'function') {
		return { ok: false, latencyMs: 0, leg: null, error: 'probe_unavailable' };
	}
	const baseUrl = String(config.baseUrl || '').replace(/\/+$/, '');
	const model = String(config.model || '');
	const apiKey = typeof config.apiKey === 'string' && config.apiKey !== '' ? config.apiKey : null;
	const headers = { 'content-type': 'application/json' };
	// Advanced auth: the probe runs the row's FULL
	// auth config, so Test validates exactly the shape chat will send:
	// 'raw' ships the key verbatim (no 'Bearer ' prefix), extraHeaders
	// merge onto both legs, a UA override replaces fetch's default. Every
	// advanced VALUE joins the redaction set - upstream echoes can never
	// carry a credential (or a session id) back to a client.
	const authMode = config.authMode === 'raw' ? 'raw' : 'bearer';
	if (apiKey) headers.authorization = authMode === 'raw' ? apiKey : `Bearer ${apiKey}`;
	const secretValues = apiKey ? [apiKey] : [];
	if (
		config.extraHeaders &&
		typeof config.extraHeaders === 'object' &&
		!Array.isArray(config.extraHeaders)
	) {
		for (const [rawName, value] of Object.entries(config.extraHeaders)) {
			if (typeof value !== 'string' || value === '') continue;
			headers[String(rawName).trim().toLowerCase()] = value;
			secretValues.push(value);
		}
	}
	const userAgentValue =
		typeof config.userAgent === 'string' && config.userAgent.trim() !== ''
			? config.userAgent.trim()
			: null;
	if (userAgentValue) {
		headers['user-agent'] = userAgentValue;
		secretValues.push(userAgentValue);
	}

	// Leg 1: GET {base}/models (the listing probe).
	let modelsOk = false;
	let modelsStatus;
	let modelsSample = null;
	let modelsMs = 0;
	let modelsClass = 'unknown';
	try {
		const { res, ms } = await timed(
			doFetch,
			`${baseUrl}/models`,
			{ method: 'GET', headers },
			timeoutMs
		);
		modelsMs = ms;
		modelsStatus = res.status;
		if (res.ok) {
			modelsOk = true;
			try {
				modelsSample = firstModelId(await res.json());
			} catch {
				modelsSample = null; // listing shape unknown; leg still passed
			}
		}
	} catch (err) {
		modelsClass = err?.probeClass || 'unknown';
		modelsStatus = 0; // transport error / timeout: treated as no-answer
	}

	// Leg 2: minimal chat round-trip - the decisive leg.
	let chatOk = false;
	let chatMs = 0;
	let chatError = '';
	let chatSample = null;
	try {
		const maxTokens = Math.min(Number(config.maxTokens) > 0 ? Number(config.maxTokens) : 16, 32);
		const { res, ms } = await timed(
			doFetch,
			`${baseUrl}/chat/completions`,
			{
				method: 'POST',
				headers,
				body: JSON.stringify({
					model,
					messages: [{ role: 'user', content: 'ping' }],
					max_tokens: maxTokens
				})
			},
			timeoutMs
		);
		chatMs = ms;
		if (res.ok) {
			let data = null;
			try {
				data = await res.json();
			} catch {
				chatError = 'chat probe returned a non-JSON response';
			}
			const choice = data && Array.isArray(data.choices) ? data.choices[0] : null;
			const message = choice?.message || {};
			const text =
				typeof message.content === 'string' && message.content.trim()
					? message.content.trim()
					: typeof message.reasoning_content === 'string'
						? message.reasoning_content.trim()
						: '';
			if (data && choice) {
				chatOk = true;
				chatSample = (text || 'completion ok').slice(0, 120);
			} else {
				chatError = 'chat probe returned no completion choice';
			}
		} else {
			let detail = '';
			try {
				detail = (await res.text()).slice(0, 200);
			} catch {
				/* no detail */
			}
			chatError = detail
				? `chat probe responded ${res.status}: ${detail}`
				: `chat probe responded ${res.status}`;
		}
	} catch (err) {
		const cls = err?.probeClass || 'unknown';
		if (cls === 'transport') chatError = 'model not reachable from this server';
		else if (cls === 'timeout') chatError = 'connection test timed out - no answer in time';
		else chatError = 'chat probe failed (unexpected transport error)';
	}

	if (chatOk) {
		return {
			ok: true,
			latencyMs: chatMs,
			leg: modelsOk ? 'both' : 'chat',
			sample: chatSample || 'completion ok'
		};
	}
	if (modelsOk) {
		return {
			ok: false,
			latencyMs: modelsMs,
			leg: 'models',
			sample: modelsSample || undefined,
			error: redact(chatError || 'chat leg failed', secretValues)
		};
	}
	const detail =
		chatError ||
		(modelsStatus
			? `models probe responded ${modelsStatus}`
			: modelsClass === 'transport'
				? 'model not reachable from this server'
				: modelsClass === 'timeout'
					? 'connection test timed out - no answer in time'
					: 'endpoint unreachable');
	return {
		ok: false,
		latencyMs: modelsMs + chatMs,
		leg: null,
		error: redact(detail, secretValues)
	};
}
