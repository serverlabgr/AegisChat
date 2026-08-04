# Aegis — οδηγίες για την παρέα

Γρήγορο one-pager για εγκατάσταση στο LAN.

## Εγκατάσταση (Windows)

1. Άνοιξε: **http://192.168.1.235:8080/**
2. Κατέβασε **`Aegis_latest_x64-setup.exe`** (ή το portable zip)
3. Εγκατάστησε / άνοιξε το Aegis
4. Στο Connect βάλε Server URL:

   `http://192.168.1.235:3001`

5. Login με invite code (από τον admin της παρέας)

Αν ο browser μπλοκάρει το GitHub `.exe` (false positive Defender), χρησιμοποίησε το LAN παραπάνω.
Αλλιώς μπορείς και από: https://github.com/serverlabgr/AegisChat/releases

## Updates

Από το app: **Ρυθμίσεις → Updates → Έλεγχος**. Κατεβάζει σιωπηλά και επανεκκινεί
(χωρίς Setup wizard). Πρώτα GitHub Releases, LAN μόνο ως fallback.

## Recovery Key

Μετά το πρώτο login κράτα το **Recovery Key** (Settings → Ασφάλεια). Χωρίς αυτό δεν ξανανοίγει το vault αν αλλάξεις PC.

## Τι δουλεύει τώρα

- Chat (κανάλια + DM, edit/delete, reactions, typing, notifications, read receipts)
- Voice mesh στα voice channels
- Radio (συγχρονισμένα streams)
- Game sessions + Dev Portal tokens/webhooks + Toolbox
- In-app updater: GitHub Releases (+ LAN fallback)

## Remote (εκτός Wi‑Fi)

Όταν στηθεί Headscale στο VM — δες `DEPLOY.md` / Settings → Ασφάλεια. Μέχρι τότε μόνο LAN.

## Admin

Invite codes: από Friends / admin στο server. Μην μοιράζεις το Recovery Key σου.
