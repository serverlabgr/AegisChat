import { useEffect, useRef } from "react";
import { useStore } from "../../store/store";
import { measureNetworkPing, peerBasePing } from "../../lib/ping";

const INTERVAL_MS = 4000;

/**
 * Keeps each online user's `ping` fresh:
 * - current user → real network RTT
 * - other peers → live estimate around a stable per-user base
 *   (replaced by real peer RTT once P2P/host is wired)
 */
export function PingTicker() {
  const { currentUserId, memberIds, users, setUserPing, onlineMode } = useStore();
  const usersRef = useRef(users);
  usersRef.current = users;

  useEffect(() => {
    if (onlineMode) return; // server WS pong drives HUD ping
    let cancelled = false;

    const tick = async () => {
      const measured = await measureNetworkPing();
      if (cancelled) return;

      if (measured != null) {
        setUserPing(currentUserId, measured);
      }

      const snapshot = usersRef.current;
      for (const id of memberIds) {
        if (id === currentUserId) continue;
        const user = snapshot[id];
        if (!user || user.status === "offline") {
          setUserPing(id, null);
          continue;
        }
        const base = peerBasePing(id);
        const drift = Math.round((Math.random() - 0.5) * 10);
        setUserPing(id, Math.max(8, base + drift));
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentUserId, memberIds, setUserPing, onlineMode]);

  return null;
}
