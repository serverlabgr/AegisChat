# Aegis — οδηγίες για την παρέα

Γρήγορο one-pager για εγκατάσταση στο LAN. **Μην κατεβάζεις το Setup από GitHub** (συχνά false positive Defender σε μικρά Tauri .exe).

## Εγκατάσταση (Windows)

1. Άνοιξε: **http://192.168.1.235:8080/**
2. Κατέβασε **`Aegis_latest_x64-setup.exe`** (ή το portable zip)
3. Εγκατάστησε / άνοιξε το Aegis
4. Στο Connect βάλε Server URL:

   `http://192.168.1.235:3001`

5. Login με invite code (από τον admin της παρέας)

## Updates

Από το app: **Settings → Updates**. Τραβάει από `http://192.168.1.235:8080/latest.json`.

## Recovery Key

Μετά το πρώτο login κράτα το **Recovery Key** (Settings → Ασφάλεια). Χωρίς αυτό δεν ξανανοίγει το vault αν αλλάξεις PC.

## Τι δουλεύει τώρα

- Chat (κανάλια + DM, edit/delete, reactions, typing, notifications, read receipts)
- Voice mesh στα voice channels
- Radio (συγχρονισμένα streams)
- Game sessions + Dev Portal tokens/webhooks + Toolbox
- LAN updater: http://192.168.1.235:8080/

## Remote (εκτός Wi‑Fi)

Όταν στηθεί Headscale στο VM — δες `DEPLOY.md` / Settings → Ασφάλεια. Μέχρι τότε μόνο LAN.

## Admin

Invite codes: από Friends / admin στο server. Μην μοιράζεις το Recovery Key σου.
