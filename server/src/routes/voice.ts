import { Hono } from "hono";
import { requireAuth, type AuthVars } from "../auth.js";
import { config } from "../config.js";

export const voiceRoutes = new Hono<AuthVars>();

/** ICE servers for WebRTC (STUN + optional TURN/coturn). */
voiceRoutes.get("/ice", requireAuth, async (c) => {
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];
  if (config.turnUrls.length) {
    iceServers.push({
      urls: config.turnUrls,
      username: config.turnUsername || undefined,
      credential: config.turnCredential || undefined,
    });
  }
  return c.json({ iceServers });
});

type RTCIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};
