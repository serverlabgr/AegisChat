import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";

export const cryptoRoutes = new Hono<{ Variables: AuthVars }>();

cryptoRoutes.use("*", requireAuth);

/**
 * Zero-knowledge model:
 * - Clients generate the AES-256 parea vault key locally.
 * - Server only stores password-wrapped blobs (cannot decrypt chat).
 * - Legacy GET /vault that handed out a server-derived key is removed.
 */

cryptoRoutes.get("/status", async (c) => {
  const me = c.get("userId");
  const meta = await query(
    `SELECT vault_initialized FROM crypto_meta WHERE id = 1`,
  );
  const mine = await query(
    `SELECT 1 FROM user_vaults WHERE user_id = $1`,
    [me],
  );
  const count = await query(`SELECT count(*)::int AS n FROM user_vaults`);
  return c.json({
    algorithm: "AES-256-GCM",
    mode: "zero-knowledge",
    vaultInitialized: Boolean(meta.rows[0]?.vault_initialized),
    membersWithVault: count.rows[0]?.n ?? 0,
    hasWrappedVault: Boolean(mine.rows[0]),
    note: "Server stores ciphertext only. Vault key never leaves clients in plaintext.",
  });
});

cryptoRoutes.get("/me", async (c) => {
  const me = c.get("userId");
  const { rows } = await query(
    `SELECT salt, wrapped_vault AS "wrappedVault", updated_at AS "updatedAt"
     FROM user_vaults WHERE user_id = $1`,
    [me],
  );
  if (!rows[0]) {
    return c.json({ wrappedVault: null, salt: null });
  }
  return c.json(rows[0]);
});

cryptoRoutes.put("/me", async (c) => {
  const me = c.get("userId");
  const body = z
    .object({
      salt: z.string().min(8).max(128),
      wrappedVault: z.string().min(16).max(4096),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  await query(
    `INSERT INTO user_vaults (user_id, salt, wrapped_vault, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE
       SET salt = EXCLUDED.salt,
           wrapped_vault = EXCLUDED.wrapped_vault,
           updated_at = now()`,
    [me, body.data.salt, body.data.wrappedVault],
  );
  await query(
    `UPDATE crypto_meta SET vault_initialized = true, updated_at = now() WHERE id = 1`,
  );
  return c.json({ ok: true });
});
