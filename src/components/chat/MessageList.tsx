import { useEffect, useRef } from "react";
import type { Message } from "../../data/mock";
import { useStore } from "../../store/store";
import { MessageItem } from "./MessageItem";
import { TypingIndicator } from "./TypingIndicator";
import { formatDayDivider } from "../../lib/format";
import "./MessageList.css";

interface MessageListProps {
  messages: Message[];
  headerTitle: string;
  headerSubtitle: string;
  onReply: (message: Message) => void;
}

const GROUP_WINDOW = 5 * 60 * 1000;

export function MessageList({
  messages,
  headerTitle,
  headerSubtitle,
  onReply,
}: MessageListProps) {
  const { typingUserId, users } = useStore();
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll ONLY the list container. Never use scrollIntoView here:
  // it also scrolls every scrollable ancestor (including overflow:hidden
  // body/#root), which shifts the whole app upward and leaves a gap below.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typingUserId]);

  let lastDay = "";

  return (
    <div className="message-list" ref={listRef}>
      <div className="message-list__welcome">
        <h2>{headerTitle}</h2>
        {headerSubtitle ? <p>{headerSubtitle}</p> : null}
      </div>

      <ol className="message-list__messages">
        {messages.map((message, i) => {
          const prev = messages[i - 1];
          const day = formatDayDivider(message.timestamp);
          const showDivider = day !== lastDay;
          lastDay = day;

          const grouped =
            !showDivider &&
            prev != null &&
            prev.authorId === message.authorId &&
            !prev.system &&
            !message.system &&
            message.timestamp - prev.timestamp < GROUP_WINDOW &&
            message.replyToId == null;

          return (
            <div key={message.id}>
              {showDivider ? (
                <div className="message-list__divider">
                  <span>{day}</span>
                </div>
              ) : null}
              <MessageItem
                message={message}
                grouped={grouped}
                onReply={onReply}
              />
            </div>
          );
        })}
      </ol>

      {typingUserId ? (
        <TypingIndicator name={users[typingUserId]?.name ?? "Κάποιος"} />
      ) : null}
    </div>
  );
}
