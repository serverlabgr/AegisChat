export type SpotifyEmbed =
  | { kind: "playlist"; id: string; embedUrl: string; openUrl: string }
  | { kind: "album"; id: string; embedUrl: string; openUrl: string }
  | { kind: "track"; id: string; embedUrl: string; openUrl: string }
  | { kind: "show"; id: string; embedUrl: string; openUrl: string }
  | { kind: "episode"; id: string; embedUrl: string; openUrl: string };

const SPOTIFY_HOST = "open.spotify.com";

/** Parse open.spotify.com or spotify: URIs into embed + open URLs. */
export function parseSpotifyInput(raw: string): SpotifyEmbed | null {
  const input = raw.trim();
  if (!input) return null;

  const uriMatch = input.match(
    /^spotify:(playlist|album|track|show|episode):([a-zA-Z0-9]+)$/i,
  );
  if (uriMatch) {
    const kind = uriMatch[1].toLowerCase() as SpotifyEmbed["kind"];
    const id = uriMatch[2];
    return makeEmbed(kind, id);
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!url.hostname.replace(/^www\./, "").includes(SPOTIFY_HOST)) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const kind = parts[0].toLowerCase();
  const id = parts[1].split("?")[0];
  if (
    kind !== "playlist" &&
    kind !== "album" &&
    kind !== "track" &&
    kind !== "show" &&
    kind !== "episode"
  ) {
    return null;
  }
  return makeEmbed(kind, id);
}

function makeEmbed(
  kind: SpotifyEmbed["kind"],
  id: string,
): SpotifyEmbed {
  const openUrl = `https://open.spotify.com/${kind}/${id}`;
  const embedUrl = `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=0`;
  return { kind, id, embedUrl, openUrl } as SpotifyEmbed;
}

export function isSpotifyTrackUrl(url: string): boolean {
  return parseSpotifyInput(url) !== null;
}
