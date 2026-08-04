import { useEffect, useRef, useState } from "react";
import { FileIcon, ImagePlus, Send, Smile, X, Loader2 } from "lucide-react";
import type { Message } from "../../data/mock";
import { useStore } from "../../store/store";
import { EmojiPicker } from "../common/EmojiPicker";
import {
  uploadEncryptedFile,
  MEDIA_MAX_BYTES,
  MEDIA_WARN_BYTES,
} from "../../lib/media";
import "./MessageInput.css";

interface MessageInputProps {
  placeholder: string;
  replyTo: Message | null;
  onCancelReply: () => void;
}

type StagedFile = {
  id: string;
  file: File;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageInput({
  placeholder,
  replyTo,
  onCancelReply,
}: MessageInputProps) {
  const { sendMessage, users, toast, onlineMode, sendTyping } = useStore();
  const [value, setValue] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpTyping = () => {
    if (!onlineMode) return;
    if (typingDebounce.current) return;
    sendTyping();
    typingDebounce.current = setTimeout(() => {
      typingDebounce.current = null;
    }, 1800);
  };

  useEffect(() => {
    return () => {
      if (typingDebounce.current) clearTimeout(typingDebounce.current);
    };
  }, []);

  const stageFiles = (files: FileList | File[] | null) => {
    if (!files || (files as FileList).length === 0) return;
    if (!onlineMode) {
      toast("Για uploads χρειάζεται σύνδεση στο server");
      return;
    }
    const list = Array.from(files as FileList | File[]);
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
    setStaged((prev) => [
      ...prev,
      ...list.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
      })),
    ]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeStaged = (id: string) => {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  };

  const submit = () => {
    const text = value.trim();
    if ((!text && staged.length === 0) || uploading) return;

    if (staged.length === 0) {
      sendMessage(text, replyTo?.id);
      setValue("");
      onCancelReply();
      setShowEmoji(false);
      return;
    }

    setUploading(true);
    setProgress(0);
    void (async () => {
      try {
        const metas = [];
        for (let i = 0; i < staged.length; i++) {
          const { file } = staged[i];
          setUploadLabel(file.name);
          setProgress(0);
          metas.push(
            await uploadEncryptedFile(file, (pct) => {
              // Overall progress across files
              const base = (i / staged.length) * 100;
              const slice = pct / staged.length;
              setProgress(Math.round(base + slice));
            }),
          );
        }
        sendMessage(text, replyTo?.id, metas);
        setValue("");
        setStaged([]);
        onCancelReply();
        setShowEmoji(false);
        toast(
          metas.length === 1
            ? `Στάλθηκε κρυπτογραφημένα: ${metas[0].name}`
            : `Στάλθηκαν ${metas.length} αρχεία (AES-256, lossless)`,
        );
      } catch (err) {
        toast(err instanceof Error ? err.message : "Αποτυχία upload");
      } finally {
        setUploading(false);
        setUploadLabel("");
        setProgress(0);
      }
    })();
  };

  const canSend = (value.trim().length > 0 || staged.length > 0) && !uploading;

  return (
    <footer
      className={`message-input${dragOver ? " message-input--drag" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        stageFiles(e.dataTransfer.files);
      }}
    >
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

      {staged.length > 0 ? (
        <div className="message-input__chips">
          {staged.map((s) => (
            <div key={s.id} className="message-input__chip">
              {s.file.type.startsWith("image/") ? (
                <ImagePlus size={12} />
              ) : (
                <FileIcon size={12} />
              )}
              <span className="message-input__chip-name" title={s.file.name}>
                {s.file.name}
              </span>
              <em>{formatBytes(s.file.size)}</em>
              <button
                type="button"
                aria-label="Αφαίρεση"
                disabled={uploading}
                onClick={() => removeStaged(s.id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {uploading ? (
        <div className="message-input__upload">
          <Loader2 size={14} className="message-input__spin" />
          Κρυπτογράφηση & upload…
          <span>{uploadLabel}</span>
          <div className="message-input__progress" aria-hidden>
            <div
              className="message-input__progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
          <em>{progress}%</em>
        </div>
      ) : null}

      {dragOver ? (
        <div className="message-input__drop-hint">Άφησε αρχεία εδώ</div>
      ) : null}

      <div className="message-input__bar">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="*/*"
          hidden
          onChange={(e) => stageFiles(e.target.files)}
        />
        <button
          type="button"
          className="message-input__icon"
          aria-label="Επισύναψη αρχείου"
          title="Photo / αρχείο — original, AES-256"
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
          onChange={(e) => {
            setValue(e.target.value);
            if (e.target.value.trim()) bumpTyping();
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.files;
            if (items && items.length > 0) {
              e.preventDefault();
              stageFiles(items);
            }
          }}
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
          disabled={!canSend}
        >
          <Send size={18} />
        </button>
      </div>
    </footer>
  );
}
