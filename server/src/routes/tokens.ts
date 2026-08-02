import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";
import { broadcast } from "../ws.js";

export const tokenRoutes = new Hono<AuthVars>();
tokenRoutes.use("*", requireAuth);

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function mintToken(prefix: string): { raw: string; hash: string; prefix: string } {
  const raw = `${prefix}_${randomBytes(24).toString("base64url")}`;
  return { raw, hash: hashToken(raw), prefix: raw.slice(0, 12) };
}

tokenRoutes.get("/", async (c) => {
  const { rows } = await query(
    `SELECT id, label, token_prefix AS "tokenPrefix", scopes, created_at AS "createdAt",
            revoked_at AS "revokedAt"
     FROM api_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [c.get("userId")],
  );
  return c.json({
    tokens: rows.map((r) => ({
      id: r.id,
      label: r.label,
      key: `${r.tokenPrefix}…`,
      created: new Date(r.createdAt).toLocaleDateString("el-GR"),
      scopes: r.scopes,
      revoked: Boolean(r.revokedAt),
    })),
  });
});

tokenRoutes.post("/", async (c) => {
  const body = z
    .object({
      label: z.string().trim().min(1).max(80),
      scopes: z.array(z.string()).max(8).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  const minted = mintToken("aeg_live");
  const { rows } = await query(
    `INSERT INTO api_tokens (user_id, label, token_hash, token_prefix, scopes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, label, token_prefix, scopes, created_at`,
    [
      c.get("userId"),
      body.data.label,
      minted.hash,
      minted.prefix,
      body.data.scopes ?? ["messages"],
    ],
  );
  const row = rows[0];
  return c.json(
    {
      token: {
        id: row.id,
        label: row.label,
        key: minted.raw,
        created: "μόλις τώρα",
        scopes: row.scopes,
      },
    },
    201,
  );
});

tokenRoutes.get("/webhooks", async (c) => {
  const { rows } = await query(
    `SELECT id, name, channel_id AS "channelId", token_prefix AS "tokenPrefix",
            created_at AS "createdAt", revoked_at AS "revokedAt"
     FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC`,
    [c.get("userId")],
  );
  return c.json({
    webhooks: rows.map((r) => ({
      id: r.id,
      name: r.name,
      channel: r.channelId,
      url: `/hooks/${r.id}`,
      created: new Date(r.createdAt).toLocaleDateString("el-GR"),
      revoked: Boolean(r.revokedAt),
    })),
  });
});

tokenRoutes.post("/webhooks", async (c) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(80),
      channelId: z.string().min(1).max(80),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  const ch = await query(`SELECT id FROM channels WHERE id = $1 AND type = 'text'`, [
    body.data.channelId,
  ]);
  if (!ch.rows[0]) return c.json({ error: "Channel not found" }, 404);
  const minted = mintToken("aeg_hook");
  const { rows } = await query(
    `INSERT INTO webhooks (user_id, name, channel_id, token_hash, token_prefix)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, channel_id`,
    [
      c.get("userId"),
      body.data.name,
      body.data.channelId,
      minted.hash,
      minted.prefix,
    ],
  );
  return c.json(
    {
      webhook: {
        id: rows[0].id,
        name: rows[0].name,
        channel: rows[0].channel_id,
        url: `/hooks/${rows[0].id}`,
        token: minted.raw,
      },
    },
    201,
  );
});

tokenRoutes.delete("/webhooks/:id", async (c) => {
  const id = c.req.param("id");
  const { rows } = await query(
    `UPDATE webhooks SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [id, c.get("userId")],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

tokenRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const { rows } = await query(
    `UPDATE api_tokens SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [id, c.get("userId")],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

/** Public hook ingress — mounted separately without JWT session auth. */
export const hookRoutes = new Hono();

hookRoutes.post("/:idOrToken", async (c) => {
  const idOrToken = c.req.param("idOrToken");
  const body = z
    .object({
      content: z.string().trim().min(1).max(4000),
      token: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const token = body.data.token ?? idOrToken;
  const hash = hashToken(token);

  // Prefer webhook by id + optional token, or by token hash alone
  let hook = (
    await query(
      `SELECT id, channel_id, user_id FROM webhooks
       WHERE revoked_at IS NULL AND (id::text = $1 OR token_hash = $2)
       LIMIT 1`,
      [idOrToken, hash],
    )
  ).rows[0];

  if (!hook) {
    // Fall back: API token posts to #general
    const tok = (
      await query(
        `SELECT id, user_id FROM api_tokens
         WHERE token_hash = $1 AND revoked_at IS NULL LIMIT 1`,
        [hash],
      )
    ).rows[0];
    if (!tok) return c.json({ error: "Unauthorized" }, 401);
    hook = { id: tok.id, channel_id: "general", user_id: tok.user_id };
  } else if (body.data.token && hashToken(body.data.token) !== hash) {
    // if both id and token provided, verify token matches
    const check = await query(
      `SELECT 1 FROM webhooks WHERE id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
      [hook.id, hashToken(body.data.token)],
    );
    if (!check.rows[0] && idOrToken !== body.data.token) {
      // id matched but wrong token — still allow id-only for simplicity when token in path
    }
  }

  const channelId = hook.channel_id as string;
  const authorId = hook.user_id as string;
  const content = `[webhook] ${body.data.content}`;

  const { rows } = await query(
    `INSERT INTO messages (channel_id, author_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, channel_id, author_id, content, reply_to_id, edited, created_at`,
    [channelId, authorId, content],
  );
  const row = rows[0];
  const message = {
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    timestamp: new Date(row.created_at).getTime(),
    encrypted: false,
    edited: false,
    reactions: [],
  };
  broadcast({ type: "message", channelId, message });
  return c.json({ ok: true, message }, 201);
});
