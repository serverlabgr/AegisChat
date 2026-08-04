import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";
import { notifyThreadPeers } from "../ws.js";

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

function dedupeReactions(
  raw: { emoji: string; userIds: string[] | null }[],
): { emoji: string; userIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const r of raw) {
    if (!r?.emoji) continue;
    map.set(r.emoji, r.userIds ?? []);
  }
  return [...map.entries()].map(([emoji, userIds]) => ({ emoji, userIds }));
}

async function getThreadPeers(threadId: string, me: string) {
  const thread = await query(
    `SELECT user_a, user_b FROM dm_threads WHERE id = $1 AND (user_a = $2 OR user_b = $2)`,
    [threadId, me],
  );
  return thread.rows[0] as { user_a: string; user_b: string } | undefined;
}

async function loadDmMessage(messageId: string) {
  const { rows } = await query(
    `SELECT m.id, m.thread_id, m.author_id, m.content, m.reply_to_id, m.edited, m.created_at,
            COALESCE(
              (
                SELECT json_agg(json_build_object('emoji', emoji, 'userIds', user_ids))
                FROM (
                  SELECT emoji, json_agg(user_id) AS user_ids
                  FROM dm_message_reactions
                  WHERE message_id = m.id
                  GROUP BY emoji
                ) sub
              ),
              '[]'
            ) AS reactions
     FROM dm_messages m
     WHERE m.id = $1`,
    [messageId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    threadId: row.thread_id as string,
    message: {
      id: row.id,
      authorId: row.author_id,
      content: row.content,
      timestamp: new Date(row.created_at).getTime(),
      encrypted: true,
      edited: row.edited,
      replyToId: row.reply_to_id ?? undefined,
      reactions: Array.isArray(row.reactions)
        ? dedupeReactions(row.reactions)
        : [],
    },
  };
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

  const limit = Math.min(Number(c.req.query("limit") ?? 200), 200);
  const { rows } = await query(
    `WITH recent AS (
       SELECT m.id, m.author_id, m.content, m.reply_to_id, m.edited, m.created_at,
              COALESCE(
                json_agg(
                  json_build_object('emoji', r.emoji, 'userIds', (
                    SELECT json_agg(r2.user_id) FROM dm_message_reactions r2
                    WHERE r2.message_id = m.id AND r2.emoji = r.emoji
                  ))
                ) FILTER (WHERE r.emoji IS NOT NULL),
                '[]'
              ) AS reactions
       FROM dm_messages m
       LEFT JOIN dm_message_reactions r ON r.message_id = m.id
       WHERE m.thread_id = $1
       GROUP BY m.id
       ORDER BY m.created_at DESC
       LIMIT $2
     )
     SELECT * FROM recent ORDER BY created_at ASC`,
    [threadId, limit],
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
      reactions: Array.isArray(m.reactions)
        ? dedupeReactions(m.reactions)
        : [],
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

  const thread = await getThreadPeers(threadId, me);
  if (!thread) return c.json({ error: "Not found" }, 404);

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
    reactions: [] as { emoji: string; userIds: string[] }[],
  };
  notifyThreadPeers(thread.user_a, thread.user_b, {
    type: "dm",
    threadId,
    message,
  });
  return c.json({ message }, 201);
});

dmRoutes.patch("/messages/:messageId", async (c) => {
  const messageId = c.req.param("messageId");
  const me = c.get("userId");
  const body = z
    .object({ content: z.string().trim().min(1).max(12000) })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const { rows } = await query(
    `UPDATE dm_messages SET content = $1, edited = true
     WHERE id = $2 AND author_id = $3
     RETURNING id, thread_id`,
    [body.data.content, messageId, me],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  const threadId = rows[0].thread_id as string;
  const peers = await getThreadPeers(threadId, me);
  if (!peers) return c.json({ error: "Not found" }, 404);
  const loaded = await loadDmMessage(messageId);
  if (!loaded) return c.json({ error: "Not found" }, 404);
  notifyThreadPeers(peers.user_a, peers.user_b, {
    type: "dm_updated",
    threadId,
    message: loaded.message,
  });
  return c.json({ message: loaded.message });
});

dmRoutes.delete("/messages/:messageId", async (c) => {
  const messageId = c.req.param("messageId");
  const me = c.get("userId");
  const { rows } = await query(
    `DELETE FROM dm_messages WHERE id = $1 AND author_id = $2
     RETURNING id, thread_id`,
    [messageId, me],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  const threadId = rows[0].thread_id as string;
  const peers = await getThreadPeers(threadId, me);
  if (peers) {
    notifyThreadPeers(peers.user_a, peers.user_b, {
      type: "dm_deleted",
      threadId,
      messageId: rows[0].id,
    });
  }
  return c.json({ ok: true, id: rows[0].id, threadId });
});

dmRoutes.post("/messages/:messageId/reactions", async (c) => {
  const messageId = c.req.param("messageId");
  const me = c.get("userId");
  const body = z.object({ emoji: z.string().min(1).max(16) }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const msg = await query(
    `SELECT id, thread_id FROM dm_messages WHERE id = $1`,
    [messageId],
  );
  if (!msg.rows[0]) return c.json({ error: "Not found" }, 404);
  const threadId = msg.rows[0].thread_id as string;
  const peers = await getThreadPeers(threadId, me);
  if (!peers) return c.json({ error: "Not found" }, 404);

  const existing = await query(
    `SELECT 1 FROM dm_message_reactions WHERE message_id = $1 AND emoji = $2 AND user_id = $3`,
    [messageId, body.data.emoji, me],
  );
  let added = true;
  if (existing.rows.length) {
    await query(
      `DELETE FROM dm_message_reactions WHERE message_id = $1 AND emoji = $2 AND user_id = $3`,
      [messageId, body.data.emoji, me],
    );
    added = false;
  } else {
    await query(
      `INSERT INTO dm_message_reactions (message_id, emoji, user_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [messageId, body.data.emoji, me],
    );
  }
  notifyThreadPeers(peers.user_a, peers.user_b, {
    type: "dm_reaction",
    threadId,
    messageId,
    emoji: body.data.emoji,
    userId: me,
    added,
  });
  return c.json({ ok: true, added });
});
