# SHAPES.md - act-of-imagination

A butcher's diagram of this codebase at three altitudes, per the SHAPES convention. VISION.md is where this wants to go; this file is what is actually here, and what you can carve from it. The two files are disjoint on purpose: shapes never says where things want to go; vision never cites a file.

## 1. Header block

- Shape names (this repo supplies five, S1-S5 below): `guided-crystallization-loop`, `single-variable-arrangement-play`, `iteration-timeline-as-artifact`, `local-first-session-store`, `fail-closed-operator-lanes`
- Source: this repository at commit `0e0032b` (main, fetched/verified 2026-11-23)
- License: MIT per LICENSE (holder: Lapis)
- Last-verified: 2026-11-23 - all file pointers in section 5 were checked against the working tree at the pinned commit. Re-pin before citing elsewhere.
- Convention: SHAPES.md convention (three altitudes: intention, shape, implementation-pointer; functional-need search fields are the ratified Seams extension).

## 2. INTENTION - what the code is for, in plain language

This is a local-first tool for guided self-reflection with AI. A conversation helps personal material surface; the material crystallizes into named "cards"; you place cards in arrangements against a context lens and read back an AI narrative of how the elements interact. It runs entirely on your own machine: model access is any OpenAI-compatible endpoint you declare via env, and nothing leaves your machine unless you deliberately release it.

## 3. SHAPE - the borrowable abstractions (language-portable; rebuildable without this codebase)

Each element is stated so it can be reimplemented in any language from this section alone.

**S1 `guided-crystallization-loop`.** An AI conversation instruments itself with card-formation tools - detect forming card, deepen card, propose card naming - so cards emerge from dialogue at their own pace rather than from a form. The model decides when material has substance; the UI proposes, the user confirms. A bounded continuation (up to 3 attempts) lets a forming card finish forming within the same turn. Free-form input out, named typed artifacts in, no forms, no wizards.

**S2 `single-variable-arrangement-play`.** N elements (3+) placed into slots, plus one named context lens (from a fixed deck: Crisis, Solitude, Community, Transition, Creation, Loss, Waiting, Conflict), produce one generated narrative over the arrangement. The unit of inquiry is the controlled swap: freeze everything, exchange exactly one element (or the lens), regenerate, read the two narratives side by side. Configuration is the experiment; the comparison view is the instrument.

**S3 `iteration-timeline-as-artifact`.** Arrangement configurations are saved whole - card snapshots and context snapshots, not references - so history survives edits to the originals. Iterations form a timeline; branches appear when a saved configuration is swapped-and-resaved. The artifact is the visible diff of stories, not a statistic about them.

**S4 `local-first-session-store`.** The local store (browser storage) is the primary, always-available path; sessions keep working with zero backend. A cloud overlay is optional, env-gated, and purely additive: first sign-in offers a one-time migration prompt, and after that the cloud is cross-device sync only. Absence of cloud changes reach, never function.

**S5 `fail-closed-operator-lanes`.** Model endpoints exist only as operator-declared registry entries (a file) and user-stored rows (a store directory); the app source names no endpoint, bakes no default, and reads "unconfigured" as "off". The client-facing catalog ships `{key, label, source, hasKey?}` only - base URLs, model ids, and credentials never cross the server boundary. Selection resolves server-side; an unknown or malformed key fails closed with a fixed-string 400, never a silent fallback.

## 4. FUNCTIONAL-NEED SEARCH FIELDS (Seams extension, ratified 2026-11-22)

- Need: an instrumented conversation that distills free-form material into named, typed artifacts without a form UI
- Need: A/B narrative comparison over a frozen configuration where exactly one element is swapped
- Need: offline-first persistence with an optional, gated cloud overlay and explicit one-time migration
- Need: user-facing model selection where no endpoint or credential is ever baked into the app or leaked to the client

## 5. IMPLEMENTATION - pointers at the pinned commit (tree-verified)

All paths below were verified to exist in the tree at `0e0032b` (2026-11-23). One-line roles are structural - derived from file names, the build graph, and the test suite; read the file before depending on a role.

- **S1**: `src/routes/api/chat/+server.js` (tool defs + bounded continuation), `src/lib/server/lane.js` (lane env plumbing), `src/lib/components/CardProposal.svelte`, `src/lib/components/Card.svelte`; regression lock: `src/lib/__tests__/replay.test.js` (fixture replay).
- **S2**: `src/routes/api/arrange/+server.js`, `src/lib/server/arrange-prompt.js` (context-lens narrative), `src/lib/components/ArrangementPlay.svelte`, `src/lib/data/contexts.js` (the context deck).
- **S3**: `src/lib/components/IterationComparison.svelte`, `src/lib/components/AssemblyTimeline.svelte`, `src/lib/components/AssemblySave.svelte`, `src/lib/arrangements.js`, `src/lib/supabase/assemblies.js`.
- **S4**: `src/lib/stores/session.js` (localStorage primary), `src/lib/supabase/migrate.js`, `src/lib/components/MigrationPrompt.svelte`, `src/lib/components/LaneGate.svelte`.
- **S5**: `src/lib/server/modelStore.js` (operator registry file + user store, `AOI_MODEL_STORE_DIR` test seam), `src/lib/server/modelRegistry.js` (catalog privacy rule, fail-closed resolution), `src/lib/server/modelProbe.js`, `src/lib/components/ModelManager.svelte`, `src/lib/components/ModelSelector.svelte`; regression locks: `src/lib/server/modelStore.test.js`, `src/lib/server/modelRegistry.test.js`.

## 6. Ledger

- `guided-crystallization-loop | act-of-imagination@0e0032b | MIT | 2026-11-23`
- `single-variable-arrangement-play | act-of-imagination@0e0032b | MIT | 2026-11-23`
- `iteration-timeline-as-artifact | act-of-imagination@0e0032b | MIT | 2026-11-23`
- `local-first-session-store | act-of-imagination@0e0032b | MIT | 2026-11-23`
- `fail-closed-operator-lanes | act-of-imagination@0e0032b | MIT | 2026-11-23`
