import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import "./LinkEmbed.css";

type Embed = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

const URL_IN_TEXT = /https?:\/\/[^\s<>"]{4,200}/i;

export function LinkEmbed({ text }: { text: string }) {
  const [embed, setEmbed] = useState<Embed | null>(null);
  const match = URL_IN_TEXT.exec(text);

  useEffect(() => {
    if (!match) {
      setEmbed(null);
      return;
    }
    let cancelled = false;
    void api<{ embed: Embed | null }>(
      `/embeds?url=${encodeURIComponent(match[0])}`,
    )
      .then((r) => {
        if (!cancelled) setEmbed(r.embed);
      })
      .catch(() => {
        if (!cancelled) setEmbed(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!embed?.title && !embed?.description) return null;

  return (
    <a
      className="link-embed"
      href={embed.url}
      target="_blank"
      rel="noreferrer"
    >
      {embed.imageUrl ? (
        <img className="link-embed__img" src={embed.imageUrl} alt="" />
      ) : null}
      <div className="link-embed__body">
        {embed.siteName ? (
          <span className="link-embed__site">{embed.siteName}</span>
        ) : null}
        {embed.title ? <strong>{embed.title}</strong> : null}
        {embed.description ? <p>{embed.description}</p> : null}
      </div>
    </a>
  );
}
