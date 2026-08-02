import {
  MessageSquare,
  MessagesSquare,
  Users,
  Radio,
  Server,
  Code2,
  Wrench,
  Settings,
} from "lucide-react";
import type { AppModule } from "../../store/store";
import { useStore } from "../../store/store";
import { HOME_SERVER_ID, PERSONAL_SPACE_ID } from "../../data/modules";
import { Avatar } from "../common/Avatar";
import "./LauncherRail.css";

interface LauncherRailProps {
  onOpenSettings: () => void;
  onOpenProfile: (e: React.MouseEvent) => void;
}

const MODULES: {
  id: AppModule;
  label: string;
  icon: typeof Users;
  soon?: boolean;
}[] = [
  { id: "chat", label: "Παρέα", icon: MessageSquare },
  { id: "personal", label: "Personal", icon: MessagesSquare },
  { id: "friends", label: "Φίλοι", icon: Users },
  { id: "radio", label: "Radio", icon: Radio },
  { id: "games", label: "Game Hosting", icon: Server },
  { id: "devportal", label: "Dev Portal", icon: Code2 },
  { id: "toolbox", label: "Toolbox", icon: Wrench },
];

export function LauncherRail({ onOpenSettings, onOpenProfile }: LauncherRailProps) {
  const {
    activeModule,
    setActiveModule,
    setActiveGroup,
    users,
    currentUserId,
    unread,
    dms,
  } = useStore();
  const me = users[currentUserId];
  const unreadTotal = Object.values(unread).reduce((a, b) => a + b, 0);
  const dmUnread = dms.reduce((n, d) => n + (unread[d.id] ?? 0), 0);
  if (!me) return null;

  return (
    <nav className="rail">
      <div className="rail__modules">
        {MODULES.map((m) => {
          const active = activeModule === m.id;
          return (
            <button
              key={m.id}
              type="button"
              className={`rail__item${active ? " rail__item--active" : ""}`}
              onClick={() => {
                if (m.id === "personal") {
                  setActiveGroup(PERSONAL_SPACE_ID);
                  return;
                }
                if (m.id === "chat") {
                  setActiveGroup(HOME_SERVER_ID);
                  return;
                }
                setActiveModule(m.id);
              }}
              title={m.soon ? `${m.label} · Σύντομα` : m.label}
            >
              <span className="rail__pill" />
              <span className="rail__icon">
                <m.icon size={20} />
                {m.soon ? <span className="rail__soon">Σύντομα</span> : null}
                {m.id === "chat" && unreadTotal - dmUnread > 0 ? (
                  <span className="rail__badge">{unreadTotal - dmUnread}</span>
                ) : null}
                {m.id === "personal" && dmUnread > 0 ? (
                  <span className="rail__badge">{dmUnread}</span>
                ) : null}
              </span>
              <span className="rail__tip">
                {m.label}
                {m.soon ? " · Σύντομα" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rail__footer">
        <button type="button" className="rail__ghost" onClick={onOpenSettings} title="Ρυθμίσεις">
          <Settings size={19} />
        </button>
        <button type="button" className="rail__avatar" onClick={onOpenProfile} title={me.name}>
          <Avatar user={me} size={38} showStatus />
        </button>
      </div>
    </nav>
  );
}
