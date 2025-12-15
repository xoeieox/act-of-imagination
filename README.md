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

### Arrangement Play
- Once 3+ cards surface, enter arrangement mode
- Place cards in slots and select a context (meeting, conflict, discovery, transformation)
- AI generates evocative narrative of how the cards interact

### Session Persistence
- Sessions automatically save to localStorage
- Refresh the page and pick up where you left off
- "New session" button in header to start fresh (with confirmation)

## Project Structure

```
src/
├── routes/
│   ├── +layout.svelte          # App shell with session management
│   ├── +page.svelte            # Main page with phase switching
│   └── api/
│       ├── chat/+server.js     # Conversation + card detection (tool use)
│       └── arrange/+server.js  # Arrangement narrative generation
├── lib/
│   ├── components/
│   │   ├── Card.svelte             # Card with water overlay effect
│   │   ├── CardProposal.svelte     # Accept/edit/decline naming modal
│   │   ├── ChatInput.svelte
│   │   ├── Message.svelte
│   │   ├── TransitionPrompt.svelte # 3+ cards surfaced prompt
│   │   └── ArrangementPlay.svelte  # Card arrangement mode
│   └── stores/
│       └── session.js              # State + localStorage persistence
├── app.css                         # Tailwind + swimming/surfacing animations
└── app.html                        # HTML template with fonts
```

## Tech Stack

- **SvelteKit** - Framework
- **Tailwind CSS** - Styling (custom moonlight-on-water palette)
- **Claude API** - AI conversation with tool use for card detection
- **Vercel** - Deployment (adapter configured)

## Deployment to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add `ANTHROPIC_API_KEY` to environment variables
4. Deploy

Point your domain (e.g., zephyrium.io) to Vercel in DNS settings.

## Design Philosophy

- **Moonlight on water** - Dark palette with silver accents
- **Cards rise from depths** - Visual metaphor for unconscious material surfacing
- **No rushing** - Contemplative pace, user controls timing
- **Emergence over extraction** - AI surfaces what's already there
- **User agency** - User confirms card names, controls when to arrange

## AI System Design

The conversation API uses Claude's tool use feature with three tools:
- `detect_forming_card` - When AI notices a theme/tension/figure forming
- `deepen_card` - When something previously detected gains more substance
- `propose_card_naming` - When a card is ready to be named

This allows natural card formation without rigid prompting.

---

Part of the Zephyrium ecosystem.
