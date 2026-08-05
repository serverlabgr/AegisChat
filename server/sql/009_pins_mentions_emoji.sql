-- Pins, mentions metadata, custom emoji (Discord-core 0.10)

CREATE TABLE IF NOT EXISTS channel_pins (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, message_id)
);

CREATE INDEX IF NOT EXISTS channel_pins_channel_idx
  ON channel_pins (channel_id, pinned_at DESC);

-- Plaintext mention targets (message body stays E2E ciphertext)
CREATE TABLE IF NOT EXISTS message_mentions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_mentions_user_idx
  ON message_mentions (user_id, message_id);

-- Custom emoji: unencrypted small images under uploadDir/emoji/
CREATE TABLE IF NOT EXISTS custom_emojis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'image/png',
  file_path TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT custom_emojis_name_format CHECK (name ~ '^[a-z0-9_]{2,32}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS custom_emojis_home_name_uidx
  ON custom_emojis (name) WHERE group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS custom_emojis_group_name_uidx
  ON custom_emojis (group_id, name) WHERE group_id IS NOT NULL;

-- Allow longer reaction keys for :shortcode: custom emoji
ALTER TABLE message_reactions
  ALTER COLUMN emoji TYPE TEXT;
