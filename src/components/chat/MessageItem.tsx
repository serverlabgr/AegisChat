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
} from "lucide-react";
import type { Message } from "../../data/mock";
import { useStore } from "../../store/store";
import { Avatar } from "../common/Avatar";
import { EmojiPicker } from "../common/EmojiPicker";
import { formatTime } from "../../lib/format";
import { decodeMessageBody } from "../../lib/messageBody";
import { SecureMedia } from "./SecureMedia";
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
                {body.text}
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
          </>
        )}

        {message.reactions.length > 0 ? (
          <div className="message-item__reactions">
            {message.reactions.map((r) => {
              const mine = r.userIds.includes(currentUserId);
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
                  <span>{r.emoji}</span>
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
