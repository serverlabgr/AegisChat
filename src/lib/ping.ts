/** Measure round-trip latency to a public edge (ms). Returns null if offline. */
export async function measureNetworkPing(): Promise<number | null> {
  const endpoints = [
    "https://www.cloudflare.com/cdn-cgi/trace",
    "https://1.1.1.1/cdn-cgi/trace",
  ];

  for (const url of endpoints) {
    try {
      const t0 = performance.now();
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        credentials: "omit",
      });
      // Consume body so we include full RTT, not just TTFB of headers.
      await res.arrayBuffer();
      if (!res.ok) continue;
      return Math.max(1, Math.round(performance.now() - t0));
    } catch {
      // try next endpoint
    }
  }

  // Last resort: local origin (always available in Vite / Tauri webview).
  try {
    const t0 = performance.now();
    await fetch(`${window.location.origin}/?_aegis_ping=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
    });
    return Math.max(1, Math.round(performance.now() - t0));
  } catch {
    return null;
  }
}

export type PingTone = "ok" | "warn" | "danger" | "dim" | "default";

export function pingTone(ms: number | null): PingTone {
  if (ms == null) return "dim";
  if (ms < 50) return "ok";
  if (ms < 120) return "default";
  if (ms < 200) return "warn";
  return "danger";
}

/** Stable base latency per user id (for peers until real P2P RTT exists). */
export function peerBasePing(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return 18 + (h % 55); // 18–72ms
}
