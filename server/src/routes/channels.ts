import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { canManageChannels, canModerate } from "../channelAuth.js";
import { query } from "../db.js";
import { broadcast, sendToUser } from "../ws.js";

export const channelRoutes = new Hono<AuthVars>();
channelRoutes.use("*", requireAuth);

channelRoutes.get("/", async (c) => {
  const groupId = c.req.query("groupId");
  const { rows } = groupId
    ? await query(
        `SELECT id, name, type, topic, position, group_id AS "groupId"
         FROM channels WHERE group_id = $1
         ORDER BY position, name`,
        [groupId],
      )
    : await query(
        `SELECT id, name, type, topic, position, group_id AS "groupId"
         FROM channels
         ORDER BY position, name`,
      );
  return c.json({ channels: rows });
});

channelRoutes.get("/:id/messages", async (c) => {
  const channelId = c.req.param("id");
  const limit = Math.min(Number(c.req.query("limit") ?? 80), 200);
  // Newest N messages, returned oldest→newest for the UI.
  const { rows } = await query(
    `WITH recent AS (
       SELECT m.id, m.channel_id, m.author_id, m.content, m.reply_to_id, m.edited, m.created_at,
              COALESCE(
                json_agg(
                  json_build_object('emoji', r.emoji, 'userIds', (
                    SELECT json_agg(r2.user_id) FROM message_reactions r2
                    WHERE r2.message_id = m.id AND r2.emoji = r.emoji
                  ))
                ) FILTER (WHERE r.emoji IS NOT NULL),
                '[]'
              ) AS reactions
       FROM messages m
       LEFT JOIN message_reactions r ON r.message_id = m.id
       WHERE m.channel_id = $1
       GROUP BY m.id
       ORDER BY m.created_at DESC
       LIMIT $2
     )
     SELECT * FROM recent ORDER BY created_at ASC`,
    [channelId, limit],
  );

  const messages = rows.map((m) => ({
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
  }));
  return c.json({ messages });
});

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

async function loadChannelMessage(messageId: string) {
  const { rows } = await query(
    `SELECT m.id, m.channel_id, m.author_id, m.content, m.reply_to_id, m.edited, m.created_at,
            COALESCE(
              (
                SELECT json_agg(json_build_object('emoji', emoji, 'userIds', user_ids))
                FROM (
                  SELECT emoji, json_agg(user_id) AS user_ids
                  FROM message_reactions
                  WHERE message_id = m.id
                  GROUP BY emoji
                ) sub
              ),
              '[]'
            ) AS reactions
     FROM messages m
     WHERE m.id = $1`,
    [messageId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    channelId: row.channel_id as string,
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

channelRoutes.post("/:id/messages", async (c) => {
  const channelId = c.req.param("id");
  const body = z
    .object({
      content: z.string().trim().min(1).max(12000),
      replyToId: z.string().uuid().optional(),
      /** Plaintext mention targets (body is E2E ciphertext). */
      mentionUserIds: z.array(z.string().uuid()).max(32).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const ch = await query(`SELECT id FROM channels WHERE id = $1 AND type = 'text'`, [
    channelId,
  ]);
  if (!ch.rows[0]) return c.json({ error: "Channel not found" }, 404);

  const authorId = c.get("userId");
  const { rows } = await query(
    `INSERT INTO messages (channel_id, author_id, content, reply_to_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, channel_id, author_id, content, reply_to_id, edited, created_at`,
    [
      channelId,
      authorId,
      body.data.content,
      body.data.replyToId ?? null,
    ],
  );
  const row = rows[0];
  const mentionIds = [
    ...new Set((body.data.mentionUserIds ?? []).filter((id) => id !== authorId)),
  ];
  for (const uid of mentionIds) {
    await query(
      `INSERT INTO message_mentions (message_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [row.id, uid],
    );
  }
  const message = {
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    timestamp: new Date(row.created_at).getTime(),
    encrypted: true,
    edited: row.edited,
    replyToId: row.reply_to_id ?? undefined,
    reactions: [] as { emoji: string; userIds: string[] }[],
    mentionUserIds: mentionIds,
  };
  broadcast({ type: "message", channelId, message });
  for (const uid of mentionIds) {
    sendToUser(uid, {
      type: "mention",
      channelId,
      messageId: row.id as string,
      fromUserId: authorId,
    });
  }
  return c.json({ message }, 201);
});

channelRoutes.patch("/messages/:messageId", async (c) => {
  const messageId = c.req.param("messageId");
  const body = z
    .object({ content: z.string().trim().min(1).max(12000) })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const { rows } = await query(
    `UPDATE messages SET content = $1, edited = true
     WHERE id = $2 AND author_id = $3
     RETURNING id, channel_id, author_id, content, reply_to_id, edited, created_at`,
    [body.data.content, messageId, c.get("userId")],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  const loaded = await loadChannelMessage(messageId);
  if (!loaded) return c.json({ error: "Not found" }, 404);
  broadcast({
    type: "message_updated",
    channelId: loaded.channelId,
    message: loaded.message,
  });
  return c.json({ message: loaded.message });
});

channelRoutes.delete("/messages/:messageId", async (c) => {
  const messageId = c.req.param("messageId");
  const { rows } = await query(
    `DELETE FROM messages WHERE id = $1 AND author_id = $2
     RETURNING id, channel_id`,
    [messageId, c.get("userId")],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  broadcast({
    type: "message_deleted",
    channelId: rows[0].channel_id,
    messageId: rows[0].id,
  });
  return c.json({ ok: true, id: rows[0].id, channelId: rows[0].channel_id });
});

channelRoutes.post("/messages/:messageId/reactions", async (c) => {
  const messageId = c.req.param("messageId");
  const body = z
    .object({ emoji: z.string().min(1).max(64) })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  const userId = c.get("userId");

  const msg = await query(
    `SELECT id, channel_id FROM messages WHERE id = $1`,
    [messageId],
  );
  if (!msg.rows[0]) return c.json({ error: "Not found" }, 404);
  const channelId = msg.rows[0].channel_id as string;

  const existing = await query(
    `SELECT 1 FROM message_reactions WHERE message_id = $1 AND emoji = $2 AND user_id = $3`,
    [messageId, body.data.emoji, userId],
  );
  let added = true;
  if (existing.rows.length) {
    await query(
      `DELETE FROM message_reactions WHERE message_id = $1 AND emoji = $2 AND user_id = $3`,
      [messageId, body.data.emoji, userId],
    );
    added = false;
  } else {
    await query(
      `INSERT INTO message_reactions (message_id, emoji, user_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [messageId, body.data.emoji, userId],
    );
  }
  broadcast({
    type: "reaction",
    channelId,
    messageId,
    emoji: body.data.emoji,
    userId,
    added,
  });
  return c.json({ ok: true, added });
});

/** List pinned messages for a channel (ciphertext bodies). */
channelRoutes.get("/:id/pins", async (c) => {
  const channelId = c.req.param("id");
  const { rows } = await query(
    `SELECT m.id, m.channel_id, m.author_id, m.content, m.reply_to_id, m.edited, m.created_at,
            p.pinned_by, p.pinned_at
     FROM channel_pins p
     INNER JOIN messages m ON m.id = p.message_id
     WHERE p.channel_id = $1
     ORDER BY p.pinned_at DESC
     LIMIT 50`,
    [channelId],
  );
  return c.json({
    pins: rows.map((m) => ({
      id: m.id,
      authorId: m.author_id,
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
      encrypted: true,
      edited: m.edited,
      replyToId: m.reply_to_id ?? undefined,
      reactions: [] as { emoji: string; userIds: string[] }[],
      pinnedBy: m.pinned_by,
      pinnedAt: new Date(m.pinned_at).getTime(),
    })),
  });
});

channelRoutes.post("/:id/pins/:messageId", async (c) => {
  const channelId = c.req.param("id");
  const messageId = c.req.param("messageId");
  const userId = c.get("userId");

  const ch = await query(
    `SELECT id, group_id AS "groupId" FROM channels WHERE id = $1 AND type = 'text'`,
    [channelId],
  );
  if (!ch.rows[0]) return c.json({ error: "Channel not found" }, 404);
  const groupId = (ch.rows[0].groupId as string | null) ?? null;
  if (!(await canModerate(userId, groupId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const msg = await query(
    `SELECT id FROM messages WHERE id = $1 AND channel_id = $2`,
    [messageId, channelId],
  );
  if (!msg.rows[0]) return c.json({ error: "Message not found" }, 404);

  await query(
    `INSERT INTO channel_pins (channel_id, message_id, pinned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [channelId, messageId, userId],
  );
  broadcast({
    type: "pin",
    channelId,
    messageId,
    pinned: true,
    pinnedBy: userId,
  });
  return c.json({ ok: true, pinned: true });
});

channelRoutes.delete("/:id/pins/:messageId", async (c) => {
  const channelId = c.req.param("id");
  const messageId = c.req.param("messageId");
  const userId = c.get("userId");

  const ch = await query(
    `SELECT id, group_id AS "groupId" FROM channels WHERE id = $1`,
    [channelId],
  );
  if (!ch.rows[0]) return c.json({ error: "Channel not found" }, 404);
  const groupId = (ch.rows[0].groupId as string | null) ?? null;
  if (!(await canModerate(userId, groupId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await query(
    `DELETE FROM channel_pins WHERE channel_id = $1 AND message_id = $2`,
    [channelId, messageId],
  );
  broadcast({
    type: "pin",
    channelId,
    messageId,
    pinned: false,
    pinnedBy: userId,
  });
  return c.json({ ok: true, pinned: false });
});

channelRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (id === "messages") return c.json({ error: "Not found" }, 404);
  const body = z
    .object({
      name: z.string().trim().min(1).max(48).optional(),
      topic: z.string().max(280).optional(),
      position: z.number().int().min(0).max(10_000).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  if (
    body.data.name === undefined &&
    body.data.topic === undefined &&
    body.data.position === undefined
  ) {
    return c.json({ error: "Nothing to update" }, 400);
  }

  const cur = await query(
    `SELECT id, name, type, topic, position, group_id AS "groupId"
     FROM channels WHERE id = $1`,
    [id],
  );
  if (!cur.rows[0]) return c.json({ error: "Channel not found" }, 404);
  const groupId = (cur.rows[0].groupId as string | null) ?? null;
  if (!(await canManageChannels(c.get("userId"), groupId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const next = {
    name: body.data.name ?? (cur.rows[0].name as string),
    topic:
      body.data.topic !== undefined
        ? body.data.topic
        : (cur.rows[0].topic as string),
    position:
      body.data.position !== undefined
        ? body.data.position
        : (cur.rows[0].position as number),
  };
  const { rows } = await query(
    `UPDATE channels SET name = $1, topic = $2, position = $3
     WHERE id = $4
     RETURNING id, name, type, topic, position, group_id AS "groupId"`,
    [next.name, next.topic, next.position, id],
  );
  const channel = {
    id: rows[0].id,
    name: rows[0].name,
    type: rows[0].type,
    topic: rows[0].topic || undefined,
    position: rows[0].position,
    groupId: rows[0].groupId ?? null,
  };
  broadcast({ type: "channels_changed", groupId });
  return c.json({ channel });
});

channelRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (id === "messages") return c.json({ error: "Not found" }, 404);

  const cur = await query(
    `SELECT id, type, group_id AS "groupId" FROM channels WHERE id = $1`,
    [id],
  );
  if (!cur.rows[0]) return c.json({ error: "Channel not found" }, 404);
  const groupId = (cur.rows[0].groupId as string | null) ?? null;
  if (!(await canManageChannels(c.get("userId"), groupId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (cur.rows[0].type === "text") {
    const count = await query(
      `SELECT COUNT(*)::int AS n FROM channels
       WHERE type = 'text' AND (
         ($1::uuid IS NULL AND group_id IS NULL) OR group_id = $1
       )`,
      [groupId],
    );
    if ((count.rows[0]?.n as number) <= 1) {
      return c.json(
        { error: "Δεν μπορείς να διαγράψεις το τελευταίο text κανάλι" },
        400,
      );
    }
  }

  await query(`DELETE FROM channels WHERE id = $1`, [id]);
  broadcast({ type: "channels_changed", groupId });
  return c.json({ ok: true, id, groupId });
});
