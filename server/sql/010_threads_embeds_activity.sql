-- Mod role helpers, message threads, link embeds, presence activity (0.11–0.12)

-- Soft-check: role text may be Admin | Mod | Member
-- No CHECK constraint change on users.role (already free TEXT)

CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  parent_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  title TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_message_id)
);

CREATE INDEX IF NOT EXISTS message_threads_channel_idx
  ON message_threads (channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS thread_messages_thread_idx
  ON thread_messages (thread_id, created_at ASC);

CREATE TABLE IF NOT EXISTS link_embeds (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS activity TEXT;
