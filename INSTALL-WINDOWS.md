# Aegis Windows — εγκατάσταση για την παρέα

## Τι τρέχει ήδη στον server (VM)

| Υπηρεσία | URL |
|----------|-----|
| API + WebSocket | `http://192.168.1.235:3001` |
| **Λήψεις (fallback πρώτη εγκατάσταση)** | **`http://192.168.1.235:8080/`** |
| Health | `http://192.168.1.235:3001/health` → `{"ok":true}` |

Database: PostgreSQL (Docker στο VM, `/opt/aegis-chat/deploy`).

---

## Εγκατάσταση

### Αν ο browser μπλοκάρει το GitHub .exe

Το μικρό Tauri NSIS συχνά μπλοκάρεται από browser / Microsoft cloud ως
`Trojan:Win32/Wacatac.B!ml` (ψευδής συναγερμός ML). **Κατέβασε από το VM.**

1. Άνοιξε: **http://192.168.1.235:8080/Aegis_latest_x64-setup.exe**
2. Τρέξε το installer (per-user, χωρίς UAC).
3. Server URL: **`http://192.168.1.235:3001`**

Ή άνοιξε τη λίστα: **http://192.168.1.235:8080/**

### Από GitHub (αν το Defender/browser το επιτρέπει)

https://github.com/serverlabgr/AegisChat/releases — `Aegis_*_x64-setup.exe`

### Portable ZIP

- **http://192.168.1.235:8080/Aegis_latest_windows_x64.zip**
- Unzip → `Aegis.exe`. Αν μπλοκάρει: `Unblock-File .\Aegis.exe`

Default **Server URL** = `http://192.168.1.235:3001`.
Media: max **2GB** ανά αρχείο.

## Βήματα μετά το άνοιγμα

1. Connect με Server URL παραπάνω.
2. Login, ή Register με invite code.
3. Αν είσαι νέος: βάλε και το **Recovery Key** της παρέας (μία φορά).

### Seed (μόνο admin — άλλαξέ το)

- User: `admin`
- Pass: `changeme123` → άλλαξέ το αμέσως από Ρυθμίσεις → Προφίλ
- Invite: `parea-x9f2`

## Updates (σιωπηλή in-app ενημέρωση)

**Ρυθμίσεις → Updates → Έλεγχος** — κατεβάζει από **GitHub Releases**
(`…/releases/latest/download/latest.json`), εγκαθιστά χωρίς Setup wizard και
επανεκκινεί. Δεν χρειάζεται χειροκίνητο download.

LAN (`http://192.168.1.235:8080/latest.json`) είναι fallback αν το GitHub δεν είναι διαθέσιμο.

Μετά από κάθε release, mirror στο VM (χωρίς να σβήνεις το GitHub):

```powershell
.\scripts\publish-downloads-to-vm.ps1 -Tag v0.7.4
```

Μην χρησιμοποιείς `-RemoveNsisFromGitHub` — σπάει τα in-app updates από GitHub.

## Browser vs in-app

- Το ToolBox NSIS είναι ~**250 MB** (Electron) → καλύτερη φήμη στο cloud ML για browser downloads.
- Το Aegis NSIS είναι ~**4 MB** (Tauri) → συχνά `Wacatac.!ml` στο **browser**, όχι στο in-app updater.
- **In-app updates** τραβάνε απευθείας από GitHub (χωρίς browser) και δουλεύουν κανονικά.
- **Μόνιμη λύση για internet browser downloads:** Authenticode / **Azure Trusted Signing**.

## Authenticode / Azure Trusted Signing (μελλοντικά)

Όταν υπάρχουν credentials Azure Trusted Signing:

1. Πρόσθεσε secrets στο GitHub (endpoint, account, certificate profile, κ.λπ.)
2. Ενεργοποίησε το προαιρετικό βήμα στο `.github/workflows/release.yml` (σχόλια `Azure Trusted Signing`)
3. Ξαναχτίσε και δημοσίευσε — τότε το GitHub `.exe` γίνεται ασφαλές και για browser downloads

Μην βάζεις self-signed / fake PFX.

## Rebuild τοπικά

```powershell
$env:VITE_API_URL = "http://192.168.1.235:3001"
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\aegis.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-key-password"
npm run tauri:build
```
