import { useMemo, useState } from "react";
import {
  Search,
  Mic,
  MicOff,
  Headphones,
  Settings,
  MessageCircle,
  Lock,
  Circle,
} from "lucide-react";
import { useStore } from "../../store/store";
import { Avatar } from "../common/Avatar";
import { formatTime } from "../../lib/format";
import { decodeMessageBody } from "../../lib/messageBody";
import "./PersonalNav.css";

interface PersonalNavProps {
  onOpenSettings: () => void;
  onOpenProfile: (e: React.MouseEvent) => void;
}

const statusText: Record<string, string> = {
  online: "ONLINE",
  away: "ΛΕΙΠΩ",
  busy: "ΜΗΝ ΕΝΟΧΛΕΙΤΕ",
  offline: "OFFLINE",
};

export function PersonalNav({ onOpenSettings, onOpenProfile }: PersonalNavProps) {
  const {
    activeView,
    users,
    currentUserId,
    memberIds,
    dms,
    dmMessages,
    unread,
    voice,
    openDM,
    toggleMute,
    toggleDeafen,
  } = useStore();
  const me = users[currentUserId];
  const [query, setQuery] = useState("");

  const threads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dms
      .map((dm) => {
        const user = users[dm.userId];
        const msgs = dmMessages[dm.id] ?? [];
        const last = msgs[msgs.length - 1];
        const preview = last
          ? decodeMessageBody(last.content).files?.length
            ? `📎 ${decodeMessageBody(last.content).files![0].name}`
            : decodeMessageBody(last.content).text
          : null;
        return { dm, user, last, preview };
      })
      .filter((t) => t.user)
      .filter(
        (t) =>
          !q ||
          t.user!.name.toLowerCase().includes(q) ||
          (t.preview ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (b.last?.timestamp ?? 0) - (a.last?.timestamp ?? 0));
  }, [dms, dmMessages, users, query]);

  const { onlineFriends, otherFriends } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = memberIds
      .filter((id) => id !== currentUserId)
      .map((id) => users[id])
      .filter(Boolean)
      .filter((u) => !q || u.name.toLowerCase().includes(q));
    const online = list
      .filter((u) => u.status === "online")
      .sort((a, b) => a.name.localeCompare(b.name));
    const other = list
      .filter((u) => u.status !== "online")
      .sort((a, b) => {
        const rank = (s: string) =>
          s === "away" ? 0 : s === "busy" ? 1 : 2;
        return rank(a.status) - rank(b.status) || a.name.localeCompare(b.name);
      });
    return { onlineFriends: online, otherFriends: other };
  }, [memberIds, currentUserId, users, query]);

  if (!me) return null;

  return (
    <aside className="pnav">
      <header className="pnav__head">
        <div className="pnav__title-row">
          <MessageCircle size={16} />
          <strong>Personal Chat</strong>
        </div>
        <span className="pnav__sub">
          <Lock size={11} /> full AES-256 · media lossless
        </span>
        <label className="pnav__search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση φίλου ή συνομιλίας…"
          />
        </label>
      </header>

      <div className="pnav__scroll">
        <section className="pnav__section">
          <h3 className="pnav__label pnav__label--online">
            <Circle size={8} fill="currentColor" />
            Online Friends
            <em>{onlineFriends.length}</em>
          </h3>
          {onlineFriends.length === 0 ? (
            <p className="pnav__empty">Κανείς online αυτή τη στιγμή.</p>
          ) : (
            <ul className="pnav__list pnav__list--online">
              {onlineFriends.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="pnav__row pnav__row--online"
                    onClick={() => openDM(f.id)}
                  >
                    <Avatar user={f} size={34} showStatus />
                    <span className="pnav__row-body">
                      <span className="pnav__name">{f.name}</span>
                      <span className="pnav__preview pnav__preview--live">
                        Διαθέσιμος · πάτα για chat
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pnav__section">
          <h3 className="pnav__label">Συνομιλίες</h3>
          {threads.length === 0 ? (
            <p className="pnav__empty">Δεν έχεις ακόμα personal chats.</p>
          ) : (
            <ul className="pnav__list">
              {threads.map(({ dm, user, last, preview }) => {
                if (!user) return null;
                const active =
                  activeView.type === "dm" && activeView.id === dm.id;
                const count = unread[dm.id] ?? 0;
                return (
                  <li key={dm.id}>
                    <button
                      type="button"
                      className={`pnav__row${active ? " pnav__row--active" : ""}`}
                      onClick={() => openDM(user.id)}
                    >
                      <Avatar user={user} size={36} showStatus />
                      <span className="pnav__row-body">
                        <span className="pnav__row-top">
                          <span className="pnav__name">{user.name}</span>
                          {last ? (
                            <time>{formatTime(last.timestamp)}</time>
                          ) : null}
                        </span>
                        <span className="pnav__preview">
                          {preview || "Ξεκίνα τη συνομιλία…"}
                        </span>
                      </span>
                      {count ? <span className="pnav__badge">{count}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {otherFriends.length > 0 ? (
          <section className="pnav__section">
            <h3 className="pnav__label">Offline / Away</h3>
            <ul className="pnav__list">
              {otherFriends.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="pnav__row pnav__row--friend"
                    onClick={() => openDM(f.id)}
                  >
                    <Avatar user={f} size={32} showStatus />
                    <span className="pnav__row-body">
                      <span className="pnav__name">{f.name}</span>
                      <span className="pnav__preview pnav__preview--status">
                        {statusText[f.status] ?? f.status}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="pnav__user">
        <button type="button" className="pnav__user-main" onClick={onOpenProfile}>
          <Avatar user={me} size={30} showStatus />
          <div className="pnav__user-info">
            <span className="pnav__user-name">{me.name}</span>
            <span className="pnav__user-status">{statusText[me.status]}</span>
          </div>
        </button>
        <div className="pnav__ctrls">
          <button
            type="button"
            aria-label="Mic"
            className={voice.muted ? "pnav__ctrl--off" : ""}
            onClick={toggleMute}
          >
            {voice.muted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <button
            type="button"
            aria-label="Deafen"
            className={voice.deafened ? "pnav__ctrl--off" : ""}
            onClick={toggleDeafen}
          >
            <Headphones size={14} />
          </button>
          <button type="button" aria-label="Settings" onClick={onOpenSettings}>
            <Settings size={14} />
          </button>
        </div>
      </footer>
    </aside>
  );
}
