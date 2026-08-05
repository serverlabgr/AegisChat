import { useCallback, useEffect, useState } from "react";
import {
  Server,
  Play,
  Square,
  Plus,
  MapPin,
  Users,
  Trash2,
  Settings,
  Link2,
} from "lucide-react";
import { gameCatalog, type GameServer } from "../../data/modules";
import { useStore } from "../../store/store";
import { api } from "../../lib/api";
import { realtime } from "../../lib/realtime";
import { Modal } from "../common/Modal";
import { copyText } from "../../lib/clipboard";
import "./module.css";
import "./GameHostingScreen.css";

type Session = GameServer & {
  templateId?: string;
  notes?: string;
  pterodactylIdentifier?: string;
  joinAddress?: string;
};

const statusText: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  starting: "Εκκίνηση…",
  stopping: "Σταμάτημα…",
};

function mapApi(s: {
  id: string;
  game: string;
  status: Session["status"];
  players: number;
  maxPlayers: number;
  region: string;
  icon: string;
  templateId?: string;
  notes?: string;
  pterodactylIdentifier?: string;
  joinAddress?: string;
}): Session {
  return {
    id: s.id,
    game: s.game,
    status: s.status,
    players: s.players,
    maxPlayers: s.maxPlayers,
    region: s.region,
    node: "session",
    cpu: 0,
    ram: 0,
    icon: s.icon,
    templateId: s.templateId,
    notes: s.notes,
    pterodactylIdentifier: s.pterodactylIdentifier,
    joinAddress: s.joinAddress,
  };
}

export function GameHostingScreen() {
  const { toast, onlineMode } = useStore();
  const [servers, setServers] = useState<Session[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pteroConfigured, setPteroConfigured] = useState(false);
  const [pteroPanelUrl, setPteroPanelUrl] = useState<string | null>(null);
  const [settingsSession, setSettingsSession] = useState<Session | null>(null);
  const [deployTemplate, setDeployTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deployForm, setDeployForm] = useState({
    name: "",
    notes: "",
    pterodactylIdentifier: "",
    joinAddress: "",
  });

  const refresh = useCallback(async () => {
    if (!onlineMode) return;
    setLoading(true);
    try {
      const [{ sessions }, cfg] = await Promise.all([
        api<{ sessions: Parameters<typeof mapApi>[0][] }>("/games/sessions"),
        api<{ pterodactylConfigured: boolean; pterodactylPanelUrl: string | null }>(
          "/games/config",
        ),
      ]);
      setServers(sessions.map(mapApi));
      setPteroConfigured(cfg.pterodactylConfigured);
      setPteroPanelUrl(cfg.pterodactylPanelUrl);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία φόρτωσης sessions");
    } finally {
      setLoading(false);
    }
  }, [onlineMode, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!onlineMode) return;
    const t = setInterval(() => void refresh(), 12_000);
    void realtime;
    return () => clearInterval(t);
  }, [onlineMode, refresh]);

  const toggle = async (id: string) => {
    const s = servers.find((x) => x.id === id);
    if (!s) return;
    if (!onlineMode) {
      toast("Χρειάζεται online server");
      return;
    }
    const nextStatus =
      s.status === "online" || s.status === "starting" ? "offline" : "online";
    try {
      const { session } = await api<{ session: Parameters<typeof mapApi>[0] }>(
        `/games/sessions/${id}`,
        {
          method: "PATCH",
          body: {
            status: nextStatus,
            players: nextStatus === "offline" ? 0 : s.players,
          },
        },
      );
      setServers((prev) =>
        prev.map((p) => (p.id === id ? mapApi(session) : p)),
      );
      toast(
        nextStatus === "online"
          ? `Το session ${s.game} ξεκίνησε${pteroConfigured && s.pterodactylIdentifier ? " (Pterodactyl)" : ""}`
          : `Το session ${s.game} σταμάτησε`,
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία");
    }
  };

  const deploy = async () => {
    if (!deployTemplate) return;
    if (!onlineMode) {
      toast("Χρειάζεται online server");
      return;
    }
    try {
      const { session } = await api<{ session: Parameters<typeof mapApi>[0] }>(
        "/games/sessions",
        {
          method: "POST",
          body: {
            templateId: deployTemplate.id,
            name: deployForm.name.trim() || deployTemplate.name,
            notes: deployForm.notes.trim(),
            pterodactylIdentifier: deployForm.pterodactylIdentifier.trim(),
            joinAddress: deployForm.joinAddress.trim(),
          },
        },
      );
      setServers((prev) => [mapApi(session), ...prev]);
      setDeployTemplate(null);
      setDeployForm({
        name: "",
        notes: "",
        pterodactylIdentifier: "",
        joinAddress: "",
      });
      toast(`Δημιουργήθηκε session: ${session.game}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία deploy");
    }
  };

  const saveSettings = async () => {
    if (!settingsSession) return;
    try {
      const { session } = await api<{ session: Parameters<typeof mapApi>[0] }>(
        `/games/sessions/${settingsSession.id}`,
        {
          method: "PATCH",
          body: {
            name: settingsSession.game,
            notes: settingsSession.notes ?? "",
            pterodactylIdentifier: settingsSession.pterodactylIdentifier ?? "",
            joinAddress: settingsSession.joinAddress ?? "",
          },
        },
      );
      setServers((prev) =>
        prev.map((p) => (p.id === session.id ? mapApi(session) : p)),
      );
      setSettingsSession(null);
      toast("Οι ρυθμίσεις αποθηκεύτηκαν");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία");
    }
  };

  const remove = async (id: string) => {
    const target = servers.find((s) => s.id === id);
    setConfirmDelete(null);
    if (settingsSession?.id === id) setSettingsSession(null);
    if (!onlineMode) {
      setServers((prev) => prev.filter((s) => s.id !== id));
      return;
    }
    try {
      await api(`/games/sessions/${id}`, { method: "DELETE" });
      setServers((prev) => prev.filter((s) => s.id !== id));
      if (target) toast(`Διαγράφηκε: ${target.game}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία διαγραφής");
    }
  };

  const onlineCount = servers.filter((s) => s.status === "online").length;

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Server size={18} />
        </span>
        <span className="module__title">Game Hosting</span>
        <span className="module__sub">
          {onlineCount} sessions online
          {loading ? " · φόρτωση…" : ""}
          {pteroConfigured ? " · Pterodactyl ✓" : ""}
        </span>
      </header>

      <div className="module__body">
        <p className="module__empty" style={{ marginBottom: 12 }}>
          Sessions για την παρέα — start/stop μέσω Pterodactyl αν έχεις
          ρυθμίσει <code>PTERODACTYL_URL</code> +{" "}
          <code>PTERODACTYL_CLIENT_KEY</code> στο server.
          {!pteroConfigured ? (
            <>
              {" "}
              Προς το παρόν μόνο κατάσταση/σημειώσεις (χωρίς panel).
            </>
          ) : pteroPanelUrl ? (
            <>
              {" "}
              Panel:{" "}
              <a href={pteroPanelUrl} target="_blank" rel="noreferrer">
                {pteroPanelUrl}
              </a>
            </>
          ) : null}
        </p>
        <div className="module__section-title">Sessions</div>
        {servers.length === 0 ? (
          <p className="module__empty">
            Δεν έχεις sessions ακόμα — διάλεξε template από τον κατάλογο.
          </p>
        ) : null}
        <div className="grid grid--cards">
          {servers.map((s) => (
            <div key={s.id} className="card game-card">
              <div className="game-card__top">
                <span className="game-card__icon">{s.icon}</span>
                <div className="game-card__title">
                  <span className="game-card__name">{s.game}</span>
                  <span className="game-card__status">
                    <span
                      className={`dot dot--${s.status === "starting" ? "starting" : s.status}`}
                    />
                    {statusText[s.status] ?? s.status}
                  </span>
                </div>
                <button
                  className="game-card__settings"
                  onClick={() => setSettingsSession({ ...s })}
                  title="Ρυθμίσεις"
                >
                  <Settings size={14} />
                </button>
                <button
                  className="game-card__trash"
                  onClick={() =>
                    confirmDelete === s.id
                      ? void remove(s.id)
                      : setConfirmDelete(s.id)
                  }
                  onBlur={() => setConfirmDelete(null)}
                  title={confirmDelete === s.id ? "Σίγουρα; Πάτα ξανά" : "Διαγραφή"}
                >
                  <Trash2 size={14} />
                  {confirmDelete === s.id ? <span>Σίγουρα;</span> : null}
                </button>
                <button
                  className={`game-card__power${s.status === "online" ? " game-card__power--on" : ""}`}
                  onClick={() => void toggle(s.id)}
                  title={s.status === "offline" ? "Start" : "Stop"}
                >
                  {s.status === "offline" ? (
                    <Play size={15} />
                  ) : (
                    <Square size={15} />
                  )}
                </button>
              </div>

              <div className="game-card__meta">
                <span className="chip">
                  <Users size={12} /> {s.players}/{s.maxPlayers}
                </span>
                <span className="chip">
                  <MapPin size={12} /> {s.region}
                </span>
                {s.joinAddress ? (
                  <button
                    type="button"
                    className="chip chip--link"
                    onClick={() => void copyText(s.joinAddress!)}
                    title="Αντιγραφή join address"
                  >
                    <Link2 size={12} /> {s.joinAddress}
                  </button>
                ) : null}
                {s.pterodactylIdentifier ? (
                  <span className="chip">ptero:{s.pterodactylIdentifier}</span>
                ) : null}
              </div>
              {s.notes ? (
                <p className="game-card__notes">{s.notes}</p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="module__section-title">Templates</div>
        <div className="grid grid--tools">
          {gameCatalog.map((g) => (
            <button
              key={g.id}
              className="card card--hover game-new"
              onClick={() => {
                setDeployTemplate({ id: g.id, name: g.name });
                setDeployForm({
                  name: g.name,
                  notes: "",
                  pterodactylIdentifier: "",
                  joinAddress: "",
                });
              }}
            >
              <span className="game-new__icon">{g.icon}</span>
              <span className="game-new__name">{g.name}</span>
              <span className="game-new__cta">
                <Plus size={13} /> Deploy
              </span>
            </button>
          ))}
        </div>
      </div>

      {deployTemplate ? (
        <Modal
          title="Νέο game session"
          subtitle={deployTemplate.name}
          onClose={() => setDeployTemplate(null)}
          width={440}
        >
          <div className="game-form">
            <label className="game-form__field">
              <span>Όνομα</span>
              <input
                value={deployForm.name}
                onChange={(e) =>
                  setDeployForm({ ...deployForm, name: e.target.value })
                }
                maxLength={80}
              />
            </label>
            <label className="game-form__field">
              <span>Σημειώσεις</span>
              <input
                value={deployForm.notes}
                onChange={(e) =>
                  setDeployForm({ ...deployForm, notes: e.target.value })
                }
                placeholder="Modpack, password, κλπ."
                maxLength={500}
              />
            </label>
            <label className="game-form__field">
              <span>Pterodactyl server ID</span>
              <input
                value={deployForm.pterodactylIdentifier}
                onChange={(e) =>
                  setDeployForm({
                    ...deployForm,
                    pterodactylIdentifier: e.target.value,
                  })
                }
                placeholder="uuid από το panel"
                maxLength={128}
              />
            </label>
            <label className="game-form__field">
              <span>Join address (IP:port)</span>
              <input
                value={deployForm.joinAddress}
                onChange={(e) =>
                  setDeployForm({ ...deployForm, joinAddress: e.target.value })
                }
                placeholder="192.168.1.10:25565"
                maxLength={256}
              />
            </label>
            <div className="game-form__actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setDeployTemplate(null)}
              >
                Άκυρο
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => void deploy()}
              >
                Δημιουργία
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {settingsSession ? (
        <Modal
          title="Ρυθμίσεις session"
          subtitle={settingsSession.game}
          onClose={() => setSettingsSession(null)}
          width={440}
        >
          <div className="game-form">
            <label className="game-form__field">
              <span>Όνομα</span>
              <input
                value={settingsSession.game}
                onChange={(e) =>
                  setSettingsSession({
                    ...settingsSession,
                    game: e.target.value,
                  })
                }
                maxLength={80}
              />
            </label>
            <label className="game-form__field">
              <span>Σημειώσεις</span>
              <textarea
                value={settingsSession.notes ?? ""}
                onChange={(e) =>
                  setSettingsSession({
                    ...settingsSession,
                    notes: e.target.value,
                  })
                }
                rows={3}
                maxLength={500}
              />
            </label>
            <label className="game-form__field">
              <span>Pterodactyl server ID</span>
              <input
                value={settingsSession.pterodactylIdentifier ?? ""}
                onChange={(e) =>
                  setSettingsSession({
                    ...settingsSession,
                    pterodactylIdentifier: e.target.value,
                  })
                }
                placeholder="uuid από το panel"
                maxLength={128}
              />
            </label>
            <label className="game-form__field">
              <span>Join address</span>
              <input
                value={settingsSession.joinAddress ?? ""}
                onChange={(e) =>
                  setSettingsSession({
                    ...settingsSession,
                    joinAddress: e.target.value,
                  })
                }
                placeholder="IP:port για copy-paste"
                maxLength={256}
              />
            </label>
            <div className="game-form__actions">
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => void remove(settingsSession.id)}
              >
                <Trash2 size={14} /> Διαγραφή
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setSettingsSession(null)}
              >
                Άκυρο
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => void saveSettings()}
              >
                Αποθήκευση
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
