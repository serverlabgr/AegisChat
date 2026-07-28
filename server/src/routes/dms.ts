import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";
import { sendToUser } from "../ws.js";

export const dmRoutes = new Hono<AuthVars>();
dmRoutes.use("*", requireAuth);

function threadIdFor(a: string, b: string): string {
  return a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`;
}

async function ensureThread(me: string, other: string): Promise<string> {
  const [userA, userB] = me < other ? [me, other] : [other, me];
  const id = threadIdFor(me, other);
  await query(
    `INSERT INTO dm_threads (id, user_a, user_b) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, userA, userB],
  );
  return id;
}

dmRoutes.get("/", async (c) => {
  const me = c.get("userId");
  const { rows } = await query(
    `SELECT t.id,
            CASE WHEN t.user_a = $1 THEN t.user_b ELSE t.user_a END AS peer_id
     FROM dm_threads t
     WHERE t.user_a = $1 OR t.user_b = $1
     ORDER BY t.created_at DESC`,
    [me],
  );
  return c.json({
    dms: rows.map((r) => ({ id: r.id, userId: r.peer_id })),
  });
});

dmRoutes.get("/:threadId/messages", async (c) => {
  const threadId = c.req.param("threadId");
  const me = c.get("userId");
  const ok = await query(
    `SELECT 1 FROM dm_threads WHERE id = $1 AND (user_a = $2 OR user_b = $2)`,
    [threadId, me],
  );
  if (!ok.rows[0]) return c.json({ error: "Not found" }, 404);

  const { rows } = await query(
    `SELECT id, author_id, content, reply_to_id, edited, created_at
     FROM dm_messages WHERE thread_id = $1
     ORDER BY created_at ASC LIMIT 200`,
    [threadId],
  );
  return c.json({
    messages: rows.map((m) => ({
      id: m.id,
      authorId: m.author_id,
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
      encrypted: true,
      edited: m.edited,
      replyToId: m.reply_to_id ?? undefined,
      reactions: [],
    })),
  });
});

dmRoutes.post("/with/:userId", async (c) => {
  const other = c.req.param("userId");
  const me = c.get("userId");
  if (other === me) return c.json({ error: "Invalid peer" }, 400);
  const peer = await query(`SELECT id FROM users WHERE id = $1`, [other]);
  if (!peer.rows[0]) return c.json({ error: "User not found" }, 404);
  const threadId = await ensureThread(me, other);
  return c.json({ threadId, userId: other });
});

dmRoutes.post("/:threadId/messages", async (c) => {
  const threadId = c.req.param("threadId");
  const me = c.get("userId");
  const body = z
    .object({
      content: z.string().trim().min(1).max(12000),
      replyToId: z.string().uuid().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const thread = await query(
    `SELECT user_a, user_b FROM dm_threads WHERE id = $1 AND (user_a = $2 OR user_b = $2)`,
    [threadId, me],
  );
  if (!thread.rows[0]) return c.json({ error: "Not found" }, 404);

  const { rows } = await query(
    `INSERT INTO dm_messages (thread_id, author_id, content, reply_to_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, author_id, content, reply_to_id, edited, created_at`,
    [threadId, me, body.data.content, body.data.replyToId ?? null],
  );
  const row = rows[0];
  const message = {
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    timestamp: new Date(row.created_at).getTime(),
    encrypted: true,
    edited: row.edited,
    replyToId: row.reply_to_id ?? undefined,
    reactions: [],
  };
  const peer =
    thread.rows[0].user_a === me
      ? thread.rows[0].user_b
      : thread.rows[0].user_a;
  sendToUser(peer, { type: "dm", threadId, message });
  sendToUser(me, { type: "dm", threadId, message });
  return c.json({ message }, 201);
});
