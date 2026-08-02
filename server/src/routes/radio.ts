import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { getRadioState, setRadioState } from "../ws.js";

export const radioRoutes = new Hono<AuthVars>();
radioRoutes.use("*", requireAuth);

radioRoutes.get("/state", (c) => c.json({ state: getRadioState() }));

radioRoutes.post("/state", async (c) => {
  const body = z
    .object({
      trackUrl: z.string().max(2000).optional(),
      title: z.string().trim().min(1).max(200).optional(),
      playing: z.boolean().optional(),
      position: z.number().min(0).max(86400).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);
  const state = setRadioState(body.data, c.get("userId"));
  return c.json({ state });
});
