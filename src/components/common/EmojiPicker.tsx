import { useEffect, useRef, useState } from "react";
import { QUICK_EMOJIS } from "../../data/mock";
import {
  emojiImageUrl,
  uploadCustomEmoji,
  type CustomEmoji,
} from "../../lib/customEmoji";
import { useStore } from "../../store/store";
import { HOME_SERVER_ID } from "../../data/modules";
import "./EmojiPicker.css";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  align?: "left" | "right";
  customEmojis?: CustomEmoji[];
  onCustomChanged?: () => void;
}

export function EmojiPicker({
  onSelect,
  align = "right",
  customEmojis = [],
  onCustomChanged,
}: EmojiPickerProps) {
  const { users, currentUserId, activeGroupId, toast, onlineMode } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const isAdmin =
    String(users[currentUserId]?.role ?? "").toLowerCase() === "admin";

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const raw = file.name.replace(/\.[^.]+$/, "").toLowerCase();
    const name = raw.replace(/[^a-z0-9_]/g, "_").slice(0, 32);
    if (name.length < 2) {
      toast("Όνομα αρχείου: τουλάχιστον 2 a-z χαρακτήρες");
      return;
    }
    try {
      await uploadCustomEmoji(
        file,
        name,
        activeGroupId === HOME_SERVER_ID ? null : activeGroupId,
      );
      toast(`Emoji :${name}: προστέθηκε`);
      onCustomChanged?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία emoji upload");
    }
  };

  return (
    <div className={`emoji-picker emoji-picker--${align}`}>
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="emoji-picker__item"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
      {customEmojis.length > 0 ? (
        <>
          <div className="emoji-picker__sep" />
          {customEmojis.map((e) => (
            <button
              key={e.id}
              type="button"
              className="emoji-picker__item emoji-picker__item--custom"
              title={`:${e.name}:`}
              onClick={() => onSelect(`:${e.name}:`)}
            >
              <img src={emojiImageUrl(e)} alt={e.name} />
            </button>
          ))}
        </>
      ) : null}
      {onlineMode && isAdmin ? (
        <>
          <div className="emoji-picker__sep" />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/webp,image/gif,image/jpeg"
            hidden
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="emoji-picker__item emoji-picker__add"
            title="Upload custom emoji (Admin)"
            onClick={() => fileRef.current?.click()}
          >
            +
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Tiny hook to keep emoji list warm for pickers. */
export function useCustomEmojis(groupId: string | null, enabled: boolean) {
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void import("../../lib/customEmoji").then(({ fetchCustomEmojis }) =>
      fetchCustomEmojis(groupId)
        .then((list) => {
          if (!cancelled) setEmojis(list);
        })
        .catch(() => {
          if (!cancelled) setEmojis([]);
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [groupId, enabled, tick]);
  return { emojis, reload: () => setTick((t) => t + 1) };
}
