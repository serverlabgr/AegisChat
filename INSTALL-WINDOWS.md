# Aegis Windows — εγκατάσταση για την παρέα

## Τι τρέχει ήδη στον server (VM)

| Υπηρεσία | URL |
|----------|-----|
| API + WebSocket | `http://192.168.1.235:3001` |
| **Λήψεις (πρωτεύον)** | **`http://192.168.1.235:8080/`** |
| Health | `http://192.168.1.235:3001/health` → `{"ok":true}` |

Database: PostgreSQL (Docker στο VM, `/opt/aegis-chat/deploy`).

---

## Εγκατάσταση (ΜΟΝΟ από LAN — μην χρησιμοποιείς GitHub .exe)

Το GitHub download του μικρού Tauri NSIS συχνά μπλοκάρεται από browser / Microsoft cloud ως
`Trojan:Win32/Wacatac.B!ml` (ψευδής συναγερμός ML). **Κατέβασε από το VM.**

### Προτεινόμενο: Setup από LAN (τοπικό scan καθαρό)

1. Άνοιξε: **http://192.168.1.235:8080/Aegis_latest_x64-setup.exe**
2. Τρέξε το installer (per-user, χωρίς UAC).
3. Server URL: **`http://192.168.1.235:3001`**

Ή άνοιξε τη λίστα: **http://192.168.1.235:8080/**

### Εναλλακτικά: portable ZIP

- **http://192.168.1.235:8080/Aegis_latest_windows_x64.zip**
- Unzip → `Aegis.exe`. Αν μπλοκάρει: `Unblock-File .\Aegis.exe`
- Σημείωση: το ZIP μπορεί να χτυπήσει τοπικό Defender ML (`Trojan:Script/Wacatac.B!ml`)· **προτίμησε το Setup από LAN**.

### GitHub (μόνο backup / developers)

https://github.com/serverlabgr/AegisChat/releases — το `.exe` εκεί μπορεί να false-positive στο browser.
Χρησιμοποίησε GitHub μόνο αν το LAN δεν είναι διαθέσιμο.

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

## Updates

Ρυθμίσεις → Updates. Τα updates κατεβαίνουν από το LAN
(`http://192.168.1.235:8080/latest.json` → setup στο ίδιο host), όχι από GitHub.

Δημοσίευση νέου release στο VM (από το PC του admin):

```powershell
.\scripts\publish-downloads-to-vm.ps1 -Tag v0.2.6 -RemoveNsisFromGitHub
```

## Γιατί το ToolBox «δουλεύει» από GitHub και το Aegis όχι

- Το ToolBox NSIS είναι ~**250 MB** (Electron) με αρκετό ιστορικό downloads → καλύτερη φήμη στο cloud ML.
- Το Aegis NSIS είναι ~**4 MB** (Tauri) → συχνά πέφτει σε `Wacatac.!ml` false positive στο **browser/cloud**, ακόμα κι αν το τοπικό Defender είναι καθαρό.
- **Μόνιμη λύση για internet downloads:** Authenticode / **Azure Trusted Signing** (βλ. παρακάτω). Μέχρι τότε: **μόνο LAN**.

## Authenticode / Azure Trusted Signing (μελλοντικά)

Χωρίς υπογραφή κώδικα, τυχαία internet downloads θα συνεχίζουν να μπλοκάρονται.
Όταν υπάρχουν credentials Azure Trusted Signing:

1. Πρόσθεσε secrets στο GitHub (endpoint, account, certificate profile, κ.λπ.)
2. Ενεργοποίησε το προαιρετικό βήμα στο `.github/workflows/release.yml` (σχόλια `Azure Trusted Signing`)
3. Ξαναχτίσε και δημοσίευσε — τότε το GitHub `.exe` γίνεται ασφαλές για φίλους εκτός LAN

Μην βάζεις self-signed / fake PFX.

## Rebuild τοπικά

```powershell
$env:VITE_API_URL = "http://192.168.1.235:3001"
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\aegis.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-key-password"
npm run tauri:build
```
