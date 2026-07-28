# Aegis Server

Node (Hono) + PostgreSQL + WebSocket API for ~50–100 users.

## Local development

```bash
# from repo root
docker compose up -d
cd server
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

API: `http://localhost:3001`  
WS: `ws://localhost:3001/ws?token=<accessJwt>`

### Seed credentials

- Admin: `admin` / `changeme123`
- Invite: `parea-x9f2`

## Production (VM)

Use the stack in [`../deploy`](../deploy) — Postgres + API container + Caddy TLS.
Full runbook: [`../DEPLOY.md`](../DEPLOY.md).

```bash
cd deploy
cp .env.example .env   # DOMAIN, JWT_SECRET, POSTGRES_PASSWORD
docker compose up -d --build
docker compose exec api npx tsx src/seed.ts
```

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | — |
| POST | `/auth/register` | invite + username/password |
| POST | `/auth/login` | username/password |
| POST | `/auth/refresh` | refresh token |
| GET | `/auth/me` | JWT |
| GET/POST | `/channels`, `/channels/:id/messages` | JWT |
| GET/POST | `/friends`, `/friends/requests`, `/friends/invites`, `/friends/groups` | JWT |
| GET/POST | `/dms`, `/dms/with/:userId`, `/dms/:id/messages` | JWT |

## Production notes

- Set a long random `JWT_SECRET` (≥32 chars)
- Put Caddy/nginx TLS in front (included in `deploy/`)
- Daily `pg_dump` via `deploy/backup.sh`
- Change the admin password immediately after first login
