import { query } from "./db.js";

/** Home server id used by the client for group_id NULL channels. */
export const HOME_GROUP_ID = "home";

export function resolveGroupId(
  groupId: string | null | undefined,
): string | null {
  if (!groupId || groupId === HOME_GROUP_ID) return null;
  return groupId;
}

/** Group member (or Admin for home). */
export async function isGroupMember(
  userId: string,
  groupId: string | null,
): Promise<boolean> {
  if (groupId == null) return true; // home is open to all authenticated users
  const { rows } = await query(
    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
  return rows.length > 0;
}

/**
 * Can create/edit/delete channels (and rename group):
 * - home (null): Admin role
 * - group: must be member AND created_by
 */
export async function canManageChannels(
  userId: string,
  groupId: string | null,
): Promise<boolean> {
  if (groupId == null) {
    const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [
      userId,
    ]);
    const role = String(rows[0]?.role ?? "");
    return role.toLowerCase() === "admin";
  }
  const { rows } = await query(
    `SELECT g.created_by
     FROM groups g
     INNER JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
     WHERE g.id = $2`,
    [userId, groupId],
  );
  if (!rows[0]) return false;
  return rows[0].created_by === userId;
}

/** Pin / moderate messages: Admin, Mod (home), or group owner. */
export async function canModerate(
  userId: string,
  groupId: string | null,
): Promise<boolean> {
  if (await canManageChannels(userId, groupId)) return true;
  if (groupId == null) {
    const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [
      userId,
    ]);
    const role = String(rows[0]?.role ?? "").toLowerCase();
    return role === "mod" || role === "moderator";
  }
  return false;
}

export function channelSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "channel";
}

export async function uniqueChannelId(
  groupId: string | null,
  name: string,
): Promise<string> {
  const slug = channelSlug(name);
  const prefix = groupId ? `${groupId}:` : "";
  let candidate = `${prefix}${slug}`;
  for (let i = 0; i < 8; i++) {
    const { rows } = await query(`SELECT 1 FROM channels WHERE id = $1`, [
      candidate,
    ]);
    if (!rows.length) return candidate;
    candidate = `${prefix}${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${prefix}${slug}-${Date.now().toString(36)}`;
}
