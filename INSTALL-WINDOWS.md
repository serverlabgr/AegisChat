# Aegis Windows — εγκατάσταση για την παρέα

## Τι τρέχει ήδη στον server (VM)

- Host: `192.168.1.235`
- API + WebSocket: `http://192.168.1.235:3001`
- Database: PostgreSQL (Docker στο VM, `/opt/aegis-chat/deploy`)

Έλεγχος: άνοιξε στο browser `http://192.168.1.235:3001/health` → `{"ok":true}`

## Installer (τοπικό build v0.2.0)

Φάκελος στο PC σου:

`C:\Users\mpoukas\Documents\Cursor Projects\aegis-chat\dist-installers\`

| Αρχείο | Χρήση |
|--------|--------|
| **Aegis_0.2.0_x64-setup.exe** | Προτεινόμενο (NSIS) — μοίρασέ το στους φίλους |
| `Aegis_0.2.0_x64_el-GR.msi` | MSI Ελληνικά |
| `Aegis_0.2.0_x64_en-US.msi` | MSI English |
| `Aegis_0.2.0_x64-setup.exe.sig` | Υπογραφή για GitHub updater |

Το build έχει ήδη default **Server URL** = `http://192.168.1.235:3001`.

Media (φωτο / video / οποιοδήποτε αρχείο): χωρίς τεχνητό μέγεθος cap στο server (`MAX_UPLOAD_BYTES=0`). Το πραγματικό όριο είναι ο δίσκος του VM (~19GB ελεύθερα). Τα αρχεία μένουν encrypted στο disk volume `aegis_uploads`.

## Βήματα για κάθε φίλο

1. Τρέξε το `Aegis_0.2.0_x64-setup.exe` (ίδιο LAN ή VPN/Tailscale με το VM).
2. Άνοιξε Aegis → Connect.
3. Login με τον λογαριασμό σου, ή Register με invite code.
4. Αν είσαι νέος: βάλε και το **Recovery Key** της παρέας (μία φορά).

### Seed (μόνο admin — άλλαξέ το)

- User: `admin`
- Pass: `changeme123` → άλλαξέ το αμέσως από Ρυθμίσεις → Προφίλ
- Invite: `parea-x9f2`

## Updates από GitHub (μετά)

1. Repo secrets: `TAURI_SIGNING_PRIVATE_KEY` + `_PASSWORD` (+ `VITE_API_URL`).
2. `git tag v0.2.1 && git push origin v0.2.1`
3. Actions → Release Windows ανεβάζει NSIS + `latest.json`
4. Οι clients: Ρυθμίσεις → Updates

## Rebuild τοπικά

```powershell
$env:VITE_API_URL = "http://192.168.1.235:3001"
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\aegis.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-key-password"
npm run tauri:build
```
