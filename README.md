# Act of Imagination

A web application for personal exploration through AI-assisted conversation. Cards rise from the unconscious like shapes through murky water.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your Anthropic API key
   # Optionally add Supabase credentials for cloud persistence
   ```

   Required:
   - `ANTHROPIC_API_KEY` - Your Anthropic API key

   Optional (for cloud persistence):
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

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

Users can also create custom context cards through guided conversation.

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
└── app.html                        # HTML template with fonts

supabase/
└── migrations/
    └── 001_initial_schema.sql      # Database schema
```

## Tech Stack

- **SvelteKit 5** - Framework with Svelte 5 runes
- **Tailwind CSS** - Styling (custom moonlight-on-water palette)
- **Claude API** - AI conversation with tool use for card detection
- **Supabase** - Optional auth and database persistence
- **Vercel** - Deployment (adapter configured)

## Supabase Setup (Optional)

For cloud persistence:

1. Create a Supabase project
2. Run the migration in `supabase/migrations/001_initial_schema.sql`
3. Add credentials to `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

The app works fully offline with localStorage - Supabase just adds cross-device sync.

## Deployment to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables:
   - `ANTHROPIC_API_KEY` (required)
   - `VITE_SUPABASE_URL` (optional)
   - `VITE_SUPABASE_ANON_KEY` (optional)
4. Deploy

## Design Philosophy

- **Moonlight on water** - Dark palette with silver accents
- **Cards rise from depths** - Visual metaphor for unconscious material surfacing
- **No rushing** - Contemplative pace, user controls timing
- **Emergence over extraction** - AI surfaces what's already there
- **User agency** - User confirms card names, controls when to arrange
- **Frozen time simulation** - Swap cards to see how narratives change
- **Local-first** - Works offline, cloud sync is optional

## AI System Design

The conversation API uses Claude's tool use feature with three tools:
- `detect_forming_card` - When AI notices a theme/tension/figure forming
- `deepen_card` - When something previously detected gains more substance
- `propose_card_naming` - When a card is ready to be named

This allows natural card formation without rigid prompting.

---

Part of the Zephyrium ecosystem.
