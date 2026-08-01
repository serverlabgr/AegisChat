import { ensureFreshAccessToken, getApiBase } from "./api";
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

/** Soft warn / hard block — WebView OOM risk on full-file AES. */
export const MEDIA_WARN_BYTES = 500 * 1024 * 1024; // 500MB
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

const urlCache = new Map<string, string>();

async function authHeader(): Promise<string> {
  const access =
    (await ensureFreshAccessToken()) ?? (await loadTokens())?.accessToken;
  if (!access) throw new Error("Χρειάζεται login για upload");
  return `Bearer ${access}`;
}

/** Encrypt original file bytes (no resize/re-encode) and upload ciphertext. */
export async function uploadEncryptedFile(file: File): Promise<MediaMeta> {
  if (file.size > MEDIA_MAX_BYTES) {
    throw new Error(
      `Το αρχείο ξεπερνά τα 2GB (${(file.size / 1024 / 1024).toFixed(0)}MB). Στείλε μικρότερο.`,
    );
  }

  const raw = await file.arrayBuffer();
  const { encryptBytes } = await import("./messageCrypto");
  const { iv, ciphertext } = await encryptBytes(raw);
  const blob = packEncryptedBlob(iv, ciphertext);

  const doUpload = async (authorization: string) =>
    fetch(`${getApiBase()}/media`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(blob.size),
      },
      body: blob,
    });

  let authorization = await authHeader();
  let res = await doUpload(authorization);
  if (res.status === 401) {
    authorization = await authHeader();
    res = await doUpload(authorization);
  }
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

  let authorization = await authHeader();
  let res = await fetch(`${getApiBase()}/media/${meta.id}`, {
    headers: { Authorization: authorization },
  });
  if (res.status === 401) {
    authorization = await authHeader();
    res = await fetch(`${getApiBase()}/media/${meta.id}`, {
      headers: { Authorization: authorization },
    });
  }
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
