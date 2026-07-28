/**
 * Zero-knowledge parea vault.
 * - AES-256 key generated on a client, never sent to the server in plaintext.
 * - Password-wrapped copy syncs to server so you can restore on a new device.
 * - Recovery key (= human form of vault) shared out-of-band with friends.
 * - Server only ever sees ciphertext of messages/media.
 */

import { api } from "./api";
import {
  ensureVaultKey,
  setVaultKey,
  encryptText,
  decryptText,
  isEncryptedPayload,
} from "./messageCrypto";

const LOCAL_VAULT = "aegis:vaultKey";
const LOCAL_RECOVERY_SHOWN = "aegis:recoveryShown";

function b64urlEncode(buf: Uint8Array): string {
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
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

/** Human recovery key — encodes the raw 32-byte vault. */
export function vaultToRecoveryKey(rawB64: string): string {
  const bytes = b64urlDecode(rawB64);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const chunks = hex.match(/.{1,4}/g) ?? [];
  return `AEGIS-${chunks.join("-").toUpperCase()}`;
}

export function recoveryKeyToVault(recovery: string): string {
  const cleaned = recovery.trim().replace(/^AEGIS-/i, "").replace(/-/g, "");
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    throw new Error("Μη έγκυρο recovery key");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return b64urlEncode(bytes);
}

async function deriveWrapKey(
  password: string,
  saltB64: string,
): Promise<CryptoKey> {
  const salt = b64urlDecode(saltB64);
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: 310_000,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function wrapVault(
  vaultB64: string,
  password: string,
): Promise<{ salt: string; wrappedVault: string }> {
  const salt = b64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
  const wrapKey = await deriveWrapKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const raw = new Uint8Array(b64urlDecode(vaultB64));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrapKey,
    raw,
  );
  const packed = new Uint8Array(iv.length + new Uint8Array(ct).length);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ct), 12);
  return { salt, wrappedVault: b64urlEncode(packed) };
}

async function unwrapVault(
  wrappedVault: string,
  salt: string,
  password: string,
): Promise<string> {
  const wrapKey = await deriveWrapKey(password, salt);
  const packed = b64urlDecode(wrappedVault);
  const iv = packed.slice(0, 12);
  const ct = packed.slice(12);
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    wrapKey,
    new Uint8Array(ct),
  );
  return b64urlEncode(new Uint8Array(raw));
}

async function persistLocal(vaultB64: string) {
  await setVaultKey(vaultB64);
  try {
    localStorage.setItem(LOCAL_VAULT, vaultB64);
  } catch {
    /* ignore */
  }
  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      const { Store } = await import("@tauri-apps/plugin-store");
      const store = await Store.load("crypto.json");
      await store.set("vault", vaultB64);
      await store.save();
    }
  } catch {
    /* ignore */
  }
}

export async function loadLocalVault(): Promise<string | null> {
  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      const { Store } = await import("@tauri-apps/plugin-store");
      const store = await Store.load("crypto.json");
      const v = await store.get<string>("vault");
      if (v) return v;
    }
  } catch {
    /* fall through */
  }
  try {
    return localStorage.getItem(LOCAL_VAULT);
  } catch {
    return null;
  }
}

export type VaultBootstrapResult = {
  recoveryKey: string | null;
  isNewVault: boolean;
};

/**
 * After login/register: restore or create zero-knowledge vault.
 * @param password login password (wraps vault for this device restore)
 * @param recoveryKey optional — required for new members joining an existing parea
 */
export async function bootstrapVault(opts: {
  password: string;
  recoveryKey?: string;
}): Promise<VaultBootstrapResult> {
  const local = await loadLocalVault();
  if (local) {
    await setVaultKey(local);
    // Refresh wrapped copy on server (password may have been used)
    try {
      const wrapped = await wrapVault(local, opts.password);
      await api("/crypto/me", { method: "PUT", body: wrapped });
    } catch {
      /* offline ok */
    }
    return { recoveryKey: null, isNewVault: false };
  }

  // Try unwrap from server (same user, new browser)
  try {
    const mine = await api<{
      wrappedVault: string | null;
      salt: string | null;
    }>("/crypto/me");
    if (mine.wrappedVault && mine.salt) {
      const vault = await unwrapVault(
        mine.wrappedVault,
        mine.salt,
        opts.password,
      );
      await persistLocal(vault);
      return { recoveryKey: null, isNewVault: false };
    }
  } catch {
    /* continue */
  }

  // Friend joining: recovery key shared out-of-band
  if (opts.recoveryKey?.trim()) {
    const vault = recoveryKeyToVault(opts.recoveryKey);
    await persistLocal(vault);
    const wrapped = await wrapVault(vault, opts.password);
    await api("/crypto/me", { method: "PUT", body: wrapped });
    return { recoveryKey: null, isNewVault: false };
  }

  const status = await api<{
    vaultInitialized: boolean;
    membersWithVault: number;
  }>("/crypto/status");

  if (status.vaultInitialized || status.membersWithVault > 0) {
    throw new Error(
      "Η παρέα έχει ήδη vault. Ζήτα το Recovery Key από κάποιον που είναι ήδη μέσα και βάλε το στο login.",
    );
  }

  // First member: create vault
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const vault = b64urlEncode(bytes);
  await persistLocal(vault);
  const wrapped = await wrapVault(vault, opts.password);
  await api("/crypto/me", { method: "PUT", body: wrapped });
  const recoveryKey = vaultToRecoveryKey(vault);
  try {
    localStorage.setItem(LOCAL_RECOVERY_SHOWN, "0");
  } catch {
    /* ignore */
  }
  return { recoveryKey, isNewVault: true };
}

/** Ensure encrypt path always has a key (local or throw). */
export async function requireVault(): Promise<void> {
  const local = await loadLocalVault();
  if (local) {
    await setVaultKey(local);
    return;
  }
  await ensureVaultKey();
  const raw = localStorage.getItem(LOCAL_VAULT);
  if (!raw) {
    throw new Error("Λείπει το vault — κάνε login με recovery key");
  }
}

export async function getRecoveryKeyForDisplay(): Promise<string | null> {
  const local = await loadLocalVault();
  if (!local) return null;
  return vaultToRecoveryKey(local);
}

export function markRecoverySeen() {
  try {
    localStorage.setItem(LOCAL_RECOVERY_SHOWN, "1");
  } catch {
    /* ignore */
  }
}

export function shouldPromptRecovery(): boolean {
  try {
    return localStorage.getItem(LOCAL_RECOVERY_SHOWN) === "0";
  } catch {
    return false;
  }
}

/** Re-wrap vault after password change (future). */
export async function syncWrappedVault(password: string): Promise<void> {
  const local = await loadLocalVault();
  if (!local) return;
  const wrapped = await wrapVault(local, password);
  await api("/crypto/me", { method: "PUT", body: wrapped });
}

export { encryptText, decryptText, isEncryptedPayload };
