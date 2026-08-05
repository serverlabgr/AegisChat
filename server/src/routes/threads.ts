import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";
import { broadcast } from "../ws.js";

export const threadRoutes = new Hono<AuthVars>();
threadRoutes.use("*", requireAuth);

threadRoutes.get("/by-message/:messageId", async (c) => {
  const messageId = c.req.param("messageId");
  const { rows } = await query(
    `SELECT id, channel_id, parent_message_id, title, created_by, created_at
     FROM message_threads WHERE parent_message_id = $1`,
    [messageId],
  );
  if (!rows[0]) return c.json({ thread: null });
  return c.json({
    thread: {
      id: rows[0].id,
      channelId: rows[0].channel_id,
      parentMessageId: rows[0].parent_message_id,
      title: rows[0].title,
      createdBy: rows[0].created_by,
      createdAt: new Date(rows[0].created_at).getTime(),
    },
  });
});

threadRoutes.post("/", async (c) => {
  const body = z
    .object({
      channelId: z.string().min(1),
      parentMessageId: z.string().uuid(),
      title: z.string().max(120).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const msg = await query(
    `SELECT id, channel_id FROM messages WHERE id = $1 AND channel_id = $2`,
    [body.data.parentMessageId, body.data.channelId],
  );
  if (!msg.rows[0]) return c.json({ error: "Message not found" }, 404);

  const { rows } = await query(
    `INSERT INTO message_threads (channel_id, parent_message_id, title, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (parent_message_id) DO UPDATE SET title = COALESCE(EXCLUDED.title, message_threads.title)
     RETURNING id, channel_id, parent_message_id, title, created_by, created_at`,
    [
      body.data.channelId,
      body.data.parentMessageId,
      body.data.title ?? null,
      c.get("userId"),
    ],
  );
  const thread = {
    id: rows[0].id,
    channelId: rows[0].channel_id,
    parentMessageId: rows[0].parent_message_id,
    title: rows[0].title,
    createdBy: rows[0].created_by,
    createdAt: new Date(rows[0].created_at).getTime(),
  };
  broadcast({
    type: "thread_created",
    channelId: thread.channelId as string,
    thread,
  });
  return c.json({ thread }, 201);
});

threadRoutes.get("/:id/messages", async (c) => {
  const id = c.req.param("id");
  const { rows } = await query(
    `SELECT id, thread_id, author_id, content, edited, created_at
     FROM thread_messages WHERE thread_id = $1
     ORDER BY created_at ASC LIMIT 200`,
    [id],
  );
  return c.json({
    messages: rows.map((m) => ({
      id: m.id,
      authorId: m.author_id,
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
      encrypted: true,
      edited: m.edited,
      reactions: [],
    })),
  });
});

threadRoutes.post("/:id/messages", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({ content: z.string().trim().min(1).max(12000) })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const th = await query(
    `SELECT id, channel_id FROM message_threads WHERE id = $1`,
    [id],
  );
  if (!th.rows[0]) return c.json({ error: "Thread not found" }, 404);

  const { rows } = await query(
    `INSERT INTO thread_messages (thread_id, author_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, thread_id, author_id, content, edited, created_at`,
    [id, c.get("userId"), body.data.content],
  );
  const message = {
    id: rows[0].id,
    authorId: rows[0].author_id,
    content: rows[0].content,
    timestamp: new Date(rows[0].created_at).getTime(),
    encrypted: true,
    edited: rows[0].edited,
    reactions: [],
  };
  broadcast({
    type: "thread_message",
    channelId: th.rows[0].channel_id as string,
    threadId: id,
    message,
  });
  return c.json({ message }, 201);
});
