import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";
import {
  ollamaChat,
  ollamaConfigured,
  ollamaDefaultModel,
  ollamaListModels,
  ollamaPing,
  type OllamaChatMessage,
} from "../lib/ollama.js";

export const aiRoutes = new Hono<AuthVars>();
aiRoutes.use("*", requireAuth);

aiRoutes.get("/status", async (c) => {
  const configured = ollamaConfigured();
  const reachable = configured ? await ollamaPing() : false;
  return c.json({
    configured,
    reachable,
    defaultModel: ollamaDefaultModel(),
  });
});

aiRoutes.get("/models", async (c) => {
  if (!ollamaConfigured()) {
    return c.json({ models: [], error: "Ollama δεν είναι ρυθμισμένο" });
  }
  const res = await ollamaListModels();
  if (!res.ok) return c.json({ models: [], error: res.error }, 502);
  return c.json({ models: res.models });
});

aiRoutes.get("/threads", async (c) => {
  const { rows } = await query(
    `SELECT id, title, model, created_at, updated_at
     FROM ai_threads WHERE user_id = $1
     ORDER BY updated_at DESC LIMIT 100`,
    [c.get("userId")],
  );
  return c.json({
    threads: rows.map((r) => ({
      id: r.id,
      title: r.title,
      model: r.model || ollamaDefaultModel(),
      createdAt: new Date(String(r.created_at)).getTime(),
      updatedAt: new Date(String(r.updated_at)).getTime(),
    })),
  });
});

aiRoutes.post("/threads", async (c) => {
  const body = z
    .object({
      title: z.string().trim().min(1).max(120).optional(),
      model: z.string().trim().max(128).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const { rows } = await query(
    `INSERT INTO ai_threads (user_id, title, model)
     VALUES ($1, $2, $3)
     RETURNING id, title, model, created_at, updated_at`,
    [
      c.get("userId"),
      body.data.title ?? "Νέα συνομιλία",
      body.data.model ?? ollamaDefaultModel(),
    ],
  );
  const r = rows[0];
  return c.json(
    {
      thread: {
        id: r.id,
        title: r.title,
        model: r.model || ollamaDefaultModel(),
        createdAt: new Date(String(r.created_at)).getTime(),
        updatedAt: new Date(String(r.updated_at)).getTime(),
      },
    },
    201,
  );
});

aiRoutes.get("/threads/:id/messages", async (c) => {
  const id = c.req.param("id");
  const own = await query(
    `SELECT id FROM ai_threads WHERE id = $1 AND user_id = $2`,
    [id, c.get("userId")],
  );
  if (!own.rows[0]) return c.json({ error: "Not found" }, 404);

  const { rows } = await query(
    `SELECT id, role, content, created_at
     FROM ai_messages WHERE thread_id = $1
     ORDER BY created_at ASC LIMIT 500`,
    [id],
  );
  return c.json({
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: new Date(String(m.created_at)).getTime(),
    })),
  });
});

aiRoutes.delete("/threads/:id", async (c) => {
  const id = c.req.param("id");
  const { rows } = await query(
    `DELETE FROM ai_threads WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, c.get("userId")],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

aiRoutes.post("/chat", async (c) => {
  if (!ollamaConfigured()) {
    return c.json({ error: "Ollama δεν είναι ρυθμισμένο στο server" }, 503);
  }

  const body = z
    .object({
      threadId: z.string().uuid().optional(),
      content: z.string().trim().min(1).max(16_000),
      model: z.string().trim().max(128).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const me = c.get("userId");
  let threadId = body.data.threadId;
  let model = body.data.model ?? ollamaDefaultModel();

  if (threadId) {
    const own = await query(
      `SELECT id, model FROM ai_threads WHERE id = $1 AND user_id = $2`,
      [threadId, me],
    );
    if (!own.rows[0]) return c.json({ error: "Thread not found" }, 404);
    if (!body.data.model && own.rows[0].model) {
      model = String(own.rows[0].model) || model;
    }
  } else {
    const title =
      body.data.content.length > 48
        ? `${body.data.content.slice(0, 45)}…`
        : body.data.content;
    const created = await query(
      `INSERT INTO ai_threads (user_id, title, model)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [me, title, model],
    );
    threadId = String(created.rows[0].id);
  }

  const userMsg = await query(
    `INSERT INTO ai_messages (thread_id, role, content)
     VALUES ($1, 'user', $2)
     RETURNING id, role, content, created_at`,
    [threadId, body.data.content],
  );

  const history = await query(
    `SELECT role, content FROM ai_messages
     WHERE thread_id = $1 AND role IN ('user', 'assistant', 'system')
     ORDER BY created_at ASC LIMIT 80`,
    [threadId],
  );
  const messages: OllamaChatMessage[] = history.rows.map((r) => ({
    role: r.role as OllamaChatMessage["role"],
    content: String(r.content),
  }));

  const result = await ollamaChat(messages, model);
  if (!result.ok) {
    return c.json({ error: result.error, threadId }, 502);
  }

  const assistantMsg = await query(
    `INSERT INTO ai_messages (thread_id, role, content)
     VALUES ($1, 'assistant', $2)
     RETURNING id, role, content, created_at`,
    [threadId, result.content],
  );

  await query(
    `UPDATE ai_threads SET updated_at = now(), model = $1 WHERE id = $2`,
    [result.model, threadId],
  );

  // Auto-title on first exchange
  const count = await query(
    `SELECT COUNT(*)::int AS n FROM ai_messages WHERE thread_id = $1`,
    [threadId],
  );
  if ((count.rows[0]?.n as number) <= 2) {
    const title =
      body.data.content.length > 48
        ? `${body.data.content.slice(0, 45)}…`
        : body.data.content;
    await query(`UPDATE ai_threads SET title = $1 WHERE id = $2`, [
      title,
      threadId,
    ]);
  }

  const mapMsg = (row: Record<string, unknown>) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: new Date(String(row.created_at)).getTime(),
  });

  return c.json({
    threadId,
    model: result.model,
    userMessage: mapMsg(userMsg.rows[0]),
    assistantMessage: mapMsg(assistantMsg.rows[0]),
  });
});
