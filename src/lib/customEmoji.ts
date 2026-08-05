import { api, getApiBase } from "./api";

export type CustomEmoji = {
  id: string;
  groupId: string | null;
  name: string;
  mime: string;
  url: string;
  createdBy: string | null;
  createdAt: number;
};

export function emojiImageUrl(emoji: CustomEmoji): string {
  if (emoji.url.startsWith("http")) return emoji.url;
  return `${getApiBase()}${emoji.url}`;
}

export async function fetchCustomEmojis(
  groupId: string | null,
): Promise<CustomEmoji[]> {
  const q =
    groupId && groupId !== "home"
      ? `?groupId=${encodeURIComponent(groupId)}`
      : "";
  const res = await api<{ emojis: CustomEmoji[] }>(`/emoji${q}`);
  return res.emojis;
}

export async function uploadCustomEmoji(
  file: File,
  name: string,
  groupId: string | null,
): Promise<CustomEmoji> {
  const { ensureFreshAccessToken } = await import("./api");
  const { loadTokens } = await import("./authStorage");
  const access =
    (await ensureFreshAccessToken()) ?? (await loadTokens())?.accessToken;
  if (!access) throw new Error("Login required");
  const q = new URLSearchParams({ name: name.toLowerCase() });
  if (groupId && groupId !== "home") q.set("groupId", groupId);
  const res = await fetch(`${getApiBase()}/emoji?${q}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": file.type || "image/png",
    },
    body: file,
  });
  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { emoji: CustomEmoji };
  return data.emoji;
}

export async function deleteCustomEmoji(id: string): Promise<void> {
  await api(`/emoji/${encodeURIComponent(id)}`, { method: "DELETE" });
}
