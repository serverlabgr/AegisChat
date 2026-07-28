# Aegis

Private chat for your friend group — invite-only, self-hosted. Built as a **Windows desktop app** with Tauri 2.

## Stack

- React 19 + TypeScript + Vite
- Tauri 2 (Windows-first, NSIS installer)
- **Backend:** Hono (Node) + PostgreSQL + WebSockets
- Auth: invite codes + Argon2 + JWT / refresh tokens
- Live updates: Tauri updater → GitHub Releases

## Security model (best for self-hosted παρέα)

| Layer | What it does |
|--------|----------------|
| **Zero-knowledge vault** | AES-256-GCM key generated on a client. Server **never** gets the raw key — only password-wrapped copies (`user_vaults`). |
| **Ciphertext at rest** | Messages + photo/video blobs stored encrypted. No re-encode (original resolution). |
| **Recovery Key** | First member creates `AEGIS-….` key → share out-of-band with friends. They enter it once at login. |
| **Private network** | Recommended: **domain + Caddy HTTPS** (`deploy/`) or **Tailscale** so the API isn’t raw on the public internet. |

This is stronger than “server encrypts with a key it also knows”. It is **not** Signal/MLS per-device ratchet (that’s a much larger project). For a friend server you control + Tailscale, this is the right trade-off.

### Flow for the group

1. First user logs in → app creates vault → shows **Recovery Key** (save it).
2. Friends register with invite + paste the same Recovery Key once.
3. Optionally put the API on Tailscale (`http://100.x.x.x:3001`).

## Full local stack

```bash
# 1) Database
npm run db:up

# 2) API
cd server
cp .env.example .env   # first time
npm install
npm run migrate
npm run seed
npm run dev            # http://localhost:3001

# 3) Client (other terminal, repo root)
npm install
npm run dev            # http://localhost:8765
```

### Seed login

| | |
|--|--|
| Username | `admin` |
| Password | `changeme123` |
| Invite | `parea-x9f2` |

Στο Connect: **Server URL** + (αν δεν είσαι ο πρώτος) **Recovery Key**.

## Production (VM + Windows updates)

Οδηγός βήμα-βήμα: **[`DEPLOY.md`](DEPLOY.md)**

- VM: `deploy/docker-compose.yml` → Postgres + API + Caddy (HTTPS/WSS)
- Windows installer + live updates: GitHub Actions → Releases
- Server updates στο VM: `bash deploy/update.sh`
- App updates στους clients: bump version + `git tag vX.Y.Z`

```bash
# στο VM
cd /opt/aegis-chat/deploy
cp .env.example .env   # DOMAIN, JWT_SECRET, POSTGRES_PASSWORD
docker compose up -d --build
docker compose exec api npx tsx src/seed.ts
```

## Windows app (dev)

```bash
npm run tauri:dev
```

## Build installer (local)

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\aegis.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-password"
npm run tauri:build
```

## GitHub live updates

1. Push repo, set secrets `TAURI_SIGNING_PRIVATE_KEY` + `_PASSWORD` (+ optional `VITE_API_URL=http://192.168.1.235:3001`).
2. `npm run bump -- 0.2.0` → commit → `git tag v0.2.0 && git push origin HEAD v0.2.0`
   ή run **Release Windows** workflow.
3. Share το `Aegis_*_x64-setup.exe` με την παρέα. Server URL = `http://192.168.1.235:3001` (ή Tailscale IP).
4. Users get in-app «Νέα έκδοση διαθέσιμη».

**Σημαντικό πριν το share:** άλλαξε το password του `admin` από Ρυθμίσεις → Προφίλ.

## Server docs

See [`server/README.md`](server/README.md).
