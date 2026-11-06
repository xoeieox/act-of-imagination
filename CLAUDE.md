# CLAUDE.md - act-of-imagination

Seed docs spine (pipeline, 2026-11-04; gate invariant-context prerequisite). Repo constitution follows in later legs.

## What this repo is

Act of Imagination (AoI) - a local-first introspection tool: guided chat that forms cards (theme/figure/place/tension/object/context), arrangement play, assemblies. SvelteKit 2 / Svelte 5 runes + Vite + Tailwind; server routes in src/routes/api/{chat,arrange,synopsis}; optional Supabase cloud sync with local-first (localStorage) fallback. First of the two-release punch (AoI before Kyma; Erah ruling 2026-11-02).

## Governing rulings

- AIR-GAPPED from the Seams protocol by design (decision/aoi-airgap-and-thread-investigation-2026-11-02): no protocol/lineage/consent integration; personal material stays on the operator's machine.
- Runs entirely on your own machine: model access is env-only OpenAI-compatible lanes (Kyma lane doctrine); no cloud provider is named in source and no default endpoint exists. Fail closed when unconfigured.
- Releases ship as files and repos; AoI sessions/content are explicitly NOT a corpus (decision/ai-release-shape-files-repos-plus-attesting-expert-2026-07-28).

## Invariants (binding; full list in spec aoi-repo-polish-v0)

- Nothing in tracked app source names an endpoint or a cloud key.
- Server-only modules (src/lib/server/**) never import into client code; secrets never reach the bundle.
- Local-first data path (session.js/localStorage + env-gated Supabase) stays intact.
- Card-formation behavior (tool defs, context injection, 3-attempt continuation, 3-card gate) is behavior-preserved across refactors; fixture replay is the regression lock.

## Code reaches main via PR

Direct push to main is protected. Branch lapis/<target>/<desc> for pipeline work; feat/* and fix/* for human work. Review + ratification per Lapis PM pipeline (advisory authority).
