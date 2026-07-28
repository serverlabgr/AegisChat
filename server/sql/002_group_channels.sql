-- Discord-like: channels belong to a group (server). NULL = home «η παρέα».
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS channels_group_idx ON channels(group_id);

-- Optional invite code per group for joining servers
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
