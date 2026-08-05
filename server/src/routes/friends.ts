import { Hono } from "hono";
import { z } from "zod";
import {
  COLORS,
  mapUser,
  randomInviteCode,
  requireAuth,
  type AuthVars,
} from "../auth.js";
import {
  canManageChannels,
  isGroupMember,
  resolveGroupId,
  uniqueChannelId,
} from "../channelAuth.js";
import { query } from "../db.js";
import { broadcast, sendToUser } from "../ws.js";

export const friendRoutes = new Hono<AuthVars>();
friendRoutes.use("*", requireAuth);

friendRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.bio, u.color, u.role, u.status, u.avatar_url
     FROM friendships f
     JOIN users u ON u.id = f.friend_id
     WHERE f.user_id = $1
     ORDER BY u.display_name`,
    [userId],
  );
  return c.json({ friends: rows.map(mapUser) });
});

friendRoutes.get("/requests", async (c) => {
  const userId = c.get("userId");
  const { rows } = await query(
    `SELECT id, from_user_id, to_user_id, from_name, to_username, direction, color, mutual, created_at
     FROM friend_requests
     WHERE from_user_id = $1 OR to_user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return c.json({
    requests: rows.map((r) => ({
      id: r.id,
      name:
        r.direction === "incoming"
          ? r.from_name
          : r.to_username ?? r.from_name,
      mutual: r.mutual,
      direction:
        r.from_user_id === userId
          ? ("outgoing" as const)
          : ("incoming" as const),
      color: r.color,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
    })),
  });
});

friendRoutes.post("/requests", async (c) => {
  const body = z
    .object({ username: z.string().min(1).max(32) })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const me = c.get("userId");
  const target = await query(
    `SELECT id, username, display_name FROM users WHERE lower(username) = lower($1)`,
    [body.data.username],
  );
  if (!target.rows[0]) return c.json({ error: "User not found" }, 404);
  if (target.rows[0].id === me) {
    return c.json({ error: "Cannot friend yourself" }, 400);
  }

  const already = await query(
    `SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2`,
    [me, target.rows[0].id],
  );
  if (already.rows.length) return c.json({ error: "Already friends" }, 409);

  const meRow = await query(
    `SELECT display_name FROM users WHERE id = $1`,
    [me],
  );
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const { rows } = await query(
    `INSERT INTO friend_requests (from_user_id, to_user_id, from_name, to_username, direction, color, mutual)
     VALUES ($1, $2, $3, $4, 'outgoing', $5, 0)
     RETURNING id, from_name, to_username, color, mutual`,
    [
      me,
      target.rows[0].id,
      meRow.rows[0].display_name,
      target.rows[0].username,
      color,
    ],
  );

  const request = {
    id: rows[0].id,
    name: meRow.rows[0].display_name,
    mutual: 0,
    direction: "incoming" as const,
    color,
  };
  sendToUser(target.rows[0].id, { type: "friend_request", request });
  return c.json({
    request: {
      id: rows[0].id,
      name: target.rows[0].username,
      mutual: 0,
      direction: "outgoing" as const,
      color,
    },
  }, 201);
});

friendRoutes.post("/requests/:id/accept", async (c) => {
  const id = c.req.param("id");
  const me = c.get("userId");
  const { rows } = await query(
    `SELECT * FROM friend_requests WHERE id = $1`,
    [id],
  );
  const req = rows[0];
  if (!req || req.to_user_id !== me) {
    return c.json({ error: "Not found" }, 404);
  }
  const fromId = req.from_user_id as string;
  await query(
    `INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
     ON CONFLICT DO NOTHING`,
    [me, fromId],
  );
  await query(`DELETE FROM friend_requests WHERE id = $1`, [id]);
  return c.json({ ok: true, friendId: fromId });
});

friendRoutes.delete("/requests/:id", async (c) => {
  const id = c.req.param("id");
  const me = c.get("userId");
  await query(
    `DELETE FROM friend_requests
     WHERE id = $1 AND (from_user_id = $2 OR to_user_id = $2)`,
    [id, me],
  );
  return c.json({ ok: true });
});

friendRoutes.get("/invites", async (c) => {
  const { rows } = await query(
    `SELECT id, code, max_uses, uses, expires_at, created_at
     FROM invites ORDER BY created_at DESC LIMIT 50`,
  );
  return c.json({
    invites: rows.map((i) => ({
      id: i.id,
      code: i.code,
      uses: i.uses,
      maxUses: i.max_uses,
      expires: formatExpiry(i.expires_at),
    })),
  });
});

friendRoutes.post("/invites", async (c) => {
  const code = randomInviteCode();
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  const { rows } = await query(
    `INSERT INTO invites (code, created_by, max_uses, expires_at)
     VALUES ($1, $2, 10, $3)
     RETURNING id, code, max_uses, uses, expires_at`,
    [code, c.get("userId"), expires.toISOString()],
  );
  const i = rows[0];
  return c.json(
    {
      invite: {
        id: i.id,
        code: i.code,
        uses: i.uses,
        maxUses: i.max_uses,
        expires: formatExpiry(i.expires_at),
      },
    },
    201,
  );
});

friendRoutes.get("/groups", async (c) => {
  const me = c.get("userId");
  const { rows } = await query(
    `SELECT g.id, g.name, g.tag, g.activity, g.color,
            COALESCE(
              (SELECT json_agg(gm.user_id) FROM group_members gm WHERE gm.group_id = g.id),
              '[]'
            ) AS members
     FROM groups g
     INNER JOIN group_members mine ON mine.group_id = g.id AND mine.user_id = $1
     ORDER BY g.created_at DESC`,
    [me],
  );

  const groups = [];
  for (const g of rows) {
    const ch = await query(
      `SELECT id, name, type, topic FROM channels
       WHERE group_id = $1 ORDER BY position, name`,
      [g.id],
    );
    groups.push({
      id: g.id,
      name: g.name,
      tag: g.tag,
      activity: g.activity,
      color: g.color,
      members: g.members,
      channels: ch.rows.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        topic: c.topic || undefined,
      })),
    });
  }
  return c.json({ groups });
});

friendRoutes.post("/groups", async (c) => {
  const body = z
    .object({ name: z.string().trim().min(1).max(48) })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const me = c.get("userId");
  const { rows } = await query(
    `INSERT INTO groups (name, tag, activity, color, created_by)
     VALUES ($1, 'Server', 'μόλις δημιουργήθηκε', $2, $3)
     RETURNING id, name, tag, activity, color`,
    [body.data.name, color, me],
  );
  const groupId = rows[0].id as string;
  await query(
    `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)`,
    [groupId, me],
  );

  const defaults = [
    {
      id: `${groupId}:general`,
      name: "general",
      type: "text",
      topic: `Καλώς ήρθατε στο ${body.data.name}`,
      position: 0,
    },
    {
      id: `${groupId}:chat`,
      name: "chat",
      type: "text",
      topic: "Κουβέντα της παρέας",
      position: 1,
    },
    {
      id: `${groupId}:voice`,
      name: "Lounge",
      type: "voice",
      topic: "",
      position: 10,
    },
  ];
  for (const ch of defaults) {
    await query(
      `INSERT INTO channels (id, name, type, topic, position, group_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [ch.id, ch.name, ch.type, ch.topic, ch.position, groupId],
    );
  }

  return c.json(
    {
      group: {
        ...rows[0],
        members: [me],
        channels: defaults.map(({ id, name, type, topic }) => ({
          id,
          name,
          type,
          topic: topic || undefined,
        })),
      },
    },
    201,
  );
});

friendRoutes.patch("/groups/:id", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      name: z.string().trim().min(1).max(48).optional(),
      color: z.string().trim().min(4).max(16).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  if (body.data.name === undefined && body.data.color === undefined) {
    return c.json({ error: "Nothing to update" }, 400);
  }

  const groupId = resolveGroupId(id);
  if (groupId == null) {
    return c.json({ error: "Το home server δεν μετονομάζεται εδώ" }, 400);
  }
  if (!(await canManageChannels(c.get("userId"), groupId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const cur = await query(
    `SELECT id, name, tag, activity, color FROM groups WHERE id = $1`,
    [groupId],
  );
  if (!cur.rows[0]) return c.json({ error: "Not found" }, 404);

  const next = {
    name: body.data.name ?? (cur.rows[0].name as string),
    color: body.data.color ?? (cur.rows[0].color as string),
  };
  const { rows } = await query(
    `UPDATE groups SET name = $1, color = $2 WHERE id = $3
     RETURNING id, name, tag, activity, color`,
    [next.name, next.color, groupId],
  );
  broadcast({ type: "channels_changed", groupId });
  return c.json({
    group: {
      id: rows[0].id,
      name: rows[0].name,
      tag: rows[0].tag,
      activity: rows[0].activity,
      color: rows[0].color,
    },
  });
});

friendRoutes.delete("/groups/:id", async (c) => {
  const id = c.req.param("id");
  const groupId = resolveGroupId(id);
  if (groupId == null) {
    return c.json({ error: "Δεν διαγράφεται το home server" }, 400);
  }
  const me = c.get("userId");
  const g = await query(`SELECT created_by FROM groups WHERE id = $1`, [groupId]);
  if (!g.rows[0]) return c.json({ error: "Not found" }, 404);
  if (g.rows[0].created_by !== me) {
    const admin = await query(`SELECT role FROM users WHERE id = $1`, [me]);
    if (admin.rows[0]?.role !== "Admin") {
      return c.json({ error: "Μόνο ο δημιουργός ή Admin" }, 403);
    }
  }
  await query(`DELETE FROM channels WHERE group_id = $1`, [groupId]);
  await query(`DELETE FROM group_members WHERE group_id = $1`, [groupId]);
  await query(`DELETE FROM groups WHERE id = $1`, [groupId]);
  broadcast({ type: "channels_changed", groupId });
  return c.json({ ok: true });
});

friendRoutes.post("/groups/:groupId/channels", async (c) => {
  const rawGroupId = c.req.param("groupId");
  const groupId = resolveGroupId(rawGroupId);
  const body = z
    .object({
      name: z.string().trim().min(1).max(48),
      type: z.enum(["text", "voice"]),
      topic: z.string().max(280).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const me = c.get("userId");
  if (groupId != null && !(await isGroupMember(me, groupId))) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (!(await canManageChannels(me, groupId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const pos = await query(
    `SELECT COALESCE(MAX(position), -1)::int AS m FROM channels
     WHERE type = $1 AND (
       ($2::uuid IS NULL AND group_id IS NULL) OR group_id = $2
     )`,
    [body.data.type, groupId],
  );
  const position = ((pos.rows[0]?.m as number) ?? -1) + 1;
  const id = await uniqueChannelId(groupId, body.data.name);
  const topic = body.data.topic ?? "";

  const { rows } = await query(
    `INSERT INTO channels (id, name, type, topic, position, group_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, type, topic, position, group_id AS "groupId"`,
    [id, body.data.name, body.data.type, topic, position, groupId],
  );
  const channel = {
    id: rows[0].id,
    name: rows[0].name,
    type: rows[0].type as "text" | "voice",
    topic: rows[0].topic || undefined,
    position: rows[0].position,
    groupId: rows[0].groupId ?? null,
  };
  broadcast({ type: "channels_changed", groupId });
  return c.json({ channel }, 201);
});

friendRoutes.get("/users", async (c) => {
  const { rows } = await query(
    `SELECT id, username, display_name, bio, color, role, status, avatar_url
     FROM users ORDER BY display_name`,
  );
  return c.json({ users: rows.map(mapUser) });
});

friendRoutes.patch("/me", async (c) => {
  const body = z
    .object({
      displayName: z.string().min(1).max(48).optional(),
      bio: z.string().max(280).optional(),
      status: z.enum(["online", "away", "busy", "offline"]).optional(),
      color: z.string().max(16).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const me = c.get("userId");
  const cur = await query(`SELECT * FROM users WHERE id = $1`, [me]);
  if (!cur.rows[0]) return c.json({ error: "Not found" }, 404);
  const next = {
    display_name: body.data.displayName ?? cur.rows[0].display_name,
    bio: body.data.bio ?? cur.rows[0].bio,
    status: body.data.status ?? cur.rows[0].status,
    color: body.data.color ?? cur.rows[0].color,
  };
  const { rows } = await query(
    `UPDATE users SET display_name = $1, bio = $2, status = $3, color = $4
     WHERE id = $5
     RETURNING id, username, display_name, bio, color, role, status, avatar_url`,
    [next.display_name, next.bio, next.status, next.color, me],
  );
  if (body.data.status) {
    broadcast({ type: "presence", userId: me, status: body.data.status });
  }
  return c.json({ user: mapUser(rows[0]) });
});

function formatExpiry(expiresAt: Date | string | null): string {
  if (!expiresAt) return "χωρίς λήξη";
  const t = new Date(expiresAt).getTime();
  if (t < Date.now()) return "έληξε";
  const days = Math.ceil((t - Date.now()) / 86_400_000);
  return `σε ${days} μέρες`;
}
