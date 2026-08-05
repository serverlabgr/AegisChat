import type { User } from "../data/mock";

/** Insert token for a user mention (stable across renames). */
export function mentionToken(userId: string): string {
  return `<@${userId}>`;
}

const MENTION_RE = /<@([0-9a-f-]{36})>/gi;
const AT_EVERYONE = /@everyone\b/gi;

/** Extract mentioned user ids from plaintext (before encrypt). */
export function extractMentionUserIds(
  text: string,
  users: Record<string, User>,
  everyoneMeans: string[],
): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) {
    if (users[m[1]]) ids.add(m[1]);
  }
  if (AT_EVERYONE.test(text)) {
    for (const id of everyoneMeans) ids.add(id);
  }
  AT_EVERYONE.lastIndex = 0;
  // Also match bare @DisplayName / @username for convenience
  for (const u of Object.values(users)) {
    const name = u.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (name && new RegExp(`(^|\\s)@${name}\\b`, "i").test(text)) {
      ids.add(u.id);
    }
  }
  return [...ids];
}

export type TextPart =
  | { kind: "text"; value: string }
  | { kind: "mention"; userId: string }
  | { kind: "everyone" }
  | { kind: "customEmoji"; name: string };

/** Split message text into renderable parts (mentions + :shortcode:). */
export function parseMessageParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /<@([0-9a-f-]{36})>|@everyone|:([a-z0-9_]{2,32}):/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ kind: "text", value: text.slice(last, m.index) });
    }
    if (m[0].toLowerCase() === "@everyone") {
      parts.push({ kind: "everyone" });
    } else if (m[1]) {
      parts.push({ kind: "mention", userId: m[1] });
    } else if (m[2]) {
      parts.push({ kind: "customEmoji", name: m[2].toLowerCase() });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push({ kind: "text", value: text.slice(last) });
  }
  return parts.length ? parts : [{ kind: "text", value: text }];
}
