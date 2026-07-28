# Aegis — deploy & Windows updates

Οδηγός για: **VM server (DB + API + HTTPS)** → **Windows app** → **updates από GitHub Releases**.

---

## Αρχιτεκτονική

```
[Windows Aegis.exe]  --HTTPS/WSS-->  [Caddy :443] --> [API :3001] --> [Postgres]
                         ^
              updates από GitHub Releases (NSIS + latest.json)
```

- Το **server** μένει στο VM σου (Docker).
- Το **app** εγκαθίσταται στους υπολογιστές· παίρνει updates από GitHub.
- Δεν χρειάζεται Redis / K8s.

---

## 1) VM — πρώτο setup (μία φορά)

### Προαπαιτούμενα
- Ubuntu 22.04+ (ή παρόμοιο), 2–4 vCPU, 4–8 GB RAM
- Domain που δείχνει στο public IP του VM (A record)
- Ports **80** και **443** ανοιχτά (firewall / security group)
- Docker + Compose plugin

```bash
# Docker (επίσημο)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# logout/login μετά
```

### Clone & env

```bash
sudo mkdir -p /opt && sudo chown $USER:$USER /opt
cd /opt
git clone https://github.com/mpoukas/aegis-chat.git
cd aegis-chat/deploy
cp .env.example .env
nano .env
```

Συμπλήρωσε:
- `DOMAIN` — π.χ. `chat.yourdomain.com`
- `ACME_EMAIL` — για Let's Encrypt
- `POSTGRES_PASSWORD` — `openssl rand -base64 32`
- `JWT_SECRET` — άλλο `openssl rand -base64 32`

### Άνοιγμα

```bash
docker compose up -d --build
# περίμενε healthy:
docker compose ps

# πρώτο seed (admin):
docker compose exec api npx tsx src/seed.ts
```

Άλλαξε αμέσως το password του `admin` από την εφαρμογή (ή φτιάξε νέο user με invite `parea-x9f2` και μετά διέγραψε/άλλαξε το admin).

Έλεγχος: `https://YOUR_DOMAIN/health` → `{"ok":true,...}`

### Backup (προαιρετικό αλλά συνιστάται)

```bash
chmod +x backup.sh update.sh
# crontab -e
# 15 3 * * * /opt/aegis-chat/deploy/backup.sh >> /var/log/aegis-backup.log 2>&1
```

---

## 2) Windows app — πρώτο installer

### GitHub secrets (μία φορά)

Στο repo → **Settings → Secrets and variables → Actions**:

| Secret | Τιμή |
|--------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | περιεχόμενο του `%USERPROFILE%\.tauri\aegis.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | το password του key |
| `VITE_API_URL` *(προαιρετικό)* | `https://YOUR_DOMAIN` — default Server URL μέσα στο build |

Αν δεν βάλεις `VITE_API_URL`, οι χρήστες γράφουν το URL στο Connect / Ρυθμίσεις → Desktop.

### Release

1. Ανέβασε version σε **τρία** σημεία (ίδια τιμή):
   - `package.json` → `"version"`
   - `src-tauri/tauri.conf.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version`
2. Commit + tag + push:

```bash
git add -A && git commit -m "release: v0.1.1"
git tag v0.1.1
git push origin HEAD
git push origin v0.1.1
```

Ή: **Actions → Release Windows → Run workflow**.

3. Στο Release εμφανίζεται `Aegis_*_x64-setup.exe` — αυτό μοιράζεις στους φίλους.

Μετά το install: Server URL = `https://YOUR_DOMAIN` (αν δεν είναι ήδη baked).

---

## 3) Καθημερινή ροή αλλαγών

### Αλλαγές στο **server** (API / DB)

Στο PC σου κάνεις commit + push στο `main`. Στο VM:

```bash
cd /opt/aegis-chat
bash deploy/update.sh
```

(ή `git pull` + `cd deploy && docker compose up -d --build`)

### Αλλαγές στο **Windows app** (UI / Tauri)

1. Bump version (βλ. πάνω)
2. `git tag vX.Y.Z && git push origin vX.Y.Z`
3. Οι ήδη εγκατεστημένοι clients: **Ρυθμίσεις → Updates** (ή αυτόματο prompt στο άνοιγμα)

Το updater διαβάζει:
`https://github.com/mpoukas/aegis-chat/releases/latest/download/latest.json`

Το repo πρέπει να είναι **public** (ή να ρυθμίσεις auth στο updater — για παρέα, public είναι το απλούστερο).

---

## 4) Connect χωρίς public domain (Tailscale)

Αν δεν θες domain ακόμα:
1. Βάλε Tailscale στο VM και στους clients
2. Τρέξε μόνο `db` + `api` χωρίς Caddy (δες τοπικό `docker-compose.yml` + `npm run server:dev`, ή expose `:3001` μόνο στο tailnet)
3. Server URL στο app: `http://100.x.y.z:3001`

Για κανονική παρέα προτείνεται **domain + Caddy** όπως το `deploy/`.

---

## 5) Troubleshooting

| Σύμπτωμα | Έλεγχος |
|----------|---------|
| App δεν συνδέεται | URL `https://…` χωρίς trailing slash· CORS έχει `tauri.localhost` |
| Login 500 | `docker compose logs api` — συνήθως DB / JWT |
| Update δεν φαίνεται | tag `v*` push· secrets signing· version μεγαλύτερο από το εγκατεστημένο |
| Cert fail | DNS A record + ports 80/443· `docker compose logs caddy` |

---

## Τοπικό development (χωρίς deploy/)

```bash
npm run db:up
npm run server:migrate && npm run server:seed
npm run server:dev
npm run tauri:dev
```
