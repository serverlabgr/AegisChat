import { useCallback, useEffect, useState } from "react";
import { Server, Play, Square, Plus, MapPin, Users, Trash2 } from "lucide-react";
import { gameCatalog, type GameServer } from "../../data/modules";
import { useStore } from "../../store/store";
import { api } from "../../lib/api";
import { realtime } from "../../lib/realtime";
import "./module.css";
import "./GameHostingScreen.css";

type Session = GameServer & { templateId?: string; notes?: string };

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
  };
}

export function GameHostingScreen() {
  const { toast, onlineMode } = useStore();
  const [servers, setServers] = useState<Session[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!onlineMode) return;
    setLoading(true);
    try {
      const { sessions } = await api<{ sessions: Parameters<typeof mapApi>[0][] }>(
        "/games/sessions",
      );
      setServers(sessions.map(mapApi));
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
    const handlers = {
      onGameSession: (
        session: unknown,
        action: "created" | "updated" | "deleted",
      ) => {
        const s = mapApi(session as Parameters<typeof mapApi>[0]);
        setServers((prev) => {
          if (action === "deleted") return prev.filter((x) => x.id !== s.id);
          const idx = prev.findIndex((x) => x.id === s.id);
          if (idx < 0) return [s, ...prev];
          const next = [...prev];
          next[idx] = s;
          return next;
        });
      },
    };
    // Merge with existing realtime handlers carefully: store owns setHandlers.
    // Poll as fallback.
    const t = setInterval(() => void refresh(), 12_000);
    void handlers;
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
        { method: "PATCH", body: { status: nextStatus, players: nextStatus === "offline" ? 0 : s.players } },
      );
      setServers((prev) =>
        prev.map((p) => (p.id === id ? mapApi(session) : p)),
      );
      toast(
        nextStatus === "online"
          ? `Το session ${s.game} είναι online`
          : `Το session ${s.game} σταμάτησε`,
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία");
    }
  };

  const deploy = async (templateId: string, name: string) => {
    if (!onlineMode) {
      toast("Χρειάζεται online server");
      return;
    }
    try {
      const { session } = await api<{ session: Parameters<typeof mapApi>[0] }>(
        "/games/sessions",
        { method: "POST", body: { templateId, name } },
      );
      setServers((prev) => [mapApi(session), ...prev]);
      toast(`Δημιουργήθηκε session: ${name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία deploy");
    }
  };

  const remove = async (id: string) => {
    const target = servers.find((s) => s.id === id);
    setConfirmDelete(null);
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
        </span>
      </header>

      <div className="module__body">
        <p className="module__empty" style={{ marginBottom: 12 }}>
          Sessions για την παρέα (κατάσταση στο server). Δεν υπάρχει fake CPU/RAM —
          για πραγματικό Minecraft container δες <code>deploy/docker-compose.games.yml</code>.
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
                    <span className={`dot dot--${s.status === "starting" ? "starting" : s.status}`} />
                    {statusText[s.status] ?? s.status}
                  </span>
                </div>
                <button
                  className="game-card__trash"
                  onClick={() =>
                    confirmDelete === s.id ? void remove(s.id) : setConfirmDelete(s.id)
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
                  {s.status === "offline" ? <Play size={15} /> : <Square size={15} />}
                </button>
              </div>

              <div className="game-card__meta">
                <span className="chip">
                  <Users size={12} /> {s.players}/{s.maxPlayers}
                </span>
                <span className="chip">
                  <MapPin size={12} /> {s.region}
                </span>
                {s.templateId ? <span className="chip">{s.templateId}</span> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="module__section-title">Templates</div>
        <div className="grid grid--tools">
          {gameCatalog.map((g) => (
            <button
              key={g.id}
              className="card card--hover game-new"
              onClick={() => void deploy(g.id, g.name)}
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
    </div>
  );
}
