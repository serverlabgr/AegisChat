import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVars } from "../auth.js";
import { query } from "../db.js";

export const embedRoutes = new Hono<AuthVars>();
embedRoutes.use("*", requireAuth);

const URL_RE = /^https?:\/\/[^\s<>"]{4,500}$/i;

function pickMeta(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    "i",
  );
  return re.exec(html)?.[1] ?? re2.exec(html)?.[1] ?? null;
}

embedRoutes.get("/", async (c) => {
  const url = String(c.req.query("url") ?? "").trim();
  if (!URL_RE.test(url)) return c.json({ error: "Invalid URL" }, 400);

  const cached = await query(
    `SELECT url, title, description, image_url, site_name, fetched_at
     FROM link_embeds WHERE url = $1`,
    [url],
  );
  if (cached.rows[0]) {
    const age =
      Date.now() - new Date(cached.rows[0].fetched_at as string).getTime();
    if (age < 7 * 24 * 3600_000) {
      return c.json({
        embed: {
          url: cached.rows[0].url,
          title: cached.rows[0].title,
          description: cached.rows[0].description,
          imageUrl: cached.rows[0].image_url,
          siteName: cached.rows[0].site_name,
        },
      });
    }
  }

  let html = "";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "AegisBot/1.0 (+https://aegis.local)" },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return c.json({ embed: null });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return c.json({ embed: null });
    }
    html = (await res.text()).slice(0, 200_000);
  } catch {
    return c.json({ embed: null });
  }

  const title =
    pickMeta(html, "og:title") ??
    /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]?.trim() ??
    null;
  const description =
    pickMeta(html, "og:description") ?? pickMeta(html, "description");
  const imageUrl = pickMeta(html, "og:image");
  const siteName = pickMeta(html, "og:site_name");

  await query(
    `INSERT INTO link_embeds (url, title, description, image_url, site_name, fetched_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (url) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       image_url = EXCLUDED.image_url,
       site_name = EXCLUDED.site_name,
       fetched_at = now()`,
    [url, title, description, imageUrl, siteName],
  );

  return c.json({
    embed: { url, title, description, imageUrl, siteName },
  });
});

/** Validate helper for tests */
export const embedUrlSchema = z.string().url();
