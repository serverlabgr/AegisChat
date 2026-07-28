const KEY = "aegis:serverUrl";

const DEFAULT_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://192.168.1.235:3001";

export function getDefaultServerUrl(): string {
  return DEFAULT_URL;
}

export function loadServerUrl(): string {
  try {
    const stored = localStorage.getItem(KEY)?.replace(/\/$/, "") || "";
    // Migrate old local-dev default to the configured server
    if (
      !stored ||
      stored === "http://localhost:3001" ||
      stored === "http://127.0.0.1:3001"
    ) {
      return DEFAULT_URL;
    }
    return stored;
  } catch {
    return DEFAULT_URL;
  }
}

export function saveServerUrl(url: string): void {
  const cleaned = url.trim().replace(/\/$/, "");
  localStorage.setItem(KEY, cleaned || DEFAULT_URL);
}
