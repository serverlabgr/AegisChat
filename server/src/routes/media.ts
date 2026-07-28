import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Hono } from "hono";
import { config } from "../config.js";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";

export const mediaRoutes = new Hono<{ Variables: AuthVars }>();
mediaRoutes.use("*", requireAuth);

async function ensureUploadDir() {
  await mkdir(config.uploadDir, { recursive: true });
}

/**
 * Upload pre-encrypted blob (client AES-GCM). Server never re-encodes media —
 * original bytes are preserved inside the ciphertext.
 * Body: raw binary = iv(12) || ciphertext
 *
 * Streams to disk so multi‑GB videos don't OOM the API (4GB VM).
 * MAX_UPLOAD_BYTES=0 means no artificial cap (disk is the real limit).
 */
mediaRoutes.post("/", async (c) => {
  const me = c.get("userId");
  const declared = Number(c.req.header("content-length") ?? 0);
  const max = config.maxUploadBytes;

  if (max > 0 && declared > 0 && declared > max) {
    return c.json(
      { error: `Max upload ${Math.floor(max / 1024 / 1024)}MB` },
      413,
    );
  }

  const webBody = c.req.raw.body;
  if (!webBody) {
    return c.json({ error: "Empty body" }, 400);
  }

  await ensureUploadDir();
  const id = randomUUID();
  const path = join(config.uploadDir, `${id}.aegis`);

  let written = 0;
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      written += chunk.length;
      if (max > 0 && written > max) {
        cb(new Error(`Max upload ${Math.floor(max / 1024 / 1024)}MB`));
        return;
      }
      cb(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(webBody as import("node:stream/web").ReadableStream),
      limiter,
      createWriteStream(path),
    );
  } catch (err) {
    await unlink(path).catch(() => {});
    const msg = err instanceof Error ? err.message : "Upload failed";
    if (msg.startsWith("Max upload")) {
      return c.json({ error: msg }, 413);
    }
    return c.json({ error: msg }, 500);
  }

  if (written < 13) {
    await unlink(path).catch(() => {});
    return c.json({ error: "Invalid encrypted payload" }, 400);
  }

  await query(
    `INSERT INTO media_blobs (id, owner_id, size_bytes, path) VALUES ($1, $2, $3, $4)`,
    [id, me, written, path],
  );

  return c.json({ id, size: written }, 201);
});

/** Download encrypted blob as-is (client decrypts). Streamed from disk. */
mediaRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const { rows } = await query(
    `SELECT path, size_bytes FROM media_blobs WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);

  const filePath = rows[0].path as string;
  let size = Number(rows[0].size_bytes);
  try {
    size = (await stat(filePath)).size;
  } catch {
    return c.json({ error: "Not found" }, 404);
  }

  const stream = Readable.toWeb(createReadStream(filePath));
  return new Response(stream as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Cache-Control": "private, max-age=3600",
      "X-Aegis-Encrypted": "1",
    },
  });
});
