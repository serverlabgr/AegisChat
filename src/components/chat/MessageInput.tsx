import { useRef, useState } from "react";
import { ImagePlus, Send, Smile, X, Loader2 } from "lucide-react";
import type { Message } from "../../data/mock";
import { useStore } from "../../store/store";
import { EmojiPicker } from "../common/EmojiPicker";
import { uploadEncryptedFile, MEDIA_MAX_BYTES, MEDIA_WARN_BYTES } from "../../lib/media";
import "./MessageInput.css";

interface MessageInputProps {
  placeholder: string;
  replyTo: Message | null;
  onCancelReply: () => void;
}

export function MessageInput({
  placeholder,
  replyTo,
  onCancelReply,
}: MessageInputProps) {
  const { sendMessage, users, toast, onlineMode } = useStore();
  const [value, setValue] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingNames, setPendingNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const attach = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!onlineMode) {
      toast("Για uploads χρειάζεται σύνδεση στο server");
      return;
    }
    const list = Array.from(files);
    const oversized = list.filter((f) => f.size > MEDIA_MAX_BYTES);
    if (oversized.length) {
      toast(
        `Πολύ μεγάλα αρχεία (max 2GB): ${oversized.map((f) => f.name).join(", ")}`,
      );
      return;
    }
    const large = list.filter((f) => f.size > MEDIA_WARN_BYTES);
    if (large.length) {
      toast(
        `Μεγάλα αρχεία — μπορεί να αργήσει: ${large.map((f) => f.name).join(", ")}`,
      );
    }
    setUploading(true);
    setPendingNames(list.map((f) => f.name));
    void (async () => {
      try {
        const metas = [];
        for (const file of list) {
          // Original bytes only — no canvas resize / video re-encode
          metas.push(await uploadEncryptedFile(file));
        }
        sendMessage(value.trim(), replyTo?.id, metas);
        setValue("");
        onCancelReply();
        toast(
          metas.length === 1
            ? `Στάλθηκε κρυπτογραφημένα: ${metas[0].name}`
            : `Στάλθηκαν ${metas.length} αρχεία (AES-256, lossless)`,
        );
      } catch (err) {
        toast(err instanceof Error ? err.message : "Αποτυχία upload");
      } finally {
        setUploading(false);
        setPendingNames([]);
        if (fileRef.current) fileRef.current.value = "";
      }
    })();
  };

  const submit = () => {
    if (!value.trim() || uploading) return;
    sendMessage(value, replyTo?.id);
    setValue("");
    onCancelReply();
    setShowEmoji(false);
  };

  return (
    <footer className="message-input">
      {replyTo ? (
        <div className="message-input__reply">
          <span>
            Απάντηση σε{" "}
            <strong style={{ color: users[replyTo.authorId]?.color }}>
              {users[replyTo.authorId]?.name}
            </strong>
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {uploading ? (
        <div className="message-input__upload">
          <Loader2 size={14} className="message-input__spin" />
          Κρυπτογράφηση & upload χωρίς συμπίεση…
          <span>{pendingNames.join(", ")}</span>
        </div>
      ) : null}

      <div className="message-input__bar">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="*/*"
          hidden
          onChange={(e) => attach(e.target.files)}
        />
        <button
          type="button"
          className="message-input__icon"
          aria-label="Photo / video (original quality)"
          title="Photo / Video — original, AES-256"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus size={20} />
        </button>
        <textarea
          ref={inputRef}
          className="message-input__field"
          placeholder={placeholder}
          value={value}
          rows={1}
          disabled={uploading}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="message-input__emoji-wrap">
          <button
            type="button"
            className="message-input__icon"
            aria-label="Emoji"
            onClick={() => setShowEmoji((v) => !v)}
          >
            <Smile size={20} />
          </button>
          {showEmoji ? (
            <EmojiPicker
              onSelect={(emoji) => {
                setValue((v) => v + emoji);
                setShowEmoji(false);
                inputRef.current?.focus();
              }}
            />
          ) : null}
        </div>
        <button
          type="button"
          className="message-input__send"
          aria-label="Send message"
          onClick={submit}
          disabled={!value.trim() || uploading}
        >
          <Send size={18} />
        </button>
      </div>
    </footer>
  );
}
