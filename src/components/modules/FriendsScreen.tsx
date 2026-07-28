import { useState } from "react";
import {
  Users,
  MessageSquare,
  Gamepad2,
  UserPlus,
  Check,
  X,
  Link2,
  Copy,
  Search,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "../../store/store";
import { nowPlaying } from "../../data/modules";
import { copyText } from "../../lib/clipboard";
import { Avatar } from "../common/Avatar";
import "./module.css";
import "./FriendsScreen.css";

type Tab = "friends" | "invites" | "groups";

interface FriendsScreenProps {
  onSelectMember: (userId: string, e: React.MouseEvent) => void;
}

export function FriendsScreen({ onSelectMember }: FriendsScreenProps) {
  const {
    users,
    currentUserId,
    memberIds,
    requests,
    invites,
    groups,
    openDM,
    toast,
    sendFriendRequest,
    acceptRequest,
    declineRequest,
    createInvite,
    createGroup,
    inviteToGame,
    setActiveGroup,
  } = useStore();
  const [tab, setTab] = useState<Tab>("friends");
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);

  const friends = memberIds
    .filter((id) => id !== currentUserId)
    .map((id) => users[id])
    .filter((u) => u && u.name.toLowerCase().includes(query.toLowerCase()));

  const online = friends.filter((f) => f.status !== "offline");
  const offline = friends.filter((f) => f.status === "offline");

  const submitAdd = () => {
    if (!addName.trim()) return;
    sendFriendRequest(addName);
    setAddName("");
    setAddOpen(false);
    setTab("invites");
  };

  const submitGroup = () => {
    if (!groupName.trim()) return;
    createGroup(groupName);
    setGroupName("");
    setGroupOpen(false);
  };

  const copyInvite = async (code: string) => {
    const ok = await copyText(code);
    toast(ok ? "Το invite code αντιγράφηκε" : "Δεν ήταν δυνατή η αντιγραφή");
  };

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Users size={18} />
        </span>
        <span className="module__title">Φίλοι</span>
        <span className="module__sub">η παρέα σου, σε ένα μέρος</span>
        <div className="module__header-actions">
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setAddOpen((v) => !v)}
          >
            <UserPlus size={15} />
            Πρόσθεσε φίλο
          </button>
        </div>
      </header>

      {addOpen ? (
        <div className="module__inline-form">
          <input
            autoFocus
            placeholder="Username φίλου, π.χ. maria"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") setAddOpen(false);
            }}
          />
          <button className="btn btn--primary btn--sm" onClick={submitAdd} disabled={!addName.trim()}>
            Στείλε αίτημα
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setAddOpen(false)}>
            Άκυρο
          </button>
        </div>
      ) : null}

      <div className="module__tabs">
        <button
          className={`module__tab${tab === "friends" ? " module__tab--active" : ""}`}
          onClick={() => setTab("friends")}
        >
          <Users size={15} />
          Λίστα
          <span className="module__tab-count">{online.length}</span>
        </button>
        <button
          className={`module__tab${tab === "invites" ? " module__tab--active" : ""}`}
          onClick={() => setTab("invites")}
        >
          <Link2 size={15} />
          Προσκλήσεις
          <span className="module__tab-count">{requests.length}</span>
        </button>
        <button
          className={`module__tab${tab === "groups" ? " module__tab--active" : ""}`}
          onClick={() => setTab("groups")}
        >
          <Gamepad2 size={15} />
          Groups
          <span className="module__tab-count">{groups.length}</span>
        </button>
      </div>

      <div className="module__body">
        {tab === "friends" ? (
          <>
            <div className="friends__search">
              <Search size={15} />
              <input
                placeholder="Ψάξε φίλο…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="module__section-title">Online — {online.length}</div>
            <div className="grid grid--cards">
              {online.map((f) => (
                <div key={f.id} className="card card--hover friend-card">
                  <button
                    className="friend-card__main"
                    onClick={(e) => onSelectMember(f.id, e)}
                  >
                    <Avatar user={f} size={44} showStatus />
                    <div className="friend-card__info">
                      <span className="friend-card__name" style={{ color: f.color }}>
                        {f.name}
                      </span>
                      {nowPlaying[f.id] ? (
                        <span className="friend-card__playing">
                          <Gamepad2 size={12} />
                          {nowPlaying[f.id]}
                        </span>
                      ) : (
                        <span className="friend-card__status">
                          {f.status === "away"
                            ? "λείπει"
                            : f.status === "busy"
                              ? "μην ενοχλείτε"
                              : "διαθέσιμος"}
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="friend-card__actions">
                    <button title="Μήνυμα" onClick={() => openDM(f.id)}>
                      <MessageSquare size={16} />
                    </button>
                    <button title="Κάλεσε σε παιχνίδι" onClick={() => inviteToGame(f.id)}>
                      <Gamepad2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {offline.length > 0 ? (
              <>
                <div className="module__section-title">Offline — {offline.length}</div>
                <div className="grid grid--cards">
                  {offline.map((f) => (
                    <div key={f.id} className="card friend-card friend-card--dim">
                      <button
                        className="friend-card__main"
                        onClick={(e) => onSelectMember(f.id, e)}
                      >
                        <Avatar user={f} size={44} showStatus />
                        <div className="friend-card__info">
                          <span className="friend-card__name">{f.name}</span>
                          <span className="friend-card__status">εκτός σύνδεσης</span>
                        </div>
                      </button>
                      <div className="friend-card__actions">
                        <button title="Μήνυμα" onClick={() => openDM(f.id)}>
                          <MessageSquare size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {tab === "invites" ? (
          <>
            <div className="module__section-title">Αιτήματα φιλίας</div>
            {requests.length === 0 ? (
              <p className="module__empty">Κανένα εκκρεμές αίτημα.</p>
            ) : (
              <div className="grid grid--cards">
                {requests.map((r) => (
                  <div key={r.id} className="card friend-card">
                    <div className="friend-card__main">
                      <span
                        className="friend-card__badge"
                        style={{ background: r.color }}
                      >
                        {r.name[0]}
                      </span>
                      <div className="friend-card__info">
                        <span className="friend-card__name">{r.name}</span>
                        <span className="friend-card__status">
                          {r.mutual} κοινοί φίλοι ·{" "}
                          {r.direction === "incoming" ? "σε πρόσθεσε" : "εκκρεμεί"}
                        </span>
                      </div>
                    </div>
                    <div className="friend-card__actions">
                      {r.direction === "incoming" ? (
                        <>
                          <button
                            className="friend-card__accept"
                            title="Αποδοχή"
                            onClick={() => acceptRequest(r.id)}
                          >
                            <Check size={16} />
                          </button>
                          <button title="Απόρριψη" onClick={() => declineRequest(r.id)}>
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button title="Ακύρωση" onClick={() => declineRequest(r.id)}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="module__section-title">Invite links</div>
            <div className="invite-links">
              {invites.map((l) => {
                const expired = l.expires === "έληξε";
                return (
                  <div key={l.id} className={`card invite-row${expired ? " invite-row--dead" : ""}`}>
                    <Link2 size={17} />
                    <div className="invite-row__info">
                      <code>{l.code}</code>
                      <span>
                        {l.uses}/{l.maxUses} χρήσεις · {l.expires}
                      </span>
                    </div>
                    <button
                      className="btn btn--sm btn--ghost"
                      disabled={expired}
                      onClick={() => void copyInvite(l.code)}
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                );
              })}
              <button className="btn btn--primary invite-create" onClick={createInvite}>
                <Link2 size={15} />
                Δημιούργησε νέο invite link
              </button>
            </div>
          </>
        ) : null}

        {tab === "groups" ? (
          <>
            <div className="groups-hero">
              <div>
                <div className="module__section-title" style={{ margin: 0 }}>
                  Τα groups σου
                </div>
                <p className="groups-hero__sub">
                  Squads για ranked, SMP και movie nights — όχι απλές λίστες.
                </p>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => setGroupOpen(true)}
              >
                <Sparkles size={14} />
                Νέο group
              </button>
            </div>

            {groupOpen ? (
              <div className="module__inline-form module__inline-form--flush">
                <input
                  autoFocus
                  placeholder="Όνομα group, π.χ. Weekend Raids"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitGroup();
                    if (e.key === "Escape") setGroupOpen(false);
                  }}
                />
                <button
                  className="btn btn--primary btn--sm"
                  onClick={submitGroup}
                  disabled={!groupName.trim()}
                >
                  Δημιουργία
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setGroupOpen(false)}
                >
                  Άκυρο
                </button>
              </div>
            ) : null}

            <div className="groups-grid">
              {groups.map((g) => {
                const onlineInGroup = g.members.filter(
                  (id) => users[id] && users[id].status !== "offline",
                ).length;
                const expanded = focusedGroup === g.id;
                return (
                  <article
                    key={g.id}
                    className={`group-card${expanded ? " group-card--focus" : ""}`}
                    style={{ "--g-color": g.color } as React.CSSProperties}
                    onClick={() =>
                      setFocusedGroup((id) => (id === g.id ? null : g.id))
                    }
                  >
                    <div className="group-card__art" aria-hidden>
                      <div className="group-card__mesh" />
                      <div className="group-card__orb" />
                      <span className="group-card__tag">{g.tag}</span>
                      <span className="group-card__crest">
                        {g.name.slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                    <div className="group-card__body">
                      <div className="group-card__top">
                        <h3 className="group-card__name">{g.name}</h3>
                        <span className="group-card__live">
                          <span className="group-card__live-dot" />
                          {onlineInGroup}/{g.members.length}
                        </span>
                      </div>
                      <p className="group-card__activity">{g.activity}</p>
                      <div className="group-card__footer">
                        <div className="group-card__members">
                          {g.members.map((id) =>
                            users[id] ? (
                              <div key={id} className="group-card__avatar">
                                <Avatar user={users[id]} size={28} showStatus />
                              </div>
                            ) : null,
                          )}
                        </div>
                        <div className="group-card__actions">
                          <button
                            type="button"
                            className="group-card__cta"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveGroup(g.id);
                              toast(`Μπήκες στον server «${g.name}»`);
                            }}
                          >
                            <MessageSquare size={14} />
                            Άνοιγμα
                          </button>
                          <button
                            type="button"
                            className="group-card__cta group-card__cta--ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              const peer = g.members.find(
                                (id) => id !== currentUserId && users[id],
                              );
                              if (peer) {
                                openDM(peer);
                                toast(`DM · ${users[peer]?.name}`);
                              } else {
                                setActiveGroup(g.id);
                              }
                            }}
                          >
                            <ArrowUpRight size={14} />
                            DM
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              <button
                type="button"
                className="group-card group-card--new"
                onClick={() => setGroupOpen(true)}
              >
                <span className="group-card--new__icon">
                  <Users size={22} />
                </span>
                <span className="group-card--new__title">Φτιάξε νέο group</span>
                <span className="group-card--new__hint">
                  Για raids, watch parties ή ό,τι θέλετε
                </span>
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
