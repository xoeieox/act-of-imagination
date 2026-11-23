# AGENTS.md - act-of-imagination

## What this repo is

Act of Imagination (AoI) - a local-first introspection tool: guided chat that forms cards (theme/figure/place/tension/object/context), arrangement play, assemblies. SvelteKit 2 / Svelte 5 runes + Vite + Tailwind; server routes in src/routes/api/{chat,arrange,synopsis}; optional Supabase cloud sync with local-first (localStorage) fallback.

## Design rulings

- Deliberately standalone: no protocol/lineage/consent integration; personal material stays on the operator's machine.
- Runs entirely on your own machine: model access is env-only OpenAI-compatible lanes; no cloud provider is named in source and no default endpoint exists. Fail closed when unconfigured.
- Releases ship as files and repos; AoI sessions/content are explicitly not a corpus.

## Invariants (binding)

- Nothing in tracked app source names an endpoint or a cloud key.
- Server-only modules (src/lib/server/**) never import into client code; secrets never reach the bundle.
- Local-first data path (session.js/localStorage + env-gated Supabase) stays intact.
- Card-formation behavior (tool defs, context injection, 3-attempt continuation, 3-card gate) is behavior-preserved across refactors; fixture replay is the regression lock.

## Code reaches main via PR

Direct push to main is protected. Use feat/* and fix/* branches for human work; changes merge through reviewed pull requests.
