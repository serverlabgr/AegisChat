// Mock data feeding the platform modules (Radio, Games, Dev Portal, Friends, Toolbox)

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  listeners: number;
  color: string;
  live?: boolean;
}

export interface RadioTrack {
  title: string;
  artist: string;
  album: string;
}

export const radioStations: RadioStation[] = [
  { id: "lofi", name: "Lo-Fi Beats", genre: "Chill · Study", listeners: 4, color: "#7c8cff", live: true },
  { id: "synth", name: "Neon Synthwave", genre: "Retro · Drive", listeners: 3, color: "#f472d0" },
  { id: "ost", name: "Game OST Radio", genre: "Epic · Adventure", listeners: 2, color: "#5cc8ff" },
  { id: "phonk", name: "Phonk Garage", genre: "Hard · Hype", listeners: 5, color: "#ffb454" },
  { id: "jazz", name: "Late Night Jazz", genre: "Smooth · Lounge", listeners: 1, color: "#4be0a8" },
  { id: "rock", name: "Indie Rock", genre: "Guitars · Energy", listeners: 2, color: "#ff6b81" },
];

export const radioQueue: RadioTrack[] = [
  { title: "Midnight Protocol", artist: "Kavinsky Jr.", album: "Neon Nights" },
  { title: "Drift Sequence", artist: "Nightcall", album: "Overdrive" },
  { title: "Purple Rain (Synth)", artist: "VHS Dreams", album: "Retrowave 84" },
];

export interface GameServer {
  id: string;
  game: string;
  status: "online" | "offline" | "starting";
  players: number;
  maxPlayers: number;
  region: string;
  node: string;
  cpu: number;
  ram: number;
  icon: string;
}

export const gameServers: GameServer[] = [
  { id: "mc", game: "Minecraft", status: "online", players: 6, maxPlayers: 20, region: "EU-Athens", node: "xeon-2699v4", cpu: 34, ram: 48, icon: "⛏️" },
  { id: "cs", game: "Counter-Strike 2", status: "online", players: 8, maxPlayers: 10, region: "EU-Athens", node: "xeon-2697v3", cpu: 62, ram: 55, icon: "🔫" },
  { id: "valheim", game: "Valheim", status: "starting", players: 0, maxPlayers: 10, region: "EU-Athens", node: "xeon-2667v3", cpu: 12, ram: 20, icon: "🪓" },
  { id: "rust", game: "Rust", status: "offline", players: 0, maxPlayers: 50, region: "EU-Athens", node: "xeon-2697v3", cpu: 0, ram: 0, icon: "🏕️" },
];

export const gameCatalog = [
  { id: "palworld", name: "Palworld", icon: "🐾" },
  { id: "terraria", name: "Terraria", icon: "🌳" },
  { id: "factorio", name: "Factorio", icon: "⚙️" },
  { id: "ark", name: "ARK", icon: "🦖" },
  { id: "enshrouded", name: "Enshrouded", icon: "🌫️" },
  { id: "satisfactory", name: "Satisfactory", icon: "🏭" },
];

export interface ApiKey {
  id: string;
  label: string;
  key: string;
  created: string;
  scopes: string[];
}

export const apiKeys: ApiKey[] = [
  { id: "k1", label: "Bot · PartyBot", key: "aeg_live_8f3kQm2xVr7Lp0Wd9vQ2", created: "πριν 3 μέρες", scopes: ["messages", "voice"] },
  { id: "k2", label: "Webhook · CI", key: "aeg_live_2m1aZk8sBt4Ny6Jc7pLx", created: "πριν 2 βδομάδες", scopes: ["webhooks"] },
];

export interface Bot {
  id: string;
  name: string;
  desc: string;
  online: boolean;
  icon: string;
}

export const bots: Bot[] = [
  { id: "b1", name: "PartyBot", desc: "Μουσική & queue στα voice", online: true, icon: "🎵" },
  { id: "b2", name: "ModGuard", desc: "Auto-moderation & logs", online: true, icon: "🛡️" },
  { id: "b3", name: "StatBot", desc: "Game stats & leaderboards", online: false, icon: "📊" },
];

export interface Webhook {
  id: string;
  name: string;
  target: string;
  events: number;
}

export const webhooks: Webhook[] = [
  { id: "w1", name: "GitHub → #dev-talk", target: "https://…/hooks/gh", events: 128 },
  { id: "w2", name: "Uptime → #general", target: "https://…/hooks/up", events: 42 },
];

import type { Channel } from "./mock";

/** Home community («η παρέα») — global channels with group_id NULL on server. */
export const HOME_SERVER_ID = "home";

/** Discord-style personal / DM inbox space. */
export const PERSONAL_SPACE_ID = "personal";

export interface Group {
  id: string;
  name: string;
  tag: string;
  members: string[];
  activity: string;
  color: string;
  /** Discord-like channel tree for this server/group */
  channels?: Channel[];
}

export function channelsForGroup(group: Group): Channel[] {
  return group.channels ?? [];
}

export function makeGroupChannels(groupId: string, name: string): Channel[] {
  return [
    {
      id: `${groupId}:general`,
      name: "general",
      type: "text",
      topic: `Καλώς ήρθατε στο ${name}`,
    },
    {
      id: `${groupId}:chat`,
      name: "chat",
      type: "text",
      topic: "Κουβέντα της παρέας",
    },
    {
      id: `${groupId}:voice`,
      name: "Lounge",
      type: "voice",
    },
  ];
}

export const groups: Group[] = [
  {
    id: "gr1",
    name: "Ranked Grinders",
    tag: "CS2 · 5-stack",
    members: ["u1", "u2", "u4"],
    activity: "3 online · σε παιχνίδι",
    color: "#5cc8ff",
    channels: makeGroupChannels("gr1", "Ranked Grinders"),
  },
  {
    id: "gr2",
    name: "Minecraft SMP",
    tag: "Survival",
    members: ["u1", "u3", "u4", "u5"],
    activity: "6 στον server",
    color: "#4be0a8",
    channels: makeGroupChannels("gr2", "Minecraft SMP"),
  },
  {
    id: "gr3",
    name: "Movie Nights",
    tag: "Watch party",
    members: ["u2", "u3", "u5"],
    activity: "Παρασκευή 21:00",
    color: "#f472d0",
    channels: makeGroupChannels("gr3", "Movie Nights"),
  },
];

export interface FriendInvite {
  id: string;
  code: string;
  uses: number;
  maxUses: number;
  expires: string;
}

export const inviteLinks: FriendInvite[] = [
  { id: "i1", code: "aegis.gg/parea-x9f2", uses: 3, maxUses: 10, expires: "σε 7 μέρες" },
  { id: "i2", code: "aegis.gg/lan-night", uses: 8, maxUses: 8, expires: "έληξε" },
];

export interface PendingRequest {
  id: string;
  name: string;
  mutual: number;
  direction: "incoming" | "outgoing";
  color: string;
}

export const pendingRequests: PendingRequest[] = [
  { id: "p1", name: "Giannis", mutual: 4, direction: "incoming", color: "#7aa2f7" },
  { id: "p2", name: "Sofia", mutual: 2, direction: "incoming", color: "#f472d0" },
  { id: "p3", name: "Panos", mutual: 6, direction: "outgoing", color: "#ffb454" },
];

// "Now playing" for friends — makes the friend list richer than a plain roster
export const nowPlaying: Record<string, string> = {
  u2: "Counter-Strike 2",
  u4: "Minecraft",
  u5: "Spotify · Lo-Fi",
};
