import { hashPassword } from "./auth.js";
import { pool, query } from "./db.js";

async function seed() {
  const adminPass = await hashPassword("changeme123");
  const { rows: existing } = await query(
    `SELECT id FROM users WHERE username = 'admin'`,
  );

  let adminId: string;
  if (existing[0]) {
    adminId = existing[0].id;
    console.log("admin already exists");
  } else {
    const inserted = await query(
      `INSERT INTO users (username, password_hash, display_name, bio, color, role, status)
       VALUES ('admin', $1, 'Nikos', 'Ο host της παρέας 🎮', '#6ec4ae', 'Admin', 'offline')
       RETURNING id`,
      [adminPass],
    );
    adminId = inserted.rows[0].id;
    console.log("created admin / changeme123");
  }

  const channels = [
    { id: "general", name: "general", type: "text", topic: "Γενική κουβέντα της παρέας", position: 0 },
    { id: "gaming", name: "gaming", type: "text", topic: "Gaming sessions & LFG", position: 1 },
    { id: "dev", name: "dev-talk", type: "text", topic: "Παιχνίδια, mods & tech", position: 2 },
    { id: "random", name: "random", type: "text", topic: "Ό,τι να 'ναι", position: 3 },
    { id: "voice-lounge", name: "Lounge", type: "voice", topic: "", position: 10 },
    { id: "voice-gaming", name: "Gaming", type: "voice", topic: "", position: 11 },
  ];

  for (const ch of channels) {
    await query(
      `INSERT INTO channels (id, name, type, topic, position)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, topic = EXCLUDED.topic`,
      [ch.id, ch.name, ch.type, ch.topic, ch.position],
    );
  }

  const { rows: inv } = await query(
    `SELECT id FROM invites WHERE code = 'parea-x9f2'`,
  );
  if (!inv[0]) {
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    await query(
      `INSERT INTO invites (code, created_by, max_uses, uses, expires_at)
       VALUES ('parea-x9f2', $1, 100, 0, $2)`,
      [adminId, expires.toISOString()],
    );
    console.log("invite code: parea-x9f2");
  }

  const { rows: msgCount } = await query(
    `SELECT count(*)::int AS n FROM messages WHERE channel_id = 'general'`,
  );
  if (msgCount[0].n === 0) {
    await query(
      `INSERT INTO messages (channel_id, author_id, content)
       VALUES ('general', $1, 'Καλώς ήρθατε στο Aegis — ο server είναι live.')`,
      [adminId],
    );
  }

  console.log("seed complete");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
