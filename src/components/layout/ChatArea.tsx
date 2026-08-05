import { useEffect, useState } from "react";
import { Hash, AtSign, Search, PanelRight, Lock, MessageCircle } from "lucide-react";
import type { Message } from "../../data/mock";
import { HOME_SERVER_ID } from "../../data/modules";
import { useStore } from "../../store/store";
import { MessageList } from "../chat/MessageList";
import { MessageInput } from "../chat/MessageInput";
import { PinsStrip } from "../chat/PinsStrip";
import { ScreenShareControls } from "../chat/ScreenShareOverlay";
import { Avatar } from "../common/Avatar";
import "./ChatArea.css";

interface ChatAreaProps {
  onToggleIntel: () => void;
  onOpenSearch: () => void;
  intelVisible: boolean;
}

export function ChatArea({
  onToggleIntel,
  onOpenSearch,
  intelVisible,
}: ChatAreaProps) {
  const {
    activeView,
    messagesByChannel,
    dmMessages,
    users,
    dms,
    memberIds,
    groups,
    activeGroupId,
    homeChannels,
    channelPins,
    refreshChannelPins,
    unpinMessage,
    onlineMode,
  } = useStore();
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  useEffect(() => {
    if (!onlineMode || activeView.type !== "channel") return;
    void refreshChannelPins(activeView.id);
  }, [onlineMode, activeView, refreshChannelPins]);

  const isPersonalHome =
    activeView.type === "dm" && activeView.id === "__personal_home__";
  const isDM = activeView.type === "dm" && !isPersonalHome;
  const messages = isDM
    ? (dmMessages[activeView.id] ?? [])
    : isPersonalHome
      ? []
      : (messagesByChannel[activeView.id] ?? []);

  let title = "";
  let topic = "";
  let placeholder = "";
  let headerTitle = "";
  let headerSubtitle = "";
  let peer = null as (typeof users)[string] | null;

  if (isPersonalHome) {
    title = "Personal Chat";
    topic = "Διάλεξε φίλο από αριστερά για ιδιωτική συνομιλία";
    placeholder = "";
    headerTitle = "Personal Chat";
    headerSubtitle = topic;
  } else if (isDM) {
    const peerId =
      dms.find((d) => d.id === activeView.id)?.userId ??
      activeView.id.replace(/^dm-/, "");
    peer = users[peerId] ?? null;
    title = peer?.name ?? "Personal";
    topic = peer?.bio || "προσωπική συνομιλία · AES-256";
    placeholder = `μήνυμα προς ${peer?.name ?? "φίλο"}`;
    headerTitle = peer?.name ?? "Personal";
    headerSubtitle = topic;
  } else {
    const groupChannels =
      activeGroupId === HOME_SERVER_ID
        ? homeChannels.filter((c) => c.type === "text")
        : (groups.find((g) => g.id === activeGroupId)?.channels ?? []).filter(
            (c) => c.type === "text",
          );
    const channel =
      groupChannels.find((c) => c.id === activeView.id) ??
      homeChannels.find((c) => c.id === activeView.id) ??
      groupChannels[0] ??
      homeChannels.find((c) => c.type === "text");
    title = channel?.name ?? "channel";
    topic = channel?.topic ?? "";
    placeholder = `μήνυμα στο #${channel?.name ?? "channel"}`;
    headerTitle = `# ${channel?.name ?? "channel"}`;
    headerSubtitle = topic;
  }

  const onlineHere = memberIds.filter(
    (id) => users[id] && users[id].status !== "offline",
  ).length;

  return (
    <main className="chat-area">
      <header className="chat-area__header">
        <div className="chat-area__identity">
          {isPersonalHome ? (
            <div className="chat-area__channel-mark">
              <MessageCircle size={16} />
            </div>
          ) : isDM && peer ? (
            <Avatar user={peer} size={34} showStatus />
          ) : (
            <div className="chat-area__channel-mark">
              <Hash size={16} />
            </div>
          )}
          <div className="chat-area__titles">
            <div className="chat-area__crumbs">
              {isDM || isPersonalHome ? (
                <AtSign size={13} className="chat-area__glyph" />
              ) : (
                <Lock size={12} className="chat-area__glyph" />
              )}
              <span className="chat-area__title">{title}</span>
            </div>
            {topic ? <span className="chat-area__topic">{topic}</span> : null}
          </div>
        </div>

        <div className="chat-area__meta">
          {!isDM && !isPersonalHome ? (
            <span className="chat-area__chip">
              <span className="chat-area__chip-dot" />
              {onlineHere} online
            </span>
          ) : null}
          <div className="chat-area__actions">
            {isDM && peer ? (
              <ScreenShareControls
                peerUserId={peer.id}
                threadId={activeView.id}
                peerName={peer.name}
              />
            ) : null}
            <button type="button" aria-label="Search" onClick={onOpenSearch}>
              <Search size={16} />
            </button>
            {!isPersonalHome && !isDM ? (
              <button
                type="button"
                aria-label="Intel panel"
                className={intelVisible ? "chat-area__btn--active" : ""}
                onClick={onToggleIntel}
              >
                <PanelRight size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {isPersonalHome ? (
        <div className="chat-area__personal-home">
          <MessageCircle size={40} />
          <h2>Personal Chat</h2>
          <p>
            Ιδιωτικές συνομιλίες 1:1 με τους φίλους σου — κρυπτογραφημένες με
            AES-256-GCM. Επίλεξε κάποιον από τη λίστα αριστερά.
          </p>
        </div>
      ) : (
        <>
          {!isDM ? (
            <PinsStrip
              pins={channelPins[activeView.id] ?? []}
              onUnpin={unpinMessage}
              canManage
            />
          ) : null}
          <MessageList
            messages={messages}
            headerTitle={headerTitle}
            headerSubtitle={headerSubtitle}
            onReply={setReplyTo}
          />
          <MessageInput
            placeholder={placeholder}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        </>
      )}
    </main>
  );
}
