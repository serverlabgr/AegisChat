import { config } from "../config.js";

export type PteroSignal = "start" | "stop" | "restart" | "kill";

/** Send power signal to a Pterodactyl server (Client API). Returns false if not configured. */
export async function pterodactylPower(
  serverIdentifier: string,
  signal: PteroSignal,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = config.pterodactylUrl?.replace(/\/$/, "");
  const key = config.pterodactylClientKey;
  if (!base || !key) {
    return { ok: false, error: "Pterodactyl δεν είναι ρυθμισμένο στο server (PTERODACTYL_URL + PTERODACTYL_CLIENT_KEY)" };
  }
  if (!serverIdentifier.trim()) {
    return { ok: false, error: "Λείπει Pterodactyl server ID" };
  }

  const url = `${base}/api/client/servers/${encodeURIComponent(serverIdentifier)}/power`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signal }),
    });
    if (res.status === 204 || res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: text.slice(0, 200) || `Pterodactyl HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Pterodactyl request failed",
    };
  }
}

export function pterodactylConfigured(): boolean {
  return Boolean(config.pterodactylUrl && config.pterodactylClientKey);
}
