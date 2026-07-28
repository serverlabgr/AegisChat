import { Hono } from "hono";
import { z } from "zod";
import {
  COLORS,
  getUserById,
  hashPassword,
  issueRefreshToken,
  mapUser,
  requireAuth,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
  type AuthVars,
} from "../auth.js";
import { query } from "../db.js";

const registerSchema = z.object({
  inviteCode: z.string().min(3).max(64),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(48).optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authRoutes = new Hono<AuthVars>();

authRoutes.post("/register", async (c) => {
  const body = registerSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }
  const { inviteCode, username, password, displayName } = body.data;
  const code = inviteCode.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^aegis\.gg\//, "");

  const client = await (await import("../db.js")).pool.connect();
  try {
    await client.query("BEGIN");
    const inv = await client.query<{
      id: string;
      max_uses: number;
      uses: number;
      expires_at: Date | null;
    }>(
      `SELECT id, max_uses, uses, expires_at FROM invites
       WHERE lower(code) = $1 FOR UPDATE`,
      [code],
    );
    const invite = inv.rows[0];
    if (!invite) {
      await client.query("ROLLBACK");
      return c.json({ error: "Invalid invite code" }, 400);
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return c.json({ error: "Invite expired" }, 400);
    }
    if (invite.uses >= invite.max_uses) {
      await client.query("ROLLBACK");
      return c.json({ error: "Invite exhausted" }, 400);
    }

    const exists = await client.query(
      `SELECT 1 FROM users WHERE lower(username) = lower($1)`,
      [username],
    );
    if (exists.rows.length) {
      await client.query("ROLLBACK");
      return c.json({ error: "Username taken" }, 409);
    }

    const passwordHash = await hashPassword(password);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const inserted = await client.query(
      `INSERT INTO users (username, password_hash, display_name, color, role, status)
       VALUES ($1, $2, $3, $4, 'Member', 'online')
       RETURNING id, username, display_name, bio, color, role, status, avatar_url`,
      [username, passwordHash, displayName?.trim() || username, color],
    );
    await client.query(
      `UPDATE invites SET uses = uses + 1 WHERE id = $1`,
      [invite.id],
    );
    await client.query("COMMIT");

    const user = mapUser(inserted.rows[0]);
    const accessToken = await signAccessToken({
      id: user.id,
      username: user.username,
    });
    const refreshToken = await issueRefreshToken(user.id);
    return c.json({ user, accessToken, refreshToken }, 201);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

authRoutes.post("/login", async (c) => {
  const body = loginSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const { rows } = await query(
    `SELECT id, username, password_hash, display_name, bio, color, role, status, avatar_url
     FROM users WHERE lower(username) = lower($1)`,
    [body.data.username],
  );
  const row = rows[0];
  if (!row || !(await verifyPassword(row.password_hash, body.data.password))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  await query(`UPDATE users SET status = 'online' WHERE id = $1`, [row.id]);
  const user = mapUser({ ...row, status: "online" });
  const accessToken = await signAccessToken({
    id: user.id,
    username: user.username,
  });
  const refreshToken = await issueRefreshToken(user.id);
  return c.json({ user, accessToken, refreshToken });
});

authRoutes.post("/refresh", async (c) => {
  const body = z
    .object({ refreshToken: z.string().min(10) })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const rotated = await rotateRefreshToken(body.data.refreshToken);
  if (!rotated) return c.json({ error: "Invalid refresh token" }, 401);

  const user = await getUserById(rotated.userId);
  if (!user) return c.json({ error: "User gone" }, 401);

  const accessToken = await signAccessToken({
    id: user.id,
    username: user.username,
  });
  return c.json({
    user,
    accessToken,
    refreshToken: rotated.newRefresh,
  });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = await getUserById(c.get("userId"));
  if (!user) return c.json({ error: "Not found" }, 404);
  return c.json({ user });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const parsed = z
    .object({ refreshToken: z.string().optional() })
    .safeParse(await c.req.json().catch(() => ({})));
  if (parsed.success && parsed.data.refreshToken) {
    const { hashToken } = await import("../auth.js");
    await query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE token_hash = $1 AND user_id = $2`,
      [hashToken(parsed.data.refreshToken), c.get("userId")],
    );
  }
  await query(`UPDATE users SET status = 'offline' WHERE id = $1`, [
    c.get("userId"),
  ]);
  return c.json({ ok: true });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

authRoutes.post("/password", requireAuth, async (c) => {
  const body = passwordSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const userId = c.get("userId");
  const { rows } = await query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return c.json({ error: "Not found" }, 404);
  if (!(await verifyPassword(row.password_hash, body.data.currentPassword))) {
    return c.json({ error: "Wrong current password" }, 401);
  }

  const passwordHash = await hashPassword(body.data.newPassword);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    passwordHash,
    userId,
  ]);
  // Revoke other refresh sessions
  await query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
  return c.json({ ok: true });
});
