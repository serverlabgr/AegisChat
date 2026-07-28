import { useEffect, useState } from "react";
import { Download, Lock, Film, Image as ImageIcon } from "lucide-react";
import type { MediaMeta } from "../../lib/media";
import { resolveMediaUrl } from "../../lib/media";
import "./SecureMedia.css";

export function SecureMedia({ file }: { file: MediaMeta }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void resolveMediaUrl(file)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        if (alive) setError("Αποτυχία αποκρυπτογράφησης");
      });
    return () => {
      alive = false;
    };
  }, [file]);

  const isVideo = file.mime.startsWith("video/");
  const isImage = file.mime.startsWith("image/");
  const mb = (file.size / (1024 * 1024)).toFixed(file.size > 1024 * 1024 ? 1 : 2);

  if (error) {
    return <div className="secure-media secure-media--err">{error}</div>;
  }

  if (!url) {
    return (
      <div className="secure-media secure-media--loading">
        <Lock size={14} /> Αποκρυπτογράφηση {file.name}…
      </div>
    );
  }

  return (
    <figure className="secure-media">
      <div className="secure-media__badge">
        <Lock size={11} />
        original · AES-256 · {mb} MB
      </div>
      {isImage ? (
        <img src={url} alt={file.name} className="secure-media__img" />
      ) : null}
      {isVideo ? (
        <video
          src={url}
          controls
          playsInline
          className="secure-media__video"
          preload="metadata"
        />
      ) : null}
      {!isImage && !isVideo ? (
        <a className="secure-media__file" href={url} download={file.name}>
          {file.mime.startsWith("audio/") ? <Film size={18} /> : <ImageIcon size={18} />}
          <span>{file.name}</span>
          <Download size={14} />
        </a>
      ) : (
        <a className="secure-media__dl" href={url} download={file.name}>
          <Download size={12} /> {file.name}
        </a>
      )}
    </figure>
  );
}
