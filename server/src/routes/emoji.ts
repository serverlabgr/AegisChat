import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { canManageChannels, resolveGroupId } from "../channelAuth.js";
import { config } from "../config.js";
import { query } from "../db.js";

export const emojiRoutes = new Hono<AuthVars>();

const MAX_EMOJI_BYTES = 256 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpeg",
]);

function mapEmoji(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    groupId: (row.group_id as string | null) ?? null,
    name: row.name as string,
    mime: row.mime as string,
    url: `/emoji/${row.id as string}/image`,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at
      ? new Date(row.created_at as string).getTime()
      : Date.now(),
  };
}

/** List custom emoji for home (groupId omitted/null) or a group. */
emojiRoutes.get("/", requireAuth, async (c) => {
  const groupId = resolveGroupId(c.req.query("groupId"));
  const { rows } =
    groupId == null
      ? await query(
          `SELECT id, group_id, name, mime, created_by, created_at
           FROM custom_emojis WHERE group_id IS NULL
           ORDER BY name`,
        )
      : await query(
          `SELECT id, group_id, name, mime, created_by, created_at
           FROM custom_emojis WHERE group_id = $1
           ORDER BY name`,
          [groupId],
        );
  return c.json({ emojis: rows.map(mapEmoji) });
});

/** Public image (auth optional — short UUID ids). Auth kept for consistency. */
emojiRoutes.get("/:id/image", async (c) => {
  const id = c.req.param("id");
  const { rows } = await query(
    `SELECT mime, file_path FROM custom_emojis WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  const filePath = path.resolve(rows[0].file_path as string);
  const emojiRoot = path.resolve(path.join(config.uploadDir, "emoji"));
  if (!filePath.startsWith(emojiRoot)) {
    return c.json({ error: "Not found" }, 404);
  }
  try {
    const { createReadStream } = await import("node:fs");
    const stream = createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": rows[0].mime as string,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return c.json({ error: "File missing" }, 404);
  }
});

emojiRoutes.post("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const mime = (c.req.header("content-type") ?? "").split(";")[0].trim();
  const name = String(c.req.query("name") ?? "")
    .trim()
    .toLowerCase();
  const groupId = resolveGroupId(c.req.query("groupId") ?? undefined);

  if (!/^[a-z0-9_]{2,32}$/.test(name)) {
    return c.json(
      { error: "Όνομα emoji: 2–32 chars, a-z 0-9 _" },
      400,
    );
  }
  if (!ALLOWED_MIME.has(mime)) {
    return c.json({ error: "Μόνο png/webp/gif/jpeg" }, 400);
  }
  if (!(await canManageChannels(userId, groupId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const len = Number(c.req.header("content-length") ?? 0);
  if (len > MAX_EMOJI_BYTES) {
    return c.json({ error: "Max 256KB ανά emoji" }, 413);
  }

  const id = randomUUID();
  const dir = path.join(config.uploadDir, "emoji");
  await mkdir(dir, { recursive: true });
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "jpg";
  const filePath = path.join(dir, `${id}.${ext}`);

  const body = c.req.raw.body;
  if (!body) return c.json({ error: "Empty body" }, 400);

  const { Transform } = await import("node:stream");
  let written = 0;
  const guard = new Transform({
    transform(chunk, _enc, cb) {
      written += (chunk as Buffer).length;
      if (written > MAX_EMOJI_BYTES) {
        cb(new Error("TOO_LARGE"));
        return;
      }
      cb(null, chunk);
    },
  });

  try {
    const nodeReadable = Readable.fromWeb(
      body as import("stream/web").ReadableStream,
    );
    await pipeline(nodeReadable, guard, createWriteStream(filePath));
  } catch (err) {
    await unlink(filePath).catch(() => undefined);
    if (err instanceof Error && err.message === "TOO_LARGE") {
      return c.json({ error: "Max 256KB ανά emoji" }, 413);
    }
    throw err;
  }

  try {
    const { rows } = await query(
      `INSERT INTO custom_emojis (id, group_id, name, mime, file_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, group_id, name, mime, created_by, created_at`,
      [id, groupId, name, mime, filePath, userId],
    );
    return c.json({ emoji: mapEmoji(rows[0]) }, 201);
  } catch (err) {
    await unlink(filePath).catch(() => undefined);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return c.json({ error: "Το όνομα υπάρχει ήδη" }, 409);
    }
    throw err;
  }
});

emojiRoutes.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const { rows } = await query(
    `SELECT id, group_id, file_path FROM custom_emojis WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  const groupId = (rows[0].group_id as string | null) ?? null;
  if (!(await canManageChannels(userId, groupId))) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await query(`DELETE FROM custom_emojis WHERE id = $1`, [id]);
  await unlink(rows[0].file_path as string).catch(() => undefined);
  return c.json({ ok: true, id });
});

export const emojiNameSchema = z
  .string()
  .regex(/^[a-z0-9_]{2,32}$/);
