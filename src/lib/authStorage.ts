const ACCESS = "aegis:access";
const REFRESH = "aegis:refresh";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

async function tauriStore(): Promise<{
  get: (k: string) => Promise<string | null>;
  set: (k: string, v: string) => Promise<void>;
  delete: (k: string) => Promise<void>;
} | null> {
  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (!isTauri()) return null;
    const { Store } = await import("@tauri-apps/plugin-store");
    const store = await Store.load("auth.json");
    return {
      get: async (k) => (await store.get<string>(k)) ?? null,
      set: async (k, v) => {
        await store.set(k, v);
        await store.save();
      },
      delete: async (k) => {
        await store.delete(k);
        await store.save();
      },
    };
  } catch {
    return null;
  }
}

export async function loadTokens(): Promise<TokenPair | null> {
  const store = await tauriStore();
  if (store) {
    const accessToken = await store.get(ACCESS);
    const refreshToken = await store.get(REFRESH);
    if (accessToken && refreshToken) return { accessToken, refreshToken };
    return null;
  }
  const accessToken = localStorage.getItem(ACCESS);
  const refreshToken = localStorage.getItem(REFRESH);
  if (accessToken && refreshToken) return { accessToken, refreshToken };
  return null;
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  const store = await tauriStore();
  if (store) {
    await store.set(ACCESS, tokens.accessToken);
    await store.set(REFRESH, tokens.refreshToken);
    return;
  }
  localStorage.setItem(ACCESS, tokens.accessToken);
  localStorage.setItem(REFRESH, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  const store = await tauriStore();
  if (store) {
    await store.delete(ACCESS);
    await store.delete(REFRESH);
    return;
  }
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}
