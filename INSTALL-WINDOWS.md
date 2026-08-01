# Aegis Windows — εγκατάσταση για την παρέα

## Τι τρέχει ήδη στον server (VM)

- Host: `192.168.1.235`
- API + WebSocket: `http://192.168.1.235:3001`
- Database: PostgreSQL (Docker στο VM, `/opt/aegis-chat/deploy`)

Έλεγχος: άνοιξε στο browser `http://192.168.1.235:3001/health` → `{"ok":true}`

## Installer

Προτίμησε GitHub Releases: https://github.com/serverlabgr/AegisChat/releases

| Αρχείο | Χρήση |
|--------|--------|
| **Aegis_*_x64-setup.exe** | NSIS — μοίρασέ το στους φίλους |
| `*.sig` / `latest.json` | Auto-update |

Default **Server URL** = `http://192.168.1.235:3001`.

Media: max **2GB** ανά αρχείο (client + server). Τα αρχεία μένουν encrypted στο volume `aegis_uploads`.

## Βήματα για κάθε φίλο

1. Τρέξε το `Aegis_*_x64-setup.exe` (ίδιο LAN ή VPN/Tailscale με το VM).
2. Άνοιξε Aegis → Connect.
3. Login με τον λογαριασμό σου, ή Register με invite code.
4. Αν είσαι νέος: βάλε και το **Recovery Key** της παρέας (μία φορά).

### Seed (μόνο admin — άλλαξέ το)

- User: `admin`
- Pass: `changeme123` → άλλαξέ το αμέσως από Ρυθμίσεις → Προφίλ
- Invite: `parea-x9f2`

## Updates

Ρυθμίσεις → Updates (χωρίς reinstall). Releases από `serverlabgr/AegisChat`.

## Rebuild τοπικά

```powershell
$env:VITE_API_URL = "http://192.168.1.235:3001"
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\aegis.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-key-password"
npm run tauri:build
```
