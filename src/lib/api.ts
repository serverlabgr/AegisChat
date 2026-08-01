import { clearTokens, loadTokens, saveTokens, type TokenPair } from "./authStorage";
import { loadServerUrl } from "./serverConfig";

/** Always read live — user can change server URL on the connect screen. */
export function getApiBase(): string {
  return loadServerUrl();
}

export type ApiUser = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  color: string;
  role: string;
  status: string;
  avatarUrl: string | null;
};

export type AuthResponse = {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
};

type RequestOpts = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  token?: string;
};

let refreshInFlight: Promise<TokenPair | null> | null = null;

/** Refresh access token if needed; returns a usable access token or null. */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const current = await loadTokens();
  if (!current) return null;
  // Always try refresh on reconnect paths — cheap if still valid via WS 401.
  const next = await refreshTokens();
  if (next) return next.accessToken;
  // refreshTokens clears on hard failure; re-read in case refresh wasn't needed
  const again = await loadTokens();
  return again?.accessToken ?? null;
}

async function refreshTokens(): Promise<TokenPair | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = await loadTokens();
    if (!current) return null;
    try {
      const res = await fetch(`${getApiBase()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) {
        await clearTokens();
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      const pair = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
      await saveTokens(pair);
      return pair;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function api<T>(
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  } else if (opts.auth !== false) {
    const tokens = await loadTokens();
    if (tokens?.accessToken) {
      headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error(
      `Δεν συνδέεται το API (${getApiBase()}). Έλεγξε το Server URL ή τρέξε: npm run server:dev`,
    );
  }

  if (res.status === 401 && opts.auth !== false && !opts.token) {
    const next = await refreshTokens();
    if (next) {
      return api<T>(path, { ...opts, token: next.accessToken });
    }
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const data = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
    auth: false,
  });
  await saveTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return data;
}

export async function register(input: {
  inviteCode: string;
  username: string;
  password: string;
  displayName?: string;
}): Promise<AuthResponse> {
  const data = await api<AuthResponse>("/auth/register", {
    method: "POST",
    body: input,
    auth: false,
  });
  await saveTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return data;
}

export async function logout(): Promise<void> {
  const tokens = await loadTokens();
  try {
    if (tokens) {
      await api("/auth/logout", {
        method: "POST",
        body: { refreshToken: tokens.refreshToken },
      });
    }
  } catch {
    /* ignore */
  }
  await clearTokens();
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api("/auth/password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

export function wsUrl(accessToken: string): string {
  const base = getApiBase().replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(accessToken)}`;
}
