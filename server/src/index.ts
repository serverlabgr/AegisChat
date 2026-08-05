import type { Server as HttpServer } from "node:http";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { pool } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { channelRoutes } from "./routes/channels.js";
import { friendRoutes } from "./routes/friends.js";
import { dmRoutes } from "./routes/dms.js";
import { cryptoRoutes } from "./routes/crypto.js";
import { mediaRoutes } from "./routes/media.js";
import { radioRoutes } from "./routes/radio.js";
import { gameRoutes } from "./routes/games.js";
import { tokenRoutes, hookRoutes } from "./routes/tokens.js";
import { botRoutes } from "./routes/bots.js";
import { aiRoutes } from "./routes/ai.js";
import { attachWebSocket } from "./ws.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return config.corsOrigins[0] ?? "*";
      return config.corsOrigins.includes(origin) ? origin : null;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.onError((err, c) => {
  console.error(err);
  const message = config.isProd
    ? "Internal Server Error"
    : err.message || "Internal Server Error";
  return c.json({ error: message }, 500);
});

app.get("/", (c) => {
  const host = c.req.header("host") ?? "SERVER:3001";
  return c.html(`<!doctype html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aegis API</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0b1020;color:#e8ecff;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{max-width:520px;line-height:1.5}
    h1{font-size:1.4rem;margin:0 0 8px}
    p{color:#a9b3d9;margin:0 0 12px}
    code{background:#1a2340;padding:2px 8px;border-radius:6px;color:#8ec8ff}
    .ok{color:#6dffb0;font-weight:600}
    ol{padding-left:1.2rem;color:#c9d2f5}
    li{margin:8px 0}
  </style>
</head>
<body>
  <main>
    <p class="ok">✓ Το Aegis API τρέχει</p>
    <h1>Αυτό δεν είναι το chat</h1>
    <p>Άνοιξες το server (<code>${host}</code>). Το UI ανοίγει στο PC σου, όχι εδώ.</p>
    <ol>
      <li>Στο Windows άνοιξε το <strong>Aegis</strong> desktop app<br/>(ή τοπικά <code>http://127.0.0.1:8765</code>)</li>
      <li>Στο Connect βάλε Server URL: <code>http://${host}</code></li>
      <li>Login με τον λογαριασμό σου (invite-only)</li>
    </ol>
    <p>Health: <a href="/health" style="color:#8ec8ff">/health</a></p>
  </main>
</body>
</html>`);
});

app.get("/health", async (c) => {
  try {
    await pool.query("SELECT 1");
    return c.json({ ok: true, service: "aegis-server" });
  } catch {
    return c.json({ ok: false }, 503);
  }
});

app.route("/auth", authRoutes);
app.route("/channels", channelRoutes);
app.route("/friends", friendRoutes);
app.route("/dms", dmRoutes);
app.route("/crypto", cryptoRoutes);
app.route("/media", mediaRoutes);
app.route("/radio", radioRoutes);
app.route("/games", gameRoutes);
app.route("/tokens", tokenRoutes);
app.route("/bots", botRoutes);
app.route("/ai", aiRoutes);
app.route("/hooks", hookRoutes);

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`Aegis API http://localhost:${info.port}`);
    console.log(`Aegis WS  ws://localhost:${info.port}/ws`);
  },
);

attachWebSocket(server as unknown as HttpServer);

async function shutdown() {
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
