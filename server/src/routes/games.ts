import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";
import { broadcast } from "../ws.js";
import { pterodactylConfigured, pterodactylPower } from "../lib/pterodactyl.js";
import { config } from "../config.js";

export const gameRoutes = new Hono<AuthVars>();
gameRoutes.use("*", requireAuth);

const TEMPLATES: Record<
  string,
  { name: string; icon: string; maxPlayers: number }
> = {
  minecraft: { name: "Minecraft", icon: "⛏️", maxPlayers: 20 },
  cs2: { name: "Counter-Strike 2", icon: "🔫", maxPlayers: 10 },
  valheim: { name: "Valheim", icon: "🪓", maxPlayers: 10 },
  rust: { name: "Rust", icon: "🏕️", maxPlayers: 50 },
  terraria: { name: "Terraria", icon: "🌳", maxPlayers: 8 },
  factorio: { name: "Factorio", icon: "⚙️", maxPlayers: 8 },
};

function mapSession(row: Record<string, unknown>) {
  const tpl = TEMPLATES[String(row.template_id)] ?? {
    name: String(row.name),
    icon: "🎮",
    maxPlayers: Number(row.max_players) || 10,
  };
  return {
    id: row.id,
    templateId: row.template_id,
    game: row.name ?? tpl.name,
    status: row.status,
    players: Number(row.players) || 0,
    maxPlayers: Number(row.max_players) || tpl.maxPlayers,
    region: row.region,
    notes: row.notes ?? "",
    icon: tpl.icon,
    createdBy: row.created_by,
    updatedAt: new Date(String(row.updated_at)).getTime(),
    pterodactylIdentifier: row.pterodactyl_identifier ?? "",
    joinAddress: row.join_address ?? "",
  };
}

gameRoutes.get("/config", (c) =>
  c.json({
    pterodactylConfigured: pterodactylConfigured(),
    pterodactylPanelUrl: config.pterodactylUrl ?? null,
  }),
);

gameRoutes.get("/templates", (c) =>
  c.json({
    templates: Object.entries(TEMPLATES).map(([id, t]) => ({
      id,
      name: t.name,
      icon: t.icon,
      maxPlayers: t.maxPlayers,
    })),
  }),
);

gameRoutes.get("/sessions", async (c) => {
  const { rows } = await query(
    `SELECT * FROM game_sessions ORDER BY updated_at DESC LIMIT 100`,
  );
  return c.json({ sessions: rows.map(mapSession) });
});

gameRoutes.post("/sessions", async (c) => {
  const body = z
    .object({
      templateId: z.string().min(1).max(64),
      name: z.string().trim().min(1).max(80).optional(),
      notes: z.string().max(500).optional(),
      pterodactylIdentifier: z.string().max(128).optional(),
      joinAddress: z.string().max(256).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  const tpl = TEMPLATES[body.data.templateId];
  if (!tpl) return c.json({ error: "Unsupported template" }, 400);

  const { rows } = await query(
    `INSERT INTO game_sessions (
       template_id, name, status, max_players, notes, created_by,
       pterodactyl_identifier, join_address
     )
     VALUES ($1, $2, 'offline', $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      body.data.templateId,
      body.data.name ?? tpl.name,
      tpl.maxPlayers,
      body.data.notes ?? "",
      c.get("userId"),
      body.data.pterodactylIdentifier ?? "",
      body.data.joinAddress ?? "",
    ],
  );
  const session = mapSession(rows[0]);
  broadcast({ type: "game_session", session, action: "created" });
  return c.json({ session }, 201);
});

gameRoutes.patch("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      status: z.enum(["online", "offline", "starting", "stopping"]).optional(),
      players: z.number().int().min(0).max(200).optional(),
      notes: z.string().max(500).optional(),
      name: z.string().trim().min(1).max(80).optional(),
      pterodactylIdentifier: z.string().max(128).optional(),
      joinAddress: z.string().max(256).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const cur = await query(`SELECT * FROM game_sessions WHERE id = $1`, [id]);
  if (!cur.rows[0]) return c.json({ error: "Not found" }, 404);
  const prev = cur.rows[0];

  const pteroId = (
    body.data.pterodactylIdentifier ?? prev.pterodactyl_identifier ?? ""
  ) as string;

  if (body.data.status === "online" || body.data.status === "starting") {
    if (pteroId) {
      const sig = body.data.status === "starting" ? "start" : "start";
      const res = await pterodactylPower(pteroId, sig);
      if (!res.ok) return c.json({ error: res.error }, 502);
    }
  } else if (body.data.status === "offline" || body.data.status === "stopping") {
    if (pteroId) {
      const res = await pterodactylPower(pteroId, "stop");
      if (!res.ok) return c.json({ error: res.error }, 502);
    }
  }

  const { rows } = await query(
    `UPDATE game_sessions SET
       status = COALESCE($1, status),
       players = COALESCE($2, players),
       notes = COALESCE($3, notes),
       name = COALESCE($4, name),
       pterodactyl_identifier = COALESCE($5, pterodactyl_identifier),
       join_address = COALESCE($6, join_address),
       updated_at = now()
     WHERE id = $7
     RETURNING *`,
    [
      body.data.status ?? null,
      body.data.players ?? null,
      body.data.notes ?? null,
      body.data.name ?? null,
      body.data.pterodactylIdentifier ?? null,
      body.data.joinAddress ?? null,
      id,
    ],
  );
  const session = mapSession(rows[0]);
  broadcast({ type: "game_session", session, action: "updated" });
  return c.json({ session });
});

gameRoutes.delete("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const { rows } = await query(
    `DELETE FROM game_sessions WHERE id = $1 RETURNING *`,
    [id],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  const session = mapSession(rows[0]);
  broadcast({ type: "game_session", session, action: "deleted" });
  return c.json({ ok: true });
});
