import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { getRadioState, setRadioState } from "../ws.js";

export const radioRoutes = new Hono<AuthVars>();
radioRoutes.use("*", requireAuth);

const RB_USER_AGENT = "AegisChat/1.0 (github.com/serverlabgr/AegisChat)";

type BrowseStation = {
  id: string;
  name: string;
  genre: string;
  streamUrl: string;
  codec: string;
  bitrate: number;
};

let browseCache: { at: number; stations: BrowseStation[] } | null = null;

radioRoutes.get("/state", (c) => c.json({ state: getRadioState() }));

radioRoutes.get("/stations", async (c) => {
  const now = Date.now();
  if (!browseCache || now - browseCache.at > 60 * 60 * 1000) {
    try {
      const res = await fetch(
        "https://de1.api.radio-browser.info/json/stations/search?country=Greece&limit=48&order=clickcount&reverse=true",
        { headers: { "User-Agent": RB_USER_AGENT } },
      );
      if (!res.ok) throw new Error(`radio-browser ${res.status}`);
      const raw = (await res.json()) as {
        stationuuid?: string;
        name?: string;
        url?: string;
        tags?: string;
        codec?: string;
        bitrate?: number;
        clickcount?: number;
      }[];
      browseCache = {
        at: now,
        stations: raw
          .filter((s) => s.url && /^https?:\/\//i.test(s.url))
          .map((s) => ({
            id: s.stationuuid ?? s.url!,
            name: (s.name ?? "Σταθμός").trim(),
            genre: (s.tags ?? "Greece").split(",").slice(0, 3).join(" · "),
            streamUrl: s.url!.trim(),
            codec: s.codec ?? "MP3",
            bitrate: s.bitrate ?? 0,
          })),
      };
    } catch {
      return c.json({ stations: browseCache?.stations ?? [] });
    }
  }
  return c.json({ stations: browseCache.stations });
});

radioRoutes.post("/state", async (c) => {
  const body = z
    .object({
      trackUrl: z.string().max(2000).optional(),
      title: z.string().trim().min(1).max(200).optional(),
      playing: z.boolean().optional(),
      position: z.number().min(0).max(86400).optional(),
      source: z.enum(["stream", "spotify"]).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  const state = setRadioState(body.data, c.get("userId"));
  return c.json({ state });
});
