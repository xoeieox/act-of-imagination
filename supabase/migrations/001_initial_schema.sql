-- Act of Imagination: Initial Schema
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- SESSIONS (conversation containers)
-- ============================================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at DESC);

-- ============================================================================
-- MESSAGES (conversation messages)
-- ============================================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session_id ON messages(session_id);

-- ============================================================================
-- CARDS (personal cards from conversation)
-- ============================================================================
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  name TEXT,
  essence TEXT,
  hint TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('theme', 'figure', 'place', 'tension', 'object', 'context')),
  formation_state TEXT NOT NULL CHECK (formation_state IN ('submerged', 'rising', 'surfaced')),
  depth DECIMAL(3,2) DEFAULT 0.5 CHECK (depth >= 0 AND depth <= 1),
  source_excerpts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  surfaced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cards_user_id ON cards(user_id);
CREATE INDEX idx_cards_session_id ON cards(session_id);
CREATE INDEX idx_cards_formation_state ON cards(formation_state);
CREATE INDEX idx_cards_type ON cards(type);

-- ============================================================================
-- CONTEXTS (situational lenses - system + user-created)
-- ============================================================================
CREATE TABLE contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- null = system context
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  prompt TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contexts_user_id ON contexts(user_id);
CREATE INDEX idx_contexts_is_system ON contexts(is_system);

-- Seed system contexts
INSERT INTO contexts (name, label, description, prompt, is_system) VALUES
  ('crisis', 'Crisis', 'A moment of urgency and decision',
   'These elements are caught in a moment of crisis. What breaks, what holds, what is revealed under pressure?', true),
  ('solitude', 'Solitude', 'Alone with what matters',
   'These elements meet in solitude, away from others. What emerges when there is no audience, no performance required?', true),
  ('community', 'Community', 'Among others, seeking belonging',
   'These elements exist within a community. How do they relate to belonging, to being seen, to finding their place among others?', true),
  ('transition', 'Transition', 'Between what was and what will be',
   'These elements are in transition. What is being left behind? What is approaching? What persists through the change?', true),
  ('creation', 'Creation', 'Making something new',
   'These elements participate in an act of creation. What wants to be born? What must be given? What emerges from their collaboration?', true),
  ('loss', 'Loss', 'Facing absence and grief',
   'These elements are touched by loss. What has been taken away? What remains? How do they hold the absence?', true),
  ('waiting', 'Waiting', 'Suspended in anticipation',
   'These elements are waiting. For what? What happens in the stillness? What stirs beneath patience?', true),
  ('conflict', 'Conflict', 'Forces in opposition',
   'These elements are in conflict with each other. What is the nature of their opposition? What would resolution require?', true);

-- ============================================================================
-- ASSEMBLIES (saved arrangements)
-- ============================================================================
CREATE TABLE assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  synopsis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assemblies_user_id ON assemblies(user_id);
CREATE INDEX idx_assemblies_updated_at ON assemblies(updated_at DESC);

-- ============================================================================
-- ASSEMBLY_CARDS (junction table with position)
-- ============================================================================
CREATE TABLE assembly_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE(assembly_id, card_id),
  UNIQUE(assembly_id, position)
);

CREATE INDEX idx_assembly_cards_assembly_id ON assembly_cards(assembly_id);
CREATE INDEX idx_assembly_cards_card_id ON assembly_cards(card_id);

-- ============================================================================
-- ASSEMBLY_ITERATIONS (timeline entries)
-- ============================================================================
CREATE TABLE assembly_iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  context_id UUID REFERENCES contexts(id) ON DELETE SET NULL,
  narrative TEXT NOT NULL,
  card_snapshot JSONB NOT NULL, -- frozen state: [{id, name, essence, position}]
  context_snapshot JSONB NOT NULL, -- frozen state: {name, label, prompt}
  is_starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assembly_id, iteration_number)
);

CREATE INDEX idx_assembly_iterations_assembly_id ON assembly_iterations(assembly_id);
CREATE INDEX idx_assembly_iterations_is_starred ON assembly_iterations(is_starred);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assemblies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_iterations ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- SESSIONS
CREATE POLICY "Users can CRUD own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id);

-- MESSAGES
CREATE POLICY "Users can CRUD messages in own sessions"
  ON messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = messages.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- CARDS
CREATE POLICY "Users can CRUD own cards"
  ON cards FOR ALL
  USING (auth.uid() = user_id);

-- CONTEXTS
CREATE POLICY "Users can view system contexts"
  ON contexts FOR SELECT
  USING (is_system = true);

CREATE POLICY "Users can view own contexts"
  ON contexts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own contexts"
  ON contexts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own contexts"
  ON contexts FOR UPDATE
  USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own contexts"
  ON contexts FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- ASSEMBLIES
CREATE POLICY "Users can CRUD own assemblies"
  ON assemblies FOR ALL
  USING (auth.uid() = user_id);

-- ASSEMBLY_CARDS
CREATE POLICY "Users can CRUD assembly_cards in own assemblies"
  ON assembly_cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM assemblies
      WHERE assemblies.id = assembly_cards.assembly_id
      AND assemblies.user_id = auth.uid()
    )
  );

-- ASSEMBLY_ITERATIONS
CREATE POLICY "Users can CRUD iterations in own assemblies"
  ON assembly_iterations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM assemblies
      WHERE assemblies.id = assembly_iterations.assembly_id
      AND assemblies.user_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contexts_updated_at
  BEFORE UPDATE ON contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER assemblies_updated_at
  BEFORE UPDATE ON assemblies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
