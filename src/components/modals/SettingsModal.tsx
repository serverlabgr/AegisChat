import { useEffect, useState } from "react";
import {
  User as UserIcon,
  Palette,
  Bell,
  RefreshCw,
  Monitor,
  Shield,
  Copy,
  Network,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { Toggle } from "../common/Toggle";
import { Avatar } from "../common/Avatar";
import { useStore, ACCENT_OPTIONS } from "../../store/store";
import type { UserStatus } from "../../data/mock";
import { checkForAppUpdate, installAppUpdate } from "../../lib/updater";
import { getAutostartEnabled, setAutostartEnabled } from "../../lib/autostart";
import { loadServerUrl, saveServerUrl } from "../../lib/serverConfig";
import { getRecoveryKeyForDisplay } from "../../lib/vault";
import { copyText } from "../../lib/clipboard";
import { api, changePassword } from "../../lib/api";
import { BUILD_VERSION, getAppVersion } from "../../lib/appVersion";
import { isTauri } from "@tauri-apps/api/core";
import "./SettingsModal.css";

type Tab =
  | "profile"
  | "appearance"
  | "notifications"
  | "security"
  | "desktop"
  | "updates";

const TABS: { id: Tab; label: string; icon: typeof UserIcon }[] = [
  { id: "profile", label: "Προφίλ", icon: UserIcon },
  { id: "appearance", label: "Εμφάνιση", icon: Palette },
  { id: "notifications", label: "Ειδοποιήσεις", icon: Bell },
  { id: "security", label: "Ασφάλεια", icon: Shield },
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "updates", label: "Updates", icon: RefreshCw },
];

const STATUSES: { id: UserStatus; label: string }[] = [
  { id: "online", label: "Online" },
  { id: "away", label: "Away" },
  { id: "busy", label: "Do not disturb" },
  { id: "offline", label: "Invisible" },
];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    users,
    currentUserId,
    settings,
    updateSettings,
    updateProfile,
    setStatus,
    toast,
    signOut,
    onlineMode,
  } = useStore();
  const me = users[currentUserId];
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio ?? "");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<string | null>(null);
  const [autostart, setAutostart] = useState(false);
  const [autostartReady, setAutostartReady] = useState(false);
  const [serverUrl, setServerUrl] = useState(loadServerUrl);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [cryptoStatus, setCryptoStatus] = useState<string>("…");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [appVersion, setAppVersion] = useState(BUILD_VERSION);
  const desktop = isTauri();

  useEffect(() => {
    void getAppVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    if (!desktop) return;
    void getAutostartEnabled().then((v) => {
      setAutostart(v);
      setAutostartReady(true);
    });
  }, [desktop]);

  useEffect(() => {
    if (tab !== "security") return;
    void getRecoveryKeyForDisplay().then(setRecovery);
    void api<{
      mode: string;
      vaultInitialized: boolean;
      membersWithVault: number;
    }>("/crypto/status")
      .then((s) => {
        setCryptoStatus(
          `${s.mode} · vault ${s.vaultInitialized ? "ενεργό" : "—"} · ${s.membersWithVault} συσκευές/μέλη`,
        );
      })
      .catch(() => setCryptoStatus("Δεν συνδέεται το crypto API"));
  }, [tab]);

  return (
    <Modal title="Ρυθμίσεις" onClose={onClose} width={720}>
      <div className="settings">
        <nav className="settings__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`settings__tab${tab === t.id ? " settings__tab--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="settings__content">
          {tab === "profile" ? (
            <div className="settings__section">
              <div className="settings__profile-head">
                <Avatar user={me} size={64} showStatus />
                <div>
                  <h3>{me.name}</h3>
                  <span>{me.role ?? "Member"}</span>
                </div>
              </div>

              <label className="settings__field">
                <span>Όνομα εμφάνισης</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => updateProfile({ name: name.trim() || me.name })}
                />
              </label>

              <label className="settings__field">
                <span>Bio</span>
                <textarea
                  value={bio}
                  rows={2}
                  onChange={(e) => setBio(e.target.value)}
                  onBlur={() => updateProfile({ bio })}
                />
              </label>

              <div className="settings__field">
                <span>Κατάσταση</span>
                <div className="settings__status-grid">
                  {STATUSES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`settings__status${
                        me.status === s.id ? " settings__status--active" : ""
                      }`}
                      onClick={() => setStatus(s.id)}
                    >
                      <span className={`settings__status-dot settings__status-dot--${s.id}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {onlineMode ? (
                <>
                  <label className="settings__field">
                    <span>Τρέχον password</span>
                    <input
                      type="password"
                      value={curPass}
                      onChange={(e) => setCurPass(e.target.value)}
                      autoComplete="current-password"
                    />
                  </label>
                  <label className="settings__field">
                    <span>Νέο password (min 8)</span>
                    <input
                      type="password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      autoComplete="new-password"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={passBusy || newPass.length < 8}
                    onClick={() => {
                      setPassBusy(true);
                      void changePassword(curPass, newPass)
                        .then(() => {
                          toast("Το password άλλαξε");
                          setCurPass("");
                          setNewPass("");
                        })
                        .catch((err) =>
                          toast(
                            err instanceof Error ? err.message : "Αποτυχία",
                          ),
                        )
                        .finally(() => setPassBusy(false));
                    }}
                  >
                    Αλλαγή password
                  </button>
                </>
              ) : null}

              <button
                type="button"
                className="btn btn--ghost"
                style={{ marginTop: 12, color: "var(--danger)" }}
                onClick={() => {
                  void signOut();
                }}
              >
                Αποσύνδεση
              </button>
            </div>
          ) : null}

          {tab === "appearance" ? (
            <div className="settings__section">
              <div className="settings__field">
                <span>Χρώμα accent</span>
                <div className="settings__accents">
                  {ACCENT_OPTIONS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`settings__accent${
                        settings.accent === a.value ? " settings__accent--active" : ""
                      }`}
                      style={{ background: a.value }}
                      onClick={() => updateSettings({ accent: a.value })}
                      aria-label={a.label}
                      title={a.label}
                    />
                  ))}
                </div>
              </div>
              <Toggle
                label="Compact mode"
                description="Πιο πυκνή διάταξη μηνυμάτων"
                checked={settings.compactMode}
                onChange={(v) => updateSettings({ compactMode: v })}
              />
            </div>
          ) : null}

          {tab === "notifications" ? (
            <div className="settings__section">
              <Toggle
                label="Ειδοποιήσεις"
                description="Desktop notifications για νέα μηνύματα."
                checked={settings.notifications}
                onChange={(v) => updateSettings({ notifications: v })}
              />
              <Toggle
                label="Read receipts"
                description="Δείξε στους φίλους σου ότι διάβασες τα μηνύματά τους."
                checked={settings.readReceipts}
                onChange={(v) => updateSettings({ readReceipts: v })}
              />
            </div>
          ) : null}

          {tab === "security" ? (
            <div className="settings__section">
              <p className="settings__hint">
                <strong>Zero-knowledge στο server σου:</strong> μηνύματα, φωτογραφίες και
                video κρυπτογραφούνται στον client (AES-256-GCM) πριν ανέβουν. Στη βάση
                υπάρχει μόνο ciphertext — ούτε το password σου ούτε το vault key σε
                καθαρή μορφή.
              </p>
              <p className="settings__hint">Κατάσταση: {cryptoStatus}</p>

              <Toggle
                label="Badges κρυπτογράφησης"
                description="Εικονίδιο κλειδαριάς δίπλα στα μηνύματα."
                checked={settings.showEncryptionBadges}
                onChange={(v) => updateSettings({ showEncryptionBadges: v })}
              />

              <div className="settings__field">
                <span>Recovery Key</span>
                {recovery ? (
                  <>
                    <code className="settings__recovery">{recovery}</code>
                    <button
                      type="button"
                      className="settings__status settings__status--active"
                      style={{ gap: 8, padding: "8px 14px", marginTop: 8 }}
                      onClick={() => {
                        void copyText(recovery).then((ok) =>
                          toast(ok ? "Αντιγράφηκε το Recovery Key" : "Αποτυχία"),
                        );
                      }}
                    >
                      <Copy size={14} />
                      Αντιγραφή
                    </button>
                  </>
                ) : (
                  <span className="settings__hint">
                    Δεν βρέθηκε τοπικό vault — κάνε login με Recovery Key.
                  </span>
                )}
              </div>

              <div className="settings__vpn">
                <h4>
                  <Network size={15} /> Ιδιωτικό δίκτυο (συνιστάται)
                </h4>
                <p>
                  Η καλύτερη «VPN» πρακτική για παρέα: μην ανοίγεις το API στο δημόσιο
                  internet. Βάλε τον server πίσω από{" "}
                  <strong>Tailscale</strong> ή <strong>WireGuard</strong> και βάλε στο
                  Server URL το Tailscale IP (π.χ.{" "}
                  <code>http://100.x.x.x:3001</code>).
                </p>
                <ol>
                  <li>Εγκατάσταση Tailscale στο PC του server και στα PCs των φίλων</li>
                  <li>Ίδιο Tailnet · χωρίς ανοιχτό port στο router</li>
                  <li>Aegis Server URL → Tailscale IP / MagicDNS</li>
                  <li>Κρυπτογράφηση chat + ιδιωτικό δίκτυο = διπλή προστασία</li>
                </ol>
                <a
                  href="https://tailscale.com/download"
                  target="_blank"
                  rel="noreferrer"
                >
                  Κατέβασμα Tailscale →
                </a>
              </div>
            </div>
          ) : null}

          {tab === "desktop" ? (
            <div className="settings__section">
              <label className="settings__field">
                <span>Server URL</span>
                <input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  onBlur={() => {
                    saveServerUrl(serverUrl);
                    toast("Αποθηκεύτηκε το Server URL");
                  }}
                  placeholder="http://192.168.1.235:3001"
                  autoComplete="url"
                />
                <span className="settings__hint">
                  Διεύθυνση API για login / chat. Στο desktop app βάλε το IP ή domain του
                  server σου.
                </span>
              </label>

              {desktop ? (
                <Toggle
                  label="Εκκίνηση με Windows"
                  description="Άνοιγμα του Aegis αυτόματα όταν μπαίνεις στα Windows."
                  checked={autostart}
                  onChange={(v) => {
                    setAutostart(v);
                    void setAutostartEnabled(v).then((ok) => {
                      if (!ok) {
                        setAutostart(!v);
                        toast("Αποτυχία αλλαγής autostart");
                        return;
                      }
                      toast(v ? "Autostart ενεργό" : "Autostart απενεργοποιήθηκε");
                    });
                  }}
                />
              ) : (
                <p className="settings__hint">
                  Το «Εκκίνηση με Windows» είναι διαθέσιμο μόνο στο εγκατεστημένο desktop
                  app.
                </p>
              )}

              {!autostartReady && desktop ? (
                <p className="settings__hint">Φόρτωση ρυθμίσεων desktop…</p>
              ) : null}
            </div>
          ) : null}

          {tab === "updates" ? (
            <div className="settings__section">
              <p className="settings__hint">
                Τρέχουσα έκδοση: <strong>v{appVersion}</strong>
              </p>
              <p className="settings__hint">
                Τα updates κατεβάζουν το Setup από τον LAN updater (
                <code>http://192.168.1.235:8080</code>) — όχι από GitHub Releases.
                Διαθέσιμο μόνο στο desktop app. Μην κατεβάζεις το .exe από GitHub
                (false positive Defender).
              </p>
              {updateInfo ? <p className="settings__hint">{updateInfo}</p> : null}
              <button
                type="button"
                className="settings__status settings__status--active"
                style={{ gap: 8, padding: "8px 14px" }}
                disabled={updateBusy || !desktop}
                onClick={() => {
                  setUpdateBusy(true);
                  void (async () => {
                    try {
                      const res = await checkForAppUpdate();
                      if (!res.available) {
                        setUpdateInfo(
                          `Είσαι στην τελευταία έκδοση (v${appVersion}).`,
                        );
                        toast("Δεν βρέθηκε νέο update");
                        return;
                      }
                      setUpdateInfo(`Διαθέσιμη έκδοση ${res.version} — εγκατάσταση…`);
                      const ok = await installAppUpdate();
                      toast(
                        ok
                          ? "Το update εγκαταστάθηκε — επανεκκίνηση…"
                          : "Αποτυχία εγκατάστασης",
                      );
                    } finally {
                      setUpdateBusy(false);
                    }
                  })();
                }}
              >
                <RefreshCw size={14} />
                {desktop ? "Έλεγχος για update" : "Μόνο στο desktop app"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
