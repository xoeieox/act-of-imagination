# Act of Imagination

A web application for personal exploration through AI-assisted conversation. Cards rise from the unconscious like shapes through murky water.

## Run entirely on your own machine

Act of Imagination is local-first by design: your conversation material is personal and
stays on your machine. The app ships **no cloud keys, no baked-in endpoints, and no default
provider** - the model it talks to is whatever OpenAI-compatible endpoint you point it at via
the `AOI_LLM_*` environment lanes (see `.env.example`). Any local model server that speaks
`/chat/completions` works - Ollama, llama.cpp's server, vLLM, SGLang, or a gateway you
configure yourself. If no lane is configured, the app **fails closed**: the API routes answer
`501 llm_lane_unconfigured` and nothing leaves your machine. This is the positioning from the
local-AI community's core ask - a genuinely local introspection tool, not a thin client for
someone else's cloud.

If you operate your own instance and want the `/dev` test-data panel available on a
production build, set `AOI_DEV_PANEL=1` in the server environment before starting it - on
trusted local/tailnet instances only; with the flag unset (the default) `/dev` stays a
404, and it must never be enabled on a public deployment.

## Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment**

   ```bash
   cp .env.example .env
   # Edit .env and configure at least one LLM lane (shared or per-route).
   # Optionally add Supabase credentials for cloud persistence.
   ```

   Required (for the conversation, arrangement, and synopsis features to run):
   - `AOI_LLM_BASE_URL` + `AOI_LLM_MODEL` - an OpenAI-compatible
     `/chat/completions` endpoint (e.g. a local model server:
     `AOI_LLM_BASE_URL=http://127.0.0.1:11434/v1`), or per-lane overrides
     `AOI_LLM_<CHAT|ARRANGE|SYNOPSIS>_{PROVIDER,BASE_URL,MODEL,API_KEY,MAX_TOKENS}`

   Optional (for cloud persistence):
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

   The app boots **without any `.env` at all**: the conversation shell renders a
   "configure a lane" state and the API routes answer `501 llm_lane_unconfigured`
   with a hint naming the variables above. Nothing is tried against a default
   endpoint - fail closed is the first-class state, not an error you discover.

3. **Run development server**

   ```bash
   npm run dev
   ```

4. **Open** http://localhost:5173

## Features

### Conversation Phase

- Share thoughts, dreams, tensions with an AI guide
- AI notices patterns and recurring themes
- Cards begin forming as murky shapes in the sidebar

### Card Formation

- **Submerged** - Shape detected, hint visible but blurred
- **Rising** - Card deepens through conversation, becomes clearer
- **Surfaced** - Named and crystallized, fully visible

### Context Deck

8 system contexts for exploring card interactions:

- **Crisis** - A moment of urgency and decision
- **Solitude** - Alone with what matters
- **Community** - Among others, seeking belonging
- **Transition** - Between what was and what will be
- **Creation** - Making something new
- **Loss** - Facing absence and grief
- **Waiting** - Suspended in anticipation
- **Conflict** - Forces in opposition

Custom context cards are plain create / edit / delete in the deck (user-context CRUD).
Guided-conversation context creation is **not shipped** - it is a deferred future target
(post-release backlog), kept here as the pointer so the idea isn't lost.

### Arrangement Play

- Once 3+ cards surface, enter arrangement mode
- Place cards in slots and select a context
- AI generates evocative narrative of how the cards interact
- Save arrangements as assemblies with AI-generated synopses

### Assembly History & Iteration

- View timeline of all iterations for an assembly
- Compare iterations side-by-side
- Filter by cards used
- Star favorite iterations
- Explore how swapping cards changes the narrative

### Navigation & Views

- **Welcome Screen** - For returning users with stats and quick actions
- **Hamburger Menu** - Access home, conversation, cards, assemblies
- **Card Library** - Browse all surfaced and forming cards
- **Assembly List** - View and manage saved assemblies

### Session Persistence

- Sessions automatically save to localStorage
- Optional Supabase integration for cloud sync
- Migration prompt when first signing in with existing local data
- Refresh the page and pick up where you left off

## Project Structure

```
src/
├── routes/
│   ├── +layout.svelte          # App shell with navigation
│   ├── +page.svelte            # Main page with phase switching
│   ├── auth/+page.svelte       # Sign in / sign up
│   └── api/
│       ├── chat/+server.js     # Conversation + card detection
│       ├── arrange/+server.js  # Arrangement narrative generation
│       └── synopsis/+server.js # Assembly synopsis generation
├── lib/
│   ├── components/
│   │   ├── Card.svelte             # Card with water overlay effect
│   │   ├── CardProposal.svelte     # Accept/edit/decline naming modal
│   │   ├── ChatInput.svelte
│   │   ├── Message.svelte
│   │   ├── TransitionPrompt.svelte # 3+ cards surfaced prompt
│   │   ├── ArrangementPlay.svelte  # Card arrangement mode
│   │   ├── ContextDeck.svelte      # Context selection grid
│   │   ├── AssemblySave.svelte     # Save assembly modal
│   │   ├── AssemblyList.svelte     # Browse saved assemblies
│   │   ├── AssemblyTimeline.svelte # Iteration history view
│   │   ├── IterationComparison.svelte # Side-by-side comparison
│   │   ├── CardLibrary.svelte      # All cards view
│   │   ├── WelcomeScreen.svelte    # Returning user landing
│   │   ├── HamburgerMenu.svelte    # Navigation drawer
│   │   └── MigrationPrompt.svelte  # Local to cloud migration
│   ├── stores/
│   │   ├── session.js              # State + persistence
│   │   └── navigation.js           # View state management
│   ├── supabase/
│   │   ├── client.js               # Supabase client
│   │   ├── auth.js                 # Auth helpers
│   │   ├── assemblies.js           # Assembly CRUD
│   │   ├── contexts.js             # Context management
│   │   ├── sessions.js             # Session persistence
│   │   ├── cards.js                # Card persistence
│   │   └── migrate.js              # localStorage migration
│   └── data/
│       └── contexts.js             # System context definitions
├── app.css                         # Tailwind + animations
└── app.html                        # HTML template (system font stack, no webfonts)

supabase/
└── migrations/
    └── 001_initial_schema.sql      # Database schema
```

## Tech Stack

- **SvelteKit 2** - Framework with Svelte 5 runes
- **Tailwind CSS** - Styling (custom moonlight-on-water palette)
- **Env-configured LLM lane** - OpenAI-compatible endpoint you run yourself; tool use for card detection
- **Supabase** - Optional auth and database persistence
- **Vercel** - Deployment (adapter configured)

## Supabase Setup (Optional)

For cloud persistence:

1. Create a Supabase project
2. Run the migration in `supabase/migrations/001_initial_schema.sql`
3. Copy the optional sync variables from `.env.example` into your `.env`
   and fill in the values for the project you provisioned (URL + public
   anon key - the anon key is safe to expose in the browser because the
   schema is protected by row-level security).

The app works fully offline with localStorage - Supabase just adds cross-device sync.

## Local Supabase Development

Scripts are provided in `scripts/` for managing local and production Supabase instances.

### Environment Switching

```bash
# Switch to local development
./scripts/switch-env.sh local

# Switch to production (with confirmation prompt)
./scripts/switch-env.sh production

# Check current environment
./scripts/switch-env.sh status
```

### Local Development

```bash
# Start local Supabase
./scripts/supabase-dev.sh start

# Open Supabase Studio in browser
./scripts/supabase-dev.sh studio

# Stop local Supabase
./scripts/supabase-dev.sh stop

# Reset database (applies all migrations fresh)
./scripts/supabase-dev.sh reset

# Create a new migration
./scripts/supabase-dev.sh migrate add_new_table

# Check for schema drift
./scripts/supabase-dev.sh diff
```

### Production Deployment

```bash
# First time: link to your production project
./scripts/push-to-production.sh link

# Compare local schema with production
./scripts/push-to-production.sh diff

# Push migrations to production
./scripts/push-to-production.sh migrations

# Pull schema changes from production
./scripts/push-to-production.sh pull
```

### Port Configuration

This project uses custom ports to avoid conflicts with other local Supabase projects:

| Service  | Port  |
| -------- | ----- |
| API      | 54331 |
| Database | 54332 |
| Studio   | 54333 |
| Inbucket | 54334 |

## Deployment

The build targets the adapter configured in `svelte.config.js` (Node serverless).
Push the repo to your git host, import it into a Node-capable deploy target, and
set the environment:

- `AOI_LLM_BASE_URL` + `AOI_LLM_MODEL` (required - any OpenAI-compatible endpoint, see `.env.example`)
- the optional sync variables from `.env.example` (only if you want cloud persistence)

With no environment configured the deployed app still boots and fails closed
(see Quick Start) - it never silently reaches for a default endpoint.

## Development

```bash
npm ci              # install from the lockfile
npm run dev         # dev server on http://localhost:5173
npm run ci          # the whole gate: lint + format:check + test + build
```

Tests are vitest suites under `src/` (no network, no real model):

- `src/lib/server/lane.test.js` - the env lane table + wire dispatch
- `src/routes/api/fail-closed.test.js` - 501/502 machine-readable shapes
- `src/routes/api/route-smoke.test.js` - happy path + missing-lane smoke
- `src/lib/__tests__/replay.test.js` - prompt-replay fixtures
  (`fixtures/card-formation/*.yaml`: canned OpenAI-compatible responses
  replayed against the real routes - the behavior lock for card formation)
- `src/routes/honest-first-run.test.js` - the zero-.env shell state renders
  server-side

CI (`.github/workflows/ci.yml`) runs the same chain plus the invariant greps
(no endpoint pins, no provider-SDK importers, no tracked secrets, no
`AOI_LLM_` strings in the client bundle) via `scripts/check-invariants.js` and
`scripts/check-secrets.js`.

## Design Philosophy

- **Moonlight on water** - Dark palette with silver accents
- **Cards rise from depths** - Visual metaphor for unconscious material surfacing
- **No rushing** - Contemplative pace, user controls timing
- **Emergence over extraction** - AI surfaces what's already there
- **User agency** - User confirms card names, controls when to arrange
- **Frozen time simulation** - Swap cards to see how narratives change
- **Local-first** - Works offline, cloud sync is optional

## AI System Design

The conversation API uses the configured lane model's tool-calling support with three tools:

- `detect_forming_card` - When AI notices a theme/tension/figure forming
- `deepen_card` - When something previously detected gains more substance
- `propose_card_naming` - When a card is ready to be named

This allows natural card formation without rigid prompting.
