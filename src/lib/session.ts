import { api, type ApiUser } from "./api";
import { loadTokens } from "./authStorage";
import type { Message, User, UserStatus, DMConversation, Channel } from "../data/mock";
import type { FriendInvite, Group, PendingRequest } from "../data/modules";
import { makeGroupChannels } from "../data/modules";
import { decryptMessageList } from "./messageCrypto";
import { loadLocalVault } from "./vault";
import { setVaultKey } from "./messageCrypto";

export function toLocalUser(u: ApiUser): User {
  return {
    id: u.id,
    name: u.displayName || u.username,
    status: (u.status as UserStatus) || "offline",
    role: u.role,
    color: u.color,
    bio: u.bio,
  };
}

export type BootstrapPayload = {
  me: User;
  users: Record<string, User>;
  memberIds: string[];
  /** Home server channels (no group) */
  channels: Channel[];
  dms: DMConversation[];
  messagesByChannel: Record<string, Message[]>;
  dmMessages: Record<string, Message[]>;
  requests: PendingRequest[];
  invites: FriendInvite[];
  groups: Group[];
};

async function activateLocalVault(): Promise<boolean> {
  const local = await loadLocalVault();
  if (!local) return false;
  await setVaultKey(local);
  return true;
}

export async function tryRestoreSession(): Promise<BootstrapPayload | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;
  const hasVault = await activateLocalVault();
  if (!hasVault) {
    // Tokens alone aren't enough — need vault on this device
    return null;
  }
  try {
    const { user } = await api<{ user: ApiUser }>("/auth/me");
    return bootstrapForUser(user);
  } catch {
    return null;
  }
}

export async function bootstrapForUser(meApi: ApiUser): Promise<BootstrapPayload> {
  await activateLocalVault();
  const me = toLocalUser(meApi);
  const [usersRes, friendsRes, channelsRes, requestsRes, invitesRes, groupsRes, dmsRes] =
    await Promise.all([
      api<{ users: ApiUser[] }>("/friends/users"),
      api<{ friends: ApiUser[] }>("/friends"),
      api<{
        channels: {
          id: string;
          name: string;
          type: string;
          topic?: string;
          groupId?: string | null;
        }[];
      }>("/channels"),
      api<{
        requests: {
          id: string;
          name: string;
          mutual: number;
          direction: "incoming" | "outgoing";
          color: string;
        }[];
      }>("/friends/requests"),
      api<{
        invites: {
          id: string;
          code: string;
          uses: number;
          maxUses: number;
          expires: string;
        }[];
      }>("/friends/invites"),
      api<{
        groups: {
          id: string;
          name: string;
          tag: string;
          members: string[];
          activity: string;
          color: string;
          channels?: Channel[];
        }[];
      }>("/friends/groups"),
      api<{ dms: { id: string; userId: string }[] }>("/dms"),
    ]);

  const users: Record<string, User> = {};
  for (const u of usersRes.users) users[u.id] = toLocalUser(u);
  users[me.id] = me;

  const friendIds = friendsRes.friends.map((f) => f.id);
  // Roster = me + friends only (not every account on the server)
  const memberIds = Array.from(new Set([me.id, ...friendIds]));
  for (const id of friendIds) {
    const f = friendsRes.friends.find((x) => x.id === id);
    if (f) users[id] = toLocalUser(f);
  }

  const homeChannels: Channel[] = channelsRes.channels
    .filter((c) => !c.groupId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as "text" | "voice",
      topic: c.topic,
    }));

  const textChannels = homeChannels.filter((c) => c.type === "text");
  // Also load group text channels for history
  const groupText = channelsRes.channels.filter(
    (c) => c.type === "text" && c.groupId,
  );
  const allText = [...textChannels, ...groupText];
  const messagesByChannel: Record<string, Message[]> = {};
  await Promise.all(
    allText.map(async (ch) => {
      const { messages } = await api<{ messages: Message[] }>(
        `/channels/${encodeURIComponent(ch.id)}/messages`,
      );
      messagesByChannel[ch.id] = await decryptMessageList(messages);
    }),
  );

  const dmMessages: Record<string, Message[]> = {};
  const dms: DMConversation[] = dmsRes.dms;
  await Promise.all(
    dms.map(async (dm) => {
      const { messages } = await api<{ messages: Message[] }>(
        `/dms/${encodeURIComponent(dm.id)}/messages`,
      );
      dmMessages[dm.id] = await decryptMessageList(messages);
    }),
  );

  const groups: Group[] = groupsRes.groups.map((g) => ({
    ...g,
    channels:
      g.channels?.length ? g.channels : makeGroupChannels(g.id, g.name),
  }));

  return {
    me,
    users,
    memberIds,
    channels: homeChannels,
    dms,
    messagesByChannel,
    dmMessages,
    requests: requestsRes.requests,
    invites: invitesRes.invites.map((i) => ({
      id: i.id,
      code: i.code,
      uses: i.uses,
      maxUses: i.maxUses,
      expires: i.expires,
    })),
    groups,
  };
}

/** Refetch + decrypt recent history for catch-up after WS reconnect. */
export async function fetchChannelMessages(
  channelId: string,
): Promise<Message[]> {
  const { messages } = await api<{ messages: Message[] }>(
    `/channels/${encodeURIComponent(channelId)}/messages`,
  );
  return decryptMessageList(messages);
}

export async function fetchDmMessages(threadId: string): Promise<Message[]> {
  const { messages } = await api<{ messages: Message[] }>(
    `/dms/${encodeURIComponent(threadId)}/messages`,
  );
  return decryptMessageList(messages);
}
