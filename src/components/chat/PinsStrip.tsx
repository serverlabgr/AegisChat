import { Pin, X } from "lucide-react";
import type { Message } from "../../data/mock";
import { useStore } from "../../store/store";
import { decodeMessageBody } from "../../lib/messageBody";
import "./PinsStrip.css";

type PinRow = Message & { pinnedBy?: string; pinnedAt?: number };

interface PinsStripProps {
  pins: PinRow[];
  onUnpin: (messageId: string) => void;
  canManage: boolean;
}

export function PinsStrip({ pins, onUnpin, canManage }: PinsStripProps) {
  const { users } = useStore();
  if (!pins.length) return null;

  return (
    <div className="pins-strip">
      <div className="pins-strip__label">
        <Pin size={12} />
        <span>Pins · {pins.length}</span>
      </div>
      <ul className="pins-strip__list">
        {pins.map((p) => {
          const body = decodeMessageBody(p.content);
          const author = users[p.authorId];
          return (
            <li key={p.id} className="pins-strip__item">
              <span
                className="pins-strip__author"
                style={{ color: author?.color }}
              >
                {author?.name ?? "?"}
              </span>
              <span className="pins-strip__text">
                {body.text || (body.files?.length ? "📎 αρχείο" : "…")}
              </span>
              {canManage ? (
                <button
                  type="button"
                  className="pins-strip__unpin"
                  aria-label="Unpin"
                  onClick={() => onUnpin(p.id)}
                >
                  <X size={12} />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
