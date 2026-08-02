-- DM reactions + read cursors for receipts

CREATE TABLE IF NOT EXISTS dm_message_reactions (
  message_id UUID NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, emoji, user_id)
);

CREATE TABLE IF NOT EXISTS read_cursors (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL,
  last_message_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id)
);

CREATE INDEX IF NOT EXISTS read_cursors_target_idx ON read_cursors(target_id);
