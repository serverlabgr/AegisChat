/**
 * AES-256-GCM for chat payloads & media.
 * Format text: aegis1.<iv_b64url>.<ciphertext_b64url>
 * Media blob: iv(12) || ciphertext
 *
 * Key comes from zero-knowledge client vault (see vault.ts) —
 * never from a server-derived secret.
 */

const PREFIX = "aegis1.";
const VAULT_LS_KEY = "aegis:vaultKey";

let cachedKey: CryptoKey | null = null;
let cachedRaw: string | null = null;

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importRawKey(rawB64: string): Promise<CryptoKey> {
  const raw = b64urlDecode(rawB64);
  const copy = new Uint8Array(raw);
  return crypto.subtle.importKey("raw", copy, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Persist & activate vault key (client-only). */
export async function setVaultKey(rawB64: string): Promise<void> {
  cachedRaw = rawB64;
  cachedKey = await importRawKey(rawB64);
  try {
    localStorage.setItem(VAULT_LS_KEY, rawB64);
  } catch {
    /* ignore */
  }
}

export async function ensureVaultKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  let raw = cachedRaw;
  if (!raw) {
    try {
      raw = localStorage.getItem(VAULT_LS_KEY);
    } catch {
      raw = null;
    }
  }
  if (!raw) {
    throw new Error(
      "Δεν υπάρχει vault key. Κάνε login και βάλε το Recovery Key της παρέας.",
    );
  }
  await setVaultKey(raw);
  return cachedKey!;
}

export function isEncryptedPayload(content: string): boolean {
  return content.startsWith(PREFIX);
}

export async function encryptText(plaintext: string): Promise<string> {
  const key = await ensureVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return `${PREFIX}${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

export async function decryptText(payload: string): Promise<string> {
  if (!isEncryptedPayload(payload)) return payload;
  try {
    const key = await ensureVaultKey();
    const rest = payload.slice(PREFIX.length);
    const [ivPart, ctPart] = rest.split(".");
    if (!ivPart || !ctPart) return payload;
    const iv = new Uint8Array(b64urlDecode(ivPart));
    const ct = new Uint8Array(b64urlDecode(ctPart));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ct,
    );
    return new TextDecoder().decode(pt);
  } catch {
    return "🔒 [κρυπτογραφημένο — βάλε το σωστό Recovery Key]";
  }
}

export async function decryptMessageList<
  T extends { content: string; encrypted?: boolean },
>(messages: T[]): Promise<T[]> {
  return Promise.all(
    messages.map(async (m) => {
      if (!isEncryptedPayload(m.content)) return { ...m, encrypted: false };
      const content = await decryptText(m.content);
      return { ...m, content, encrypted: true };
    }),
  );
}

export async function encryptBytes(
  data: ArrayBuffer | Uint8Array,
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const key = await ensureVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const input =
    data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    input,
  );
  return { iv, ciphertext };
}

export async function decryptBytes(
  iv: Uint8Array,
  ciphertext: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer> {
  const key = await ensureVaultKey();
  const ct =
    ciphertext instanceof Uint8Array
      ? new Uint8Array(ciphertext)
      : new Uint8Array(ciphertext);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    ct,
  );
}

export function packEncryptedBlob(iv: Uint8Array, ciphertext: ArrayBuffer): Blob {
  const ct = new Uint8Array(ciphertext);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return new Blob([out], { type: "application/octet-stream" });
}

export async function unpackEncryptedBlob(blob: Blob): Promise<ArrayBuffer> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length < 13) throw new Error("Invalid encrypted blob");
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  return decryptBytes(iv, ct);
}
