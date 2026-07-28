import { getApiBase } from "./api";
import { loadTokens } from "./authStorage";
import {
  packEncryptedBlob,
  unpackEncryptedBlob,
} from "./messageCrypto";

export type MediaMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
};

const urlCache = new Map<string, string>();

/** Encrypt original file bytes (no resize/re-encode) and upload ciphertext. */
export async function uploadEncryptedFile(file: File): Promise<MediaMeta> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("Χρειάζεται login για upload");

  const raw = await file.arrayBuffer();
  // Client-side AES only — original resolution/bitrate untouched inside ciphertext
  const { encryptBytes } = await import("./messageCrypto");
  const { iv, ciphertext } = await encryptBytes(raw);
  const blob = packEncryptedBlob(iv, ciphertext);

  const res = await fetch(`${getApiBase()}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(blob.size),
    },
    body: blob,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? `Upload failed (${res.status})`);
  }
  const data = (await res.json()) as { id: string; size: number };
  return {
    id: data.id,
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
  };
}

/** Fetch ciphertext and decrypt to an object URL for <img>/<video>. */
export async function resolveMediaUrl(meta: MediaMeta): Promise<string> {
  const cached = urlCache.get(meta.id);
  if (cached) return cached;

  const tokens = await loadTokens();
  if (!tokens) throw new Error("No auth");

  const res = await fetch(`${getApiBase()}/media/${meta.id}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!res.ok) throw new Error("Media download failed");

  const enc = await res.blob();
  const plain = await unpackEncryptedBlob(enc);
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(plain)], { type: meta.mime }),
  );
  urlCache.set(meta.id, url);
  return url;
}

export function revokeMediaUrl(id: string) {
  const u = urlCache.get(id);
  if (u) {
    URL.revokeObjectURL(u);
    urlCache.delete(id);
  }
}
