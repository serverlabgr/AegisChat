-- Bots registry (Dev Portal) + Pterodactyl fields on game sessions

CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🤖',
  token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL,
  channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bots_user_idx ON bots(user_id);

ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS pterodactyl_identifier TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS join_address TEXT NOT NULL DEFAULT '';
