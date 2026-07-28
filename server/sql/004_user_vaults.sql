-- Zero-knowledge vault: server stores only password-wrapped copies of the
-- client-generated parea key. Server never receives the raw AES key.
CREATE TABLE IF NOT EXISTS user_vaults (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  wrapped_vault TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crypto_meta (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vault_initialized BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO crypto_meta (id, vault_initialized)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;
