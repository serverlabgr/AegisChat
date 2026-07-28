import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import type { Context, Next } from "hono";
import { config } from "./config.js";
import { query } from "./db.js";

const secret = new TextEncoder().encode(config.jwtSecret);

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  color: string;
  role: string;
  status: string;
  avatarUrl: string | null;
};

export type JwtPayload = {
  sub: string;
  username: string;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function signAccessToken(user: {
  id: string;
  username: string;
}): Promise<string> {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTtlSec}s`)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      username: String(payload.username ?? ""),
    };
  } catch {
    return null;
  }
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(48).toString("base64url");
  const expires = new Date();
  expires.setDate(expires.getDate() + config.refreshTtlDays);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashToken(token), expires.toISOString()],
  );
  return token;
}

export async function rotateRefreshToken(
  refreshToken: string,
): Promise<{ userId: string; newRefresh: string } | null> {
  const hash = hashToken(refreshToken);
  const { rows } = await query<{
    id: string;
    user_id: string;
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT id, user_id, expires_at, revoked_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [hash],
  );
  const row = rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    return null;
  }
  await query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`,
    [row.id],
  );
  const newRefresh = await issueRefreshToken(row.user_id);
  return { userId: row.user_id, newRefresh };
}

export function mapUser(row: {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  color: string;
  role: string;
  status: string;
  avatar_url: string | null;
}): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    color: row.color,
    role: row.role,
    status: row.status,
    avatarUrl: row.avatar_url,
  };
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const { rows } = await query(
    `SELECT id, username, display_name, bio, color, role, status, avatar_url
     FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export type AuthVars = { Variables: { userId: string; username: string } };

export async function requireAuth(c: Context<AuthVars>, next: Next) {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const payload = await verifyAccessToken(token);
  if (!payload) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", payload.sub);
  c.set("username", payload.username);
  await next();
}

export function randomInviteCode(): string {
  return `aegis-${randomBytes(4).toString("hex")}`;
}

export const COLORS = [
  "#7aa2f7",
  "#bb9af7",
  "#e0af68",
  "#f7768e",
  "#9ece6a",
  "#5cc8ff",
  "#f472d0",
  "#6ec4ae",
];
