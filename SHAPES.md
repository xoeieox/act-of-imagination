# SHAPES.md - act-of-imagination (reconciled draft, 2026-11-24)

Reconciliation notes (what came from where):
- Base: the signed-off SHAPES.md (landed at 0e0032b via commit 770f876, 2026-11-23) - its structure, five-shape framing, and voice kept throughout.
- From the new draft (5012d55): verified updates only - pin moved to 496bae5, expanded functional-need fields, the file-backed registry form (checked against pinned code), and the README-lag honesty note.
- Contradiction 1 (pin): old pinned 0e0032b, new verified 496bae5 same-session - resolved to 496bae5; all old implementation pointers re-verified present there.
- Contradiction 2 (registry form): old + README say env-array; pinned code (modelRegistry.js) is file-backed with env-array deprecated - resolved to the code, README flagged stale.
- Scrubbed: deposit-strategy framing, owner-GO status, and other lab-internal references.
- DRAFT - no commit, no push made or implied.

---

# SHAPES.md - act-of-imagination

A butcher's diagram of this codebase at three altitudes, per the SHAPES convention. VISION.md is where this wants to go; this file is what is actually here, and what you can carve from it. The two files are disjoint on purpose: shapes never says where things want to go; vision never cites a file.

## 1. Header block

- Shape names (this repo supplies five, S1-S5 below): `guided-crystallization-loop`, `single-variable-arrangement-play`, `iteration-timeline-as-artifact`, `local-first-session-store`, `fail-closed-operator-lanes`
- Source: https://github.com/xoeieox/act-of-imagination (public, default branch `main`) at commit `496bae536da12c5448b1675070ba7786925b44cf` (main HEAD, fetched/verified 2026-11-23; supersedes the earlier 0e0032b pin - SHAPES.md's own pointer table below was re-checked at the new sha)
- License: MIT per LICENSE (holder: Lapis)
- Last-verified: 2026-11-23 at the pinned commit - the section 5 pointers were checked against the tree at `496bae5`, and the code-level claims in S1/S3/S4 against the pinned files. Re-pin before citing elsewhere.
- Convention: SHAPES.md convention (three altitudes: intention, shape, implementation-pointer; functional-need search fields are the ratified Seams extension, 2026-11-22).

## 2. INTENTION - what the code is for, in plain language

This is a local-first tool for guided self-reflection with AI. A conversation helps personal material surface; the material crystallizes into named "cards" (through three states: submerged, rising, surfaced); you place cards in arrangements against a context lens (Crisis, Solitude, Community, Transition, Creation, Loss, Waiting, Conflict) and read back an AI narrative of how the elements interact. The unit of inquiry is the controlled swap: freeze everything, change exactly one thing, and read the two narratives side by side. It runs entirely on your own machine: model access is any OpenAI-compatible endpoint you declare via env, and nothing leaves your machine unless you deliberately release it.

## 3. SHAPE - the borrowable abstractions (language-portable; rebuildable without this codebase)

Each element is stated so it can be reimplemented in any language from this section alone.

**S1 `guided-crystallization-loop`.** An AI conversation instruments itself with card-formation tools - `detect_forming_card`, `deepen_card`, `propose_card_naming` - so cards emerge from dialogue at their own pace rather than from a form. The model decides when to call the tools; the system prompt carries the pacing policy ("use sparingly", "don't lead toward predetermined outcomes") instead of scripted flows. The UI proposes, the user confirms. A bounded continuation loop (up to 3 attempts) converts tool-only turns back into conversational text, with humane fallback text so no turn is silently empty. Free-form input out, named typed artifacts in; no forms, no wizards.

**S2 `single-variable-arrangement-play`.** N elements (3+) placed into slots, plus one named context lens (from the fixed deck above), produce one generated narrative over the arrangement. The unit of inquiry is the controlled swap: freeze everything, exchange exactly one element (or the lens), regenerate, read the two narratives side by side. Configuration is the experiment; the comparison view is the instrument.

**S3 `iteration-timeline-as-artifact`.** Arrangement configurations are saved whole - card snapshots and context snapshots, not references - so history survives edits to the originals. Iterations form a timeline; branches appear when a saved configuration is swapped-and-resaved. The artifact is the visible diff of stories, not a statistic about them.

**S4 `local-first-session-store`.** The local store (browser storage) is the primary, always-available path; sessions keep working with zero backend. A cloud overlay is optional, env-gated, and purely additive: first sign-in with existing local data offers a one-time migration prompt, and after that the cloud is cross-device sync only (the anon key is safe in the browser only because the schema is row-level-security protected). Absence of cloud changes reach, never function.

**S5 `fail-closed-operator-lanes`.** Model endpoints exist only as operator-declared configuration: per-feature lanes resolved from `AOI_LLM_<LANE>_<FIELD>` env vars (CHAT | ARRANGE | SYNOPSIS, with lane values overriding shared defaults), plus a runtime registry of named entries. The registry is file-backed - an operator file plus user-managed rows written through the API, with the older `AOI_MODELS_JSON` env array kept as a deprecated fallback. The app source names no endpoint, bakes no default, and reads "unconfigured" as "off": every API route answers HTTP 501 with a machine-readable body (`llm_lane_unconfigured`, plus a hint naming the needed env vars) and the app boots to a rendered "configure a lane" state instead of an error. Upstream failures are their own shape (502 `llm_lane_upstream`). The client-facing catalog ships `{key, label, source, hasKey?}` only - base URLs, model ids, and credentials never cross the server boundary. Selection resolves server-side per request; an unknown or malformed key fails closed with a fixed-string 400, never a silent fallback, and a selection still rides its lane's fail-closed gate.

## 4. FUNCTIONAL-NEED SEARCH FIELDS (Seams extension, ratified 2026-11-22)

- Need: local-first AI journaling / introspection that never phones home - conversation material stays on the operator's machine unless the operator points it elsewhere
- Need: an introspection tool that fails closed - with no model configured it refuses honestly (501 `llm_lane_unconfigured`) instead of quietly shipping personal material to a default cloud
- Need: an instrumented conversation that distills free-form material into named, typed artifacts without a form UI
- Need: runtime model selection without rebuild - swap which model (or which server) a feature talks to by editing an env file or a JSON file and restarting, never rebuilding
- Need: A/B narrative comparison over a frozen configuration where exactly one element is swapped
- Need: a self-hostable OpenAI-compatible client whose entire model-config surface is environment variables, usable with Ollama, llama.cpp server, vLLM, SGLang, or any gateway speaking `/chat/completions`
- Need: offline-first persistence with an optional, gated cloud overlay and explicit one-time migration
- Need: user-facing model selection where no endpoint or credential is ever baked into the app or leaked to the client

## 5. IMPLEMENTATION - pointers at the pinned commit (tree-verified)

All paths below were verified to exist in the tree at `496bae5` (2026-11-23). One-line roles are structural - derived from file names, the build graph, and the test suite; read the file before depending on a role.

- **S1**: `src/routes/api/chat/+server.js` (tool defs + bounded continuation), `src/lib/server/lane.js` (lane env plumbing, fail-closed resolution), `src/lib/components/CardProposal.svelte`, `src/lib/components/Card.svelte`; regression locks: `src/lib/__tests__/replay.test.js` (fixture replay), `src/routes/api/fail-closed.test.js`, `src/routes/honest-first-run.test.js`, plus CI invariant greps in `scripts/check-invariants.js`.
- **S2**: `src/routes/api/arrange/+server.js`, `src/lib/server/arrange-prompt.js` (context-lens narrative), `src/lib/components/ArrangementPlay.svelte`, `src/lib/data/contexts.js` (the context deck).
- **S3**: `src/lib/components/IterationComparison.svelte`, `src/lib/components/AssemblyTimeline.svelte`, `src/lib/components/AssemblySave.svelte`, `src/lib/arrangements.js`, `src/lib/supabase/assemblies.js`.
- **S4**: `src/lib/stores/session.js` (localStorage primary), `src/lib/supabase/migrate.js`, `src/lib/components/MigrationPrompt.svelte`, `src/lib/components/LaneGate.svelte`.
- **S5**: `src/lib/server/modelStore.js` (operator registry file + user store, `AOI_MODEL_STORE_DIR` test seam), `src/lib/server/modelRegistry.js` (catalog privacy rule, fail-closed resolution), `src/lib/server/modelProbe.js`, `src/lib/components/ModelManager.svelte`, `src/lib/components/ModelSelector.svelte`; regression locks: `src/lib/server/modelStore.test.js`, `src/lib/server/modelRegistry.test.js`.

Running it (from README): `npm install`; `cp .env.example .env` and set at least `AOI_LLM_BASE_URL` + `AOI_LLM_MODEL` pointing at any OpenAI-compatible endpoint (a local Ollama at `http://127.0.0.1:11434/v1` works); `npm run dev`, open localhost:5173. It boots with no `.env` at all into the fail-closed state. Dev gate: `npm run ci` = lint + format:check + test + build; tests are offline vitest suites plus prompt-replay YAML fixtures. Node >= 20, ESM; deploy target is swappable to any Node host (the Vercel adapter default is just the shipped choice).

## 6. Closing honesty

Known gaps, stated: (1) README's operator-registry section describes the `AOI_MODELS_JSON` env form, while the pinned code is file-backed (`modelRegistry.js`) - README lags the code at this sha; this doc follows the code and flags the README as stale on that point. (2) `src/lib/server/modelStore.js`, the arrange/synopsis routes, and the Supabase schema were not read at body level this pass; their roles are stated from the tree listing, file names, and README's project-structure section. (3) Stars/license/HEAD are point-in-time 2026-11-23; the ledger lines pin the commit so nothing shifts behind anyone's back. Line references and code-level claims were checked at the pinned commit; nothing quotes a code body - pointers only, per the hard fence.

## 7. Ledger

- `guided-crystallization-loop | act-of-imagination@496bae5 | MIT | 2026-11-23`
- `single-variable-arrangement-play | act-of-imagination@496bae5 | MIT | 2026-11-23`
- `iteration-timeline-as-artifact | act-of-imagination@496bae5 | MIT | 2026-11-23`
- `local-first-session-store | act-of-imagination@496bae5 | MIT | 2026-11-23`
- `fail-closed-operator-lanes | act-of-imagination@496bae5 | MIT | 2026-11-23`
