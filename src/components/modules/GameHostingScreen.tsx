import { useEffect, useRef, useState } from "react";
import {
  Server,
  Play,
  Square,
  Plus,
  Cpu,
  MemoryStick,
  MapPin,
  Users,
  Trash2,
} from "lucide-react";
import { gameServers, gameCatalog, type GameServer } from "../../data/modules";
import { useStore } from "../../store/store";
import { usePersisted } from "../../lib/persist";
import { SoonBanner } from "./SoonBanner";
import "./module.css";
import "./GameHostingScreen.css";

const statusText: Record<GameServer["status"], string> = {
  online: "Online",
  offline: "Offline",
  starting: "Εκκίνηση…",
};

const NODES = ["xeon-2699v4", "xeon-2697v3", "xeon-2667v3", "epyc-7402p"];

export function GameHostingScreen() {
  const { toast } = useStore();
  const [servers, setServers] = usePersisted<GameServer[]>("game-servers", gameServers);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const startTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Servers with status "starting" go online after a short boot phase.
  useEffect(() => {
    for (const s of servers) {
      if (s.status === "starting" && !startTimers.current[s.id]) {
        startTimers.current[s.id] = setTimeout(() => {
          delete startTimers.current[s.id];
          setServers((prev) =>
            prev.map((p) =>
              p.id === s.id && p.status === "starting"
                ? {
                    ...p,
                    status: "online",
                    cpu: 25 + Math.floor(Math.random() * 20),
                    ram: 35 + Math.floor(Math.random() * 20),
                    players: Math.min(p.maxPlayers, Math.floor(Math.random() * 4)),
                  }
                : p,
            ),
          );
          toast(`Ο server ${s.game} είναι online 🟢`);
        }, 3500);
      }
    }
  }, [servers, setServers, toast]);

  useEffect(() => {
    const timers = startTimers.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  // Demo only — no fake live telemetry (would look like a real host).
  // CPU/RAM/players update only when the user starts/stops a mock server.

  const toggle = (id: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.status === "online" || s.status === "starting") {
          toast(`Ο server ${s.game} σταμάτησε`);
          return { ...s, status: "offline", players: 0, cpu: 0, ram: 0 };
        }
        return { ...s, status: "starting", cpu: 12, ram: 20 };
      }),
    );
  };

  const deploy = (name: string, icon: string) => {
    const id = `srv-${Date.now()}`;
    setServers((prev) => [
      ...prev,
      {
        id,
        game: name,
        status: "starting",
        players: 0,
        maxPlayers: 10 + Math.floor(Math.random() * 4) * 10,
        region: "EU-Athens",
        node: NODES[Math.floor(Math.random() * NODES.length)],
        cpu: 10,
        ram: 18,
        icon,
      },
    ]);
    toast(`Γίνεται deploy: ${name}…`);
  };

  const remove = (id: string) => {
    const target = servers.find((s) => s.id === id);
    setServers((prev) => prev.filter((s) => s.id !== id));
    setConfirmDelete(null);
    if (target) toast(`Ο server ${target.game} διαγράφηκε`);
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
          {onlineCount} servers online · rack: 4 nodes
        </span>
        <div className="module__header-actions">
          <button
            className="btn btn--primary btn--sm"
            onClick={() => deploy("Custom Server", "🎮")}
          >
            <Plus size={15} />
            Νέος server
          </button>
        </div>
      </header>

      <div className="module__body">
        <SoonBanner feature="Game Hosting" />
        <div className="module__section-title">Οι servers σου</div>
        {servers.length === 0 ? (
          <p className="module__empty">
            Δεν έχεις servers ακόμα — κάνε deploy από τον κατάλογο.
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
                    <span className={`dot dot--${s.status}`} />
                    {statusText[s.status]}
                  </span>
                </div>
                <button
                  className="game-card__trash"
                  onClick={() =>
                    confirmDelete === s.id ? remove(s.id) : setConfirmDelete(s.id)
                  }
                  onBlur={() => setConfirmDelete(null)}
                  title={confirmDelete === s.id ? "Σίγουρα; Πάτα ξανά" : "Διαγραφή"}
                >
                  <Trash2 size={14} />
                  {confirmDelete === s.id ? <span>Σίγουρα;</span> : null}
                </button>
                <button
                  className={`game-card__power${s.status === "online" ? " game-card__power--on" : ""}`}
                  onClick={() => toggle(s.id)}
                  title={s.status === "offline" ? "Start" : "Stop"}
                >
                  {s.status === "offline" ? <Play size={15} /> : <Square size={15} />}
                </button>
              </div>

              <div className="game-card__meta">
                <span className="chip"><Users size={12} /> {s.players}/{s.maxPlayers}</span>
                <span className="chip"><MapPin size={12} /> {s.region}</span>
                <span className="chip">{s.node}</span>
              </div>

              <div className="game-card__resources">
                <div className="game-card__res">
                  <span className="game-card__res-label"><Cpu size={12} /> CPU</span>
                  <div className="meter"><div className="meter__fill" style={{ width: `${s.cpu}%` }} /></div>
                  <span className="game-card__res-val">{s.cpu}%</span>
                </div>
                <div className="game-card__res">
                  <span className="game-card__res-label"><MemoryStick size={12} /> RAM</span>
                  <div className="meter"><div className="meter__fill" style={{ width: `${s.ram}%` }} /></div>
                  <span className="game-card__res-val">{s.ram}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="module__section-title">Δημιούργησε νέο server</div>
        <div className="grid grid--tools">
          {gameCatalog.map((g) => (
            <button
              key={g.id}
              className="card card--hover game-new"
              onClick={() => deploy(g.name, g.icon)}
            >
              <span className="game-new__icon">{g.icon}</span>
              <span className="game-new__name">{g.name}</span>
              <span className="game-new__cta"><Plus size={13} /> Deploy</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
