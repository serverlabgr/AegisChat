// Mock data feeding the platform modules (Radio, Games, Dev Portal, Friends, Toolbox)

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  listeners: number;
  color: string;
  live?: boolean;
  /** Public stream URL (HTML5 audio) */
  streamUrl?: string;
  country?: string;
}

export interface RadioTrack {
  title: string;
  artist: string;
  album: string;
}

/** Ελληνικοί live σταθμοί — δημόσιες ροές MP3/AAC */
export const radioStations: RadioStation[] = [
  {
    id: "skai",
    name: "ΣΚΑΪ 100.3",
    genre: "Ειδήσεις · Ψυχαγωγία",
    listeners: 0,
    color: "#0066cc",
    live: true,
    country: "GR",
    streamUrl: "https://skai.live24.gr/skai1003",
  },
  {
    id: "ert-proto",
    name: "ΕΡΑ Πρώτο",
    genre: "Δημόσιο · Ειδήσεις",
    listeners: 0,
    color: "#1e88e5",
    live: true,
    country: "GR",
    streamUrl: "http://radiostreaming.ert.gr/ert-proto",
  },
  {
    id: "ert-deftero",
    name: "ΕΡΑ Δεύτερο",
    genre: "Λαϊκά · Ελληνικά",
    listeners: 0,
    color: "#43a047",
    live: true,
    country: "GR",
    streamUrl: "http://radiostreaming.ert.gr/ert-deftero",
  },
  {
    id: "ert-trito",
    name: "ΕΡΑ Τρίτο",
    genre: "Πολιτισμός · Κλασική",
    listeners: 0,
    color: "#8e24aa",
    live: true,
    country: "GR",
    streamUrl: "http://radiostreaming.ert.gr/ert-trito",
  },
  {
    id: "ert-kosmos",
    name: "ΕΡΑ Kosmos",
    genre: "World · Ethnic",
    listeners: 0,
    color: "#ff7043",
    live: true,
    country: "GR",
    streamUrl: "http://radiostreaming.ert.gr/ert-kosmos",
  },
  {
    id: "ert-sport",
    name: "ΕΡΑ Sport",
    genre: "Αθλητικά",
    listeners: 0,
    color: "#e53935",
    live: true,
    country: "GR",
    streamUrl: "http://radiostreaming.ert.gr/ert-sport",
  },
  {
    id: "realfm",
    name: "Real FM 97.8",
    genre: "Ειδήσεις · Talk",
    listeners: 0,
    color: "#1565c0",
    live: true,
    country: "GR",
    streamUrl: "http://netradio.live24.gr/realfm",
  },
  {
    id: "sportfm",
    name: "Sport FM 94.6",
    genre: "Αθλητικά",
    listeners: 0,
    color: "#c62828",
    live: true,
    country: "GR",
    streamUrl: "http://netradio.live24.gr/sportfm7712",
  },
  {
    id: "melodia",
    name: "Melodia 99.2",
    genre: "Έντεχνο · Ελληνικά",
    listeners: 0,
    color: "#7b1fa2",
    live: true,
    country: "GR",
    streamUrl: "http://netradio.live24.gr/melodia992",
  },
  {
    id: "loveradio",
    name: "Love Radio 97.5",
    genre: "Pop · Hits",
    listeners: 0,
    color: "#ec407a",
    live: true,
    country: "GR",
    streamUrl: "http://netradio.live24.gr/loveradio-1000",
  },
  {
    id: "rythmos",
    name: "Rythmos 94.9",
    genre: "Greek Pop",
    listeners: 0,
    color: "#ff9800",
    live: true,
    country: "GR",
    streamUrl: "http://stream.radiojar.com/aw1w2xfx1vduv",
  },
  {
    id: "dromos",
    name: "Dromos 89.8",
    genre: "Greek · Pop",
    listeners: 0,
    color: "#26a69a",
    live: true,
    country: "GR",
    streamUrl: "http://netradio.live24.gr/dromos893",
  },
  {
    id: "custom",
    name: "Custom URL",
    genre: "Δική σου ροή",
    listeners: 0,
    color: "#ffb454",
    country: "GR",
  },
];

export const radioQueue: RadioTrack[] = [
  { title: "Live", artist: "Ελληνικό ραδιόφωνο", album: "Aegis Radio" },
];

export interface GameServer {
  id: string;
  game: string;
  status: "online" | "offline" | "starting" | "stopping";
  players: number;
  maxPlayers: number;
  region: string;
  node: string;
  cpu: number;
  ram: number;
  icon: string;
  templateId?: string;
  notes?: string;
}

export const gameServers: GameServer[] = [];

export const gameCatalog = [
  { id: "minecraft", name: "Minecraft", icon: "⛏️" },
  { id: "cs2", name: "Counter-Strike 2", icon: "🔫" },
  { id: "valheim", name: "Valheim", icon: "🪓" },
  { id: "rust", name: "Rust", icon: "🏕️" },
  { id: "terraria", name: "Terraria", icon: "🌳" },
  { id: "factorio", name: "Factorio", icon: "⚙️" },
];

export interface ApiKey {
  id: string;
  label: string;
  key: string;
  created: string;
  scopes: string[];
}

export const apiKeys: ApiKey[] = [];

export interface Bot {
  id: string;
  name: string;
  desc: string;
  online: boolean;
  icon: string;
}

export const bots: Bot[] = [];

export interface Webhook {
  id: string;
  name: string;
  target: string;
  events: number;
}

export const webhooks: Webhook[] = [];

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
