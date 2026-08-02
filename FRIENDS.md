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

## Τι δουλεύει τώρα (0.3.x)

- Κανάλια + DM, edit/delete, reactions, typing, notifications
- Κρυπτογραφημένα μηνύματα / media
- LAN updater

## Σύντομα

- Voice channels
- Radio μαζί
- Game hosting sessions
- Dev portal / webhooks

## Admin

Invite codes: από Friends / admin στο server. Μην μοιράζεις το Recovery Key σου.
