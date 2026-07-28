import { useMemo, useState } from "react";
import { Search, Hash, AtSign } from "lucide-react";
import { Modal } from "../common/Modal";
import { useStore, type ActiveView } from "../../store/store";
import { formatTime } from "../../lib/format";
import "./SearchModal.css";

interface Hit {
  messageId: string;
  content: string;
  authorName: string;
  authorColor: string;
  timestamp: number;
  location: string;
  view: ActiveView;
}

export function SearchModal({ onClose }: { onClose: () => void }) {
  const {
    messagesByChannel,
    dmMessages,
    users,
    dms,
    setActiveView,
    homeChannels,
    groups,
  } = useStore();
  const [query, setQuery] = useState("");

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const result: Hit[] = [];

    const searchable = [
      ...homeChannels.filter((c) => c.type === "text"),
      ...groups.flatMap((g) =>
        (g.channels ?? []).filter((c) => c.type === "text"),
      ),
    ];

    for (const channel of searchable) {
      for (const m of messagesByChannel[channel.id] ?? []) {
        if (m.content.toLowerCase().includes(q)) {
          result.push({
            messageId: m.id,
            content: m.content,
            authorName: users[m.authorId]?.name ?? "?",
            authorColor: users[m.authorId]?.color ?? "#fff",
            timestamp: m.timestamp,
            location: `#${channel.name}`,
            view: { type: "channel", id: channel.id },
          });
        }
      }
    }

    for (const dm of dms) {
      for (const m of dmMessages[dm.id] ?? []) {
        if (m.content.toLowerCase().includes(q)) {
          result.push({
            messageId: m.id,
            content: m.content,
            authorName: users[m.authorId]?.name ?? "?",
            authorColor: users[m.authorId]?.color ?? "#fff",
            timestamp: m.timestamp,
            location: `@${users[dm.userId]?.name}`,
            view: { type: "dm", id: dm.id },
          });
        }
      }
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [query, messagesByChannel, dmMessages, users, dms]);

  return (
    <Modal
      title="Αναζήτηση μηνυμάτων"
      subtitle="Τοπική αναζήτηση — τίποτα δεν φεύγει από τη συσκευή"
      onClose={onClose}
      width={620}
    >
      <div className="search">
        <div className="search__input">
          <Search size={18} />
          <input
            autoFocus
            placeholder="Πληκτρολόγησε τουλάχιστον 2 χαρακτήρες..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="search__results">
          {query.trim().length >= 2 && hits.length === 0 ? (
            <p className="search__empty">Κανένα αποτέλεσμα για «{query}».</p>
          ) : null}

          {hits.map((hit) => (
            <button
              key={hit.messageId}
              type="button"
              className="search__hit"
              onClick={() => {
                setActiveView(hit.view);
                onClose();
              }}
            >
              <div className="search__hit-head">
                <span className="search__hit-loc">
                  {hit.location.startsWith("#") ? (
                    <Hash size={12} />
                  ) : (
                    <AtSign size={12} />
                  )}
                  {hit.location.replace(/^[#@]/, "")}
                </span>
                <span
                  className="search__hit-author"
                  style={{ color: hit.authorColor }}
                >
                  {hit.authorName}
                </span>
                <time>{formatTime(hit.timestamp)}</time>
              </div>
              <p className="search__hit-text">{hit.content}</p>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
