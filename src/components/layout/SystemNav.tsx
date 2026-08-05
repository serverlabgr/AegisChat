import {
  MonitorUp,
  MonitorOff,
  Hash,
  Radio,
  Mic,
  MicOff,
  Headphones,
  Settings,
  PhoneOff,
  Signal,
  ChevronDown,
  Volume2,
  Plus,
  MessagesSquare,
  Trash2,
  Pencil,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HOME_SERVER_ID, PERSONAL_SPACE_ID } from "../../data/modules";
import { useStore } from "../../store/store";
import {
  isVoiceGoLive,
  startVoiceGoLive,
  stopVoiceGoLive,
} from "../../lib/voiceMesh";
import { Avatar } from "../common/Avatar";
import { PersonalNav } from "./PersonalNav";
import {
  ChannelManageModals,
  type ChannelModalMode,
} from "../modals/ChannelManageModals";
import type { Channel } from "../../data/mock";
import "./SystemNav.css";

interface SystemNavProps {
  onOpenSettings: () => void;
  onOpenProfile: (e: React.MouseEvent) => void;
}

const statusText: Record<string, string> = {
  online: "ONLINE",
  away: "ΛΕΙΠΩ",
  busy: "ΜΗΝ ΕΝΟΧΛΕΙΤΕ",
  offline: "OFFLINE",
};

type SectionKey = "text" | "voice" | "dms";

export function SystemNav({ onOpenSettings, onOpenProfile }: SystemNavProps) {
  const {
    activeView,
    setActiveView,
    setActiveModule,
    setActiveGroup,
    activeGroupId,
    unread,
    users,
    currentUserId,
    memberIds,
    dms,
    groups,
    homeChannels,
    voice,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toast,
  } = useStore();
  const me = users[currentUserId];
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    text: true,
    voice: true,
    dms: true,
  });
  const [channelModal, setChannelModal] = useState<ChannelModalMode | null>(
    null,
  );
  const [channelMenu, setChannelMenu] = useState<{
    channel: Channel;
    x: number;
    y: number;
  } | null>(null);

  const openChannelMenu = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    setChannelMenu({ channel, x: e.clientX, y: e.clientY });
  };

  const activeGroup = useMemo(() => {
    if (activeGroupId === HOME_SERVER_ID) {
      return {
        id: HOME_SERVER_ID,
        name: "η παρέα",
        tag: "Home",
        color: "#5cc8ff",
        members: memberIds,
        activity: "",
        channels: homeChannels,
      };
    }
    return groups.find((g) => g.id === activeGroupId) ?? null;
  }, [activeGroupId, groups, memberIds, homeChannels]);

  const textList = useMemo(
    () =>
      (activeGroup?.channels ?? homeChannels).filter((c) => c.type === "text"),
    [activeGroup, homeChannels],
  );
  const voiceList = useMemo(
    () =>
      (activeGroup?.channels ?? homeChannels).filter((c) => c.type === "voice"),
    [activeGroup, homeChannels],
  );

  if (!me) return null;

  const onlineCount = memberIds.filter(
    (id) => users[id] && users[id].status !== "offline",
  ).length;

  const toggle = (key: SectionKey) =>
    setOpen((s) => ({ ...s, [key]: !s[key] }));

  const isPersonal = activeGroupId === PERSONAL_SPACE_ID;

  return (
    <aside className="sysnav">
      <div className="sysnav__servers" aria-label="Servers">
        <button
          type="button"
          className={`sysnav__server-pill sysnav__server-pill--dm${
            isPersonal ? " sysnav__server-pill--on" : ""
          }`}
          title="Personal Chat"
          onClick={() => setActiveGroup(PERSONAL_SPACE_ID)}
        >
          <MessagesSquare size={18} />
        </button>
        <div className="sysnav__server-sep" />
        <button
          type="button"
          className={`sysnav__server-pill${
            activeGroupId === HOME_SERVER_ID ? " sysnav__server-pill--on" : ""
          }`}
          title="η παρέα"
          onClick={() => setActiveGroup(HOME_SERVER_ID)}
        >
          Α
        </button>
        <div className="sysnav__server-sep" />
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`sysnav__server-pill${
              activeGroupId === g.id ? " sysnav__server-pill--on" : ""
            }`}
            style={{ "--pill": g.color } as React.CSSProperties}
            title={g.name}
            onClick={() => setActiveGroup(g.id)}
          >
            {g.name.slice(0, 1).toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          className="sysnav__server-pill sysnav__server-pill--add"
          title="Νέος server / group"
          onClick={() => setActiveModule("friends")}
        >
          <Plus size={16} />
        </button>
      </div>

      {isPersonal ? (
        <PersonalNav
          onOpenSettings={onOpenSettings}
          onOpenProfile={onOpenProfile}
        />
      ) : (
      <div className="sysnav__main">
        <header className="sysnav__server">
          <div className="sysnav__server-glow" aria-hidden />
          <div
            className="sysnav__server-crest"
            style={
              activeGroup
                ? ({
                    background: `linear-gradient(145deg, ${activeGroup.color}, #3dd6b5)`,
                  } as React.CSSProperties)
                : undefined
            }
            aria-hidden
          >
            <span>
              {(activeGroup?.name ?? "Α").slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="sysnav__server-meta">
            <strong className="sysnav__server-name">
              {activeGroup?.name ?? "η παρέα"}
            </strong>
            <span className="sysnav__server-live">
              <span className="sysnav__server-pulse" />
              {onlineCount} online · encrypted
            </span>
          </div>
          <button
            type="button"
            className="sysnav__server-gear"
            title="Ρυθμίσεις server"
            aria-label="Ρυθμίσεις server"
            onClick={() => setChannelModal({ kind: "group" })}
          >
            <Settings size={15} />
          </button>
        </header>

        <div className="sysnav__scroll">
          <section className="sysnav__group">
            <div className="sysnav__section-row">
              <button
                type="button"
                className="sysnav__section-btn"
                onClick={() => toggle("text")}
                aria-expanded={open.text}
              >
                <ChevronDown
                  size={14}
                  className={`sysnav__chev${open.text ? "" : " sysnav__chev--closed"}`}
                />
                <span>Κανάλια</span>
                <em>{textList.length}</em>
              </button>
              <button
                type="button"
                className="sysnav__section-add"
                title="Νέο κανάλι κειμένου"
                aria-label="Νέο κανάλι κειμένου"
                onClick={() =>
                  setChannelModal({ kind: "create", type: "text" })
                }
              >
                <Plus size={14} />
              </button>
            </div>
            {open.text ? (
              <ul className="sysnav__list">
                {textList.map((channel) => {
                  const active =
                    activeView.type === "channel" &&
                    activeView.id === channel.id;
                  const count = unread[channel.id] ?? 0;
                  return (
                    <li key={channel.id}>
                      <button
                        type="button"
                        className={`sysnav__row${active ? " sysnav__row--active" : ""}${
                          count && !active ? " sysnav__row--unread" : ""
                        }`}
                        onClick={() =>
                          setActiveView({ type: "channel", id: channel.id })
                        }
                        onContextMenu={(e) => openChannelMenu(e, channel)}
                      >
                        <Hash size={15} className="sysnav__glyph" />
                        <span className="sysnav__name">{channel.name}</span>
                        {count ? (
                          <span className="sysnav__badge">{count}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          <section className="sysnav__group">
            <div className="sysnav__section-row">
              <button
                type="button"
                className="sysnav__section-btn"
                onClick={() => toggle("voice")}
                aria-expanded={open.voice}
              >
                <ChevronDown
                  size={14}
                  className={`sysnav__chev${open.voice ? "" : " sysnav__chev--closed"}`}
                />
                <span>Φωνή</span>
                <em>{voiceList.length}</em>
              </button>
              <button
                type="button"
                className="sysnav__section-add"
                title="Νέο φωνητικό κανάλι"
                aria-label="Νέο φωνητικό κανάλι"
                onClick={() =>
                  setChannelModal({ kind: "create", type: "voice" })
                }
              >
                <Plus size={14} />
              </button>
            </div>
            {open.voice ? (
              <ul className="sysnav__list">
                {voiceList.map((channel) => {
                  const participants = voice.participants[channel.id] ?? [];
                  const joined = voice.channelId === channel.id;
                  return (
                    <li key={channel.id}>
                      <button
                        type="button"
                        className={`sysnav__row${
                          joined ? " sysnav__row--voice" : ""
                        }`}
                        onClick={() =>
                          joined ? leaveVoice() : joinVoice(channel.id)
                        }
                        onContextMenu={(e) => openChannelMenu(e, channel)}
                      >
                        {joined ? (
                          <Volume2
                            size={15}
                            className="sysnav__glyph sysnav__glyph--live"
                          />
                        ) : (
                          <Radio size={15} className="sysnav__glyph" />
                        )}
                        <span className="sysnav__name">{channel.name}</span>
                        <span
                          className={`sysnav__count${
                            participants.length ? " sysnav__count--live" : ""
                          }`}
                        >
                          {participants.length > 0
                            ? `${participants.length} live`
                            : "άδειο"}
                        </span>
                      </button>
                      {participants.length > 0 ? (
                        <ul className="sysnav__voice-users">
                          {participants
                            .filter((id) => users[id])
                            .map((id) => (
                              <li key={id}>
                                <span className="sysnav__voice-tick" />
                                <Avatar user={users[id]} size={18} />
                                <span>{users[id]?.name}</span>
                                {id === currentUserId && voice.muted ? (
                                  <MicOff size={11} className="sysnav__muted" />
                                ) : null}
                              </li>
                            ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          <section className="sysnav__group">
            <button
              type="button"
              className="sysnav__section-btn"
              onClick={() => toggle("dms")}
              aria-expanded={open.dms}
            >
              <ChevronDown
                size={14}
                className={`sysnav__chev${open.dms ? "" : " sysnav__chev--closed"}`}
              />
              <span>Προσωπικά</span>
              <em>{dms.length}</em>
            </button>
            {open.dms ? (
              <ul className="sysnav__list">
                {dms.map((dm) => {
                  const user = users[dm.userId];
                  if (!user) return null;
                  const active =
                    activeView.type === "dm" && activeView.id === dm.id;
                  const count = unread[dm.id] ?? 0;
                  return (
                    <li key={dm.id}>
                      <button
                        type="button"
                        className={`sysnav__row${active ? " sysnav__row--active" : ""}${
                          count && !active ? " sysnav__row--unread" : ""
                        }`}
                        onClick={() =>
                          setActiveView({ type: "dm", id: dm.id })
                        }
                      >
                        <Avatar user={user} size={20} showStatus />
                        <span className="sysnav__name">{user.name}</span>
                        {count ? (
                          <span className="sysnav__badge">{count}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        </div>

        {voice.channelId ? (
          <div className="sysnav__voice-bar">
            <div className="sysnav__voice-status">
              <Signal size={13} />
              <div>
                <strong>LINK ACTIVE</strong>
                <span>
                  {[...voiceList].find(
                    (c) => c.id === voice.channelId,
                  )?.name ?? "voice"}
                </span>
              </div>
            </div>
            <GoLiveButton toast={toast} />
            <button
              type="button"
              className="sysnav__voice-leave"
              onClick={leaveVoice}
              aria-label="Disconnect"
            >
              <PhoneOff size={14} />
            </button>
          </div>
        ) : null}

        <footer className="sysnav__user bracket">
          <button
            type="button"
            className="sysnav__user-main"
            onClick={onOpenProfile}
          >
            <Avatar user={me} size={30} showStatus />
            <div className="sysnav__user-info">
              <span className="sysnav__user-name">{me.name}</span>
              <span className="sysnav__user-status">
                <span className="sysnav__user-dot" />
                {statusText[me.status]}
              </span>
            </div>
          </button>
          <div className="sysnav__user-ctrls">
            <button
              type="button"
              aria-label="Mic"
              className={voice.muted ? "sysnav__ctrl--off" : ""}
              onClick={toggleMute}
            >
              {voice.muted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              type="button"
              aria-label="Deafen"
              className={voice.deafened ? "sysnav__ctrl--off" : ""}
              onClick={toggleDeafen}
            >
              <Headphones size={14} />
            </button>
            <button
              type="button"
              aria-label="Settings"
              onClick={onOpenSettings}
            >
              <Settings size={14} />
            </button>
          </div>
        </footer>
      </div>
      )}

      {channelModal ? (
        <ChannelManageModals
          key={`${channelModal.kind}-${
            channelModal.kind === "create"
              ? channelModal.type
              : channelModal.kind === "group"
                ? "group"
                : channelModal.channel.id
          }`}
          mode={channelModal}
          onClose={() => setChannelModal(null)}
          onSwitch={setChannelModal}
        />
      ) : null}

      {channelMenu ? (
        <>
          <button
            type="button"
            className="sysnav__ctx-backdrop"
            aria-label="Κλείσιμο μενού"
            onClick={() => setChannelMenu(null)}
          />
          <div
            className="sysnav__ctx-menu"
            style={{ top: channelMenu.y, left: channelMenu.x }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setChannelModal({ kind: "edit", channel: channelMenu.channel });
                setChannelMenu(null);
              }}
            >
              <Pencil size={14} />
              Επεξεργασία
            </button>
            <button
              type="button"
              role="menuitem"
              className="sysnav__ctx-menu--danger"
              onClick={() => {
                setChannelModal({
                  kind: "delete",
                  channel: channelMenu.channel,
                });
                setChannelMenu(null);
              }}
            >
              <Trash2 size={14} />
              Διαγραφή
            </button>
          </div>
        </>
      ) : null}
    </aside>
  );
}

function GoLiveButton({ toast }: { toast: (t: string) => void }) {
  const [live, setLive] = useState(isVoiceGoLive());
  useEffect(() => {
    const id = window.setInterval(() => setLive(isVoiceGoLive()), 800);
    return () => window.clearInterval(id);
  }, []);
  return (
    <button
      type="button"
      className={`sysnav__ctrl${live ? " sysnav__ctrl--off" : ""}`}
      title={live ? "Stop Go Live" : "Go Live (screen share)"}
      aria-label="Go Live"
      onClick={() => {
        if (live || isVoiceGoLive()) {
          void stopVoiceGoLive().then(() => setLive(false));
          return;
        }
        void startVoiceGoLive()
          .then(() => setLive(true))
          .catch((err) =>
            toast(err instanceof Error ? err.message : "Go Live failed"),
          );
      }}
    >
      {live ? <MonitorOff size={14} /> : <MonitorUp size={14} />}
    </button>
  );
}
