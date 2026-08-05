import { useEffect, useRef, useState } from "react";
import {
  SmilePlus,
  Pencil,
  Trash2,
  Reply,
  Check,
  X,
  Sparkles,
  Lock,
  Pin,
  MessagesSquare,
} from "lucide-react";
import type { Message } from "../../data/mock";
import { useStore } from "../../store/store";
import { Avatar } from "../common/Avatar";
import { EmojiPicker, useCustomEmojis } from "../common/EmojiPicker";
import { formatTime } from "../../lib/format";
import { decodeMessageBody } from "../../lib/messageBody";
import { parseMessageParts } from "../../lib/mentions";
import { emojiImageUrl } from "../../lib/customEmoji";
import { HOME_SERVER_ID } from "../../data/modules";
import { api } from "../../lib/api";
import { SecureMedia } from "./SecureMedia";
import { LinkEmbed } from "./LinkEmbed";
import "./MessageItem.css";

interface MessageItemProps {
  message: Message;
  grouped: boolean;
  onReply: (message: Message) => void;
}

export function MessageItem({ message, grouped, onReply }: MessageItemProps) {
  const {
    users,
    currentUserId,
    toggleReaction,
    editMessage,
    deleteMessage,
    messagesByChannel,
    dmMessages,
    activeView,
    settings,
    readCursors,
    pinMessage,
    onlineMode,
    activeGroupId,
    toast,
  } = useStore();
  const author = users[message.authorId];
  const isOwn = message.authorId === currentUserId;
  const peerSeen =
    settings.readReceipts &&
    isOwn &&
    Object.entries(readCursors[activeView.id] ?? {}).some(
      ([uid, lastId]) =>
        uid !== currentUserId && lastId != null && lastId === message.id,
    );
  const [showPicker, setShowPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const body = decodeMessageBody(message.content);
  const [draft, setDraft] = useState(body.text);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const { emojis: customEmojis, reload: reloadEmojis } = useCustomEmojis(
    activeGroupId === HOME_SERVER_ID ? null : activeGroupId,
    onlineMode && activeView.type === "channel",
  );
  const emojiByName = Object.fromEntries(customEmojis.map((e) => [e.name, e]));

  const replySource =
    message.replyToId != null
      ? (activeView.type === "channel"
          ? messagesByChannel[activeView.id]
          : dmMessages[activeView.id]
        )?.find((m) => m.id === message.replyToId)
      : undefined;
  const replyBody = replySource
    ? decodeMessageBody(replySource.content)
    : null;

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing]);

  if (message.system) {
    return (
      <li className="message-item message-item--system">
        <Sparkles size={12} />
        <span>{message.content}</span>
      </li>
    );
  }

  const commitEdit = () => {
    if (draft.trim() && draft !== body.text) {
      editMessage(message.id, draft.trim());
    }
    setEditing(false);
  };

  const renderRichText = (text: string) =>
    parseMessageParts(text).map((part, i) => {
      if (part.kind === "text") return <span key={i}>{part.value}</span>;
      if (part.kind === "everyone") {
        return (
          <span key={i} className="message-item__mention">
            @everyone
          </span>
        );
      }
      if (part.kind === "mention") {
        const u = users[part.userId];
        return (
          <span key={i} className="message-item__mention">
            @{u?.name ?? "user"}
          </span>
        );
      }
      const em = emojiByName[part.name];
      if (em) {
        return (
          <img
            key={i}
            className="message-item__custom-emoji"
            src={emojiImageUrl(em)}
            alt={`:${part.name}:`}
            title={`:${part.name}:`}
          />
        );
      }
      return <span key={i}>{`:${part.name}:`}</span>;
    });

  const showPin = onlineMode && activeView.type === "channel";

  return (
    <li
      className={`message-item${grouped ? " message-item--grouped" : ""}${
        settings.compactMode ? " message-item--compact" : ""
      }`}
    >
      <div className="message-item__gutter">
        {grouped ? (
          <span className="message-item__hover-time">
            {formatTime(message.timestamp)}
          </span>
        ) : (
          <Avatar user={author} size={38} />
        )}
      </div>

      <div className="message-item__content">
        {replySource ? (
          <div className="message-item__reply-ref">
            <Reply size={12} />
            <span style={{ color: users[replySource.authorId]?.color }}>
              {users[replySource.authorId]?.name}
            </span>
            <span className="message-item__reply-text">
              {replyBody?.files?.length
                ? `📎 ${replyBody.files[0].name}`
                : replyBody?.text}
            </span>
          </div>
        ) : null}

        {!grouped ? (
          <header className="message-item__header">
            <span
              className="message-item__author"
              style={{ color: author.color }}
            >
              {author.name}
            </span>
            {author.role ? (
              <span className="message-item__role">{author.role}</span>
            ) : null}
            <time className="message-item__time">
              {formatTime(message.timestamp)}
            </time>
            {settings.showEncryptionBadges && message.encrypted ? (
              <span className="message-item__enc" title="AES-256-GCM">
                <Lock size={11} />
              </span>
            ) : null}
          </header>
        ) : null}

        {editing ? (
          <div className="message-item__edit">
            <textarea
              ref={editRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitEdit();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              rows={1}
            />
            <div className="message-item__edit-actions">
              <button type="button" onClick={commitEdit} aria-label="Save">
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <>
            {body.text ? (
              <p className="message-item__text">
                {renderRichText(body.text)}
                {message.edited ? (
                  <span className="message-item__edited">(edited)</span>
                ) : null}
                {peerSeen ? (
                  <span className="message-item__edited"> · seen</span>
                ) : null}
              </p>
            ) : null}
            {body.files?.map((f) => (
              <SecureMedia key={f.id} file={f} />
            ))}
            {body.text ? <LinkEmbed text={body.text} /> : null}
          </>
        )}

        {message.reactions.length > 0 ? (
          <div className="message-item__reactions">
            {message.reactions.map((r) => {
              const mine = r.userIds.includes(currentUserId);
              const customMatch = /^:([a-z0-9_]{2,32}):$/i.exec(r.emoji);
              const custom = customMatch
                ? emojiByName[customMatch[1].toLowerCase()]
                : undefined;
              return (
                <button
                  key={r.emoji}
                  type="button"
                  className={`reaction${mine ? " reaction--mine" : ""}`}
                  onClick={() => toggleReaction(message.id, r.emoji)}
                  title={r.userIds
                    .map((id) => users[id]?.name)
                    .filter(Boolean)
                    .join(", ")}
                >
                  {custom ? (
                    <img
                      className="reaction__custom"
                      src={emojiImageUrl(custom)}
                      alt={r.emoji}
                    />
                  ) : (
                    <span>{r.emoji}</span>
                  )}
                  <span className="reaction__count">{r.userIds.length}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="message-item__actions">
        <div className="message-item__action-wrap">
          <button
            type="button"
            aria-label="React"
            onClick={() => setShowPicker((v) => !v)}
          >
            <SmilePlus size={16} />
          </button>
          {showPicker ? (
            <EmojiPicker
              customEmojis={customEmojis}
              onCustomChanged={reloadEmojis}
              onSelect={(emoji) => {
                toggleReaction(message.id, emoji);
                setShowPicker(false);
              }}
            />
          ) : null}
        </div>
        <button type="button" aria-label="Reply" onClick={() => onReply(message)}>
          <Reply size={16} />
        </button>
        {showPin ? (
          <button
            type="button"
            aria-label="Pin"
            title="Pin message"
            onClick={() => pinMessage(message.id)}
          >
            <Pin size={16} />
          </button>
        ) : null}
        {showPin ? (
          <button
            type="button"
            aria-label="Thread"
            title="Start thread"
            onClick={() => {
              void api("/threads", {
                method: "POST",
                body: {
                  channelId: activeView.id,
                  parentMessageId: message.id,
                },
              })
                .then(() => toast("Thread δημιουργήθηκε"))
                .catch((err) =>
                  toast(err instanceof Error ? err.message : "Αποτυχία thread"),
                );
            }}
          >
            <MessagesSquare size={16} />
          </button>
        ) : null}
        {isOwn ? (
          <>
            <button
              type="button"
              aria-label="Edit"
              onClick={() => {
                setDraft(body.text);
                setEditing(true);
              }}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              aria-label="Delete"
              className="message-item__action-danger"
              onClick={() => deleteMessage(message.id)}
            >
              <Trash2 size={16} />
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}
