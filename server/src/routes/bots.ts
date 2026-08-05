import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";

export const botRoutes = new Hono<AuthVars>();
botRoutes.use("*", requireAuth);

function mapBot(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    desc: row.description ?? "",
    icon: row.icon ?? "🤖",
    online: Boolean(row.enabled),
    tokenId: row.token_id ?? undefined,
    channelId: row.channel_id ?? undefined,
    created: new Date(String(row.created_at)).toLocaleDateString("el-GR"),
  };
}

botRoutes.get("/", async (c) => {
  const { rows } = await query(
    `SELECT id, name, description, icon, token_id, channel_id, enabled, created_at
     FROM bots WHERE user_id = $1 ORDER BY created_at DESC`,
    [c.get("userId")],
  );
  return c.json({ bots: rows.map(mapBot) });
});

botRoutes.post("/", async (c) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(64),
      description: z.string().max(280).optional(),
      icon: z.string().max(8).optional(),
      tokenId: z.string().uuid().optional(),
      channelId: z.string().min(1).max(80).optional(),
      enabled: z.boolean().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  if (body.data.tokenId) {
    const tok = await query(
      `SELECT id FROM api_tokens WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [body.data.tokenId, c.get("userId")],
    );
    if (!tok.rows[0]) return c.json({ error: "API token not found" }, 404);
  }
  if (body.data.channelId) {
    const ch = await query(`SELECT id FROM channels WHERE id = $1`, [
      body.data.channelId,
    ]);
    if (!ch.rows[0]) return c.json({ error: "Channel not found" }, 404);
  }

  const { rows } = await query(
    `INSERT INTO bots (user_id, name, description, icon, token_id, channel_id, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      c.get("userId"),
      body.data.name,
      body.data.description ?? "",
      body.data.icon ?? "🤖",
      body.data.tokenId ?? null,
      body.data.channelId ?? null,
      body.data.enabled ?? true,
    ],
  );
  return c.json({ bot: mapBot(rows[0]) }, 201);
});

botRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      name: z.string().trim().min(1).max(64).optional(),
      description: z.string().max(280).optional(),
      icon: z.string().max(8).optional(),
      tokenId: z.string().uuid().nullable().optional(),
      channelId: z.string().min(1).max(80).nullable().optional(),
      enabled: z.boolean().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const cur = await query(`SELECT * FROM bots WHERE id = $1 AND user_id = $2`, [
    id,
    c.get("userId"),
  ]);
  if (!cur.rows[0]) return c.json({ error: "Not found" }, 404);
  const row = cur.rows[0];

  const next = {
    name: body.data.name ?? row.name,
    description: body.data.description ?? row.description,
    icon: body.data.icon ?? row.icon,
    token_id:
      body.data.tokenId !== undefined ? body.data.tokenId : row.token_id,
    channel_id:
      body.data.channelId !== undefined ? body.data.channelId : row.channel_id,
    enabled: body.data.enabled ?? row.enabled,
  };

  const { rows } = await query(
    `UPDATE bots SET name = $1, description = $2, icon = $3, token_id = $4,
       channel_id = $5, enabled = $6, updated_at = now()
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [
      next.name,
      next.description,
      next.icon,
      next.token_id,
      next.channel_id,
      next.enabled,
      id,
      c.get("userId"),
    ],
  );
  return c.json({ bot: mapBot(rows[0]) });
});

/** Lite slash runtime: `/botname args` → channel reply from that bot. */
botRoutes.post("/invoke", async (c) => {
  const body = z
    .object({
      channelId: z.string().min(1),
      text: z.string().trim().min(1).max(500),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const m = /^\/([a-zA-Z0-9_-]{1,64})\s*(.*)$/.exec(body.data.text);
  if (!m) return c.json({ handled: false });

  const botName = m[1];
  const args = m[2].trim();
  const { rows: bots } = await query(
    `SELECT id, name, description, icon, user_id, enabled
     FROM bots WHERE lower(name) = lower($1) AND enabled = true
     LIMIT 1`,
    [botName],
  );
  if (!bots[0]) return c.json({ handled: false });

  const reply =
    args.length === 0
      ? `${bots[0].icon ?? "🤖"} **${bots[0].name}** — ${bots[0].description || "online"}`
      : `${bots[0].icon ?? "🤖"} ${bots[0].name}: έλαβα \`${args}\``;

  const { rows } = await query(
    `INSERT INTO messages (channel_id, author_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, channel_id, author_id, content, reply_to_id, edited, created_at`,
    [body.data.channelId, bots[0].user_id, reply],
  );
  const message = {
    id: rows[0].id,
    authorId: rows[0].author_id,
    content: rows[0].content,
    timestamp: new Date(rows[0].created_at).getTime(),
    encrypted: false,
    edited: false,
    reactions: [] as { emoji: string; userIds: string[] }[],
    system: true,
  };
  const { broadcast } = await import("../ws.js");
  broadcast({
    type: "message",
    channelId: body.data.channelId,
    message,
  });
  return c.json({ handled: true, message });
});

botRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const { rows } = await query(
    `DELETE FROM bots WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, c.get("userId")],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});
