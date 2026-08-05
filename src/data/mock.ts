export type UserStatus = "online" | "away" | "busy" | "offline";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
  role?: string;
  color: string;
  bio?: string;
  /** Rich presence e.g. Playing Minecraft */
  activity?: string | null;
}

export interface Channel {
  id: string;
  name: string;
  type: "text" | "voice";
  topic?: string;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
  encrypted: boolean;
  edited?: boolean;
  reactions: Reaction[];
  system?: boolean;
  replyToId?: string;
  mentionUserIds?: string[];
}

export interface DMConversation {
  id: string;
  userId: string;
}

export const CURRENT_USER_ID = "u1";

export const users: Record<string, User> = {
  u1: { id: "u1", name: "Nikos", status: "online", role: "Admin", color: "#6ec4ae", bio: "Ο host της παρέας 🎮" },
  u2: { id: "u2", name: "Alex", status: "online", color: "#7aa2f7", bio: "Gaming όλη μέρα." },
  u3: { id: "u3", name: "Maria", status: "away", color: "#bb9af7", bio: "Καφές & memes." },
  u4: { id: "u4", name: "Kostas", status: "online", color: "#e0af68", bio: "Πάντα για ranked." },
  u5: { id: "u5", name: "Elena", status: "busy", color: "#f7768e", bio: "Designer." },
  u6: { id: "u6", name: "Dimitris", status: "offline", color: "#9ece6a", bio: "" },
};

export const memberIds = ["u1", "u2", "u3", "u4", "u5", "u6"];

export const textChannels: Channel[] = [
  { id: "general", name: "general", type: "text", topic: "Γενική κουβέντα της παρέας" },
  { id: "gaming", name: "gaming", type: "text", topic: "Gaming sessions & LFG" },
  { id: "dev", name: "dev-talk", type: "text", topic: "Παιχνίδια, mods & tech" },
  { id: "random", name: "random", type: "text", topic: "Ό,τι να 'ναι" },
];

export const voiceChannels: Channel[] = [
  { id: "voice-lounge", name: "Lounge", type: "voice" },
  { id: "voice-gaming", name: "Gaming", type: "voice" },
];

export const dmConversations: DMConversation[] = [
  { id: "dm-u2", userId: "u2" },
  { id: "dm-u3", userId: "u3" },
  { id: "dm-u4", userId: "u4" },
];

const now = Date.now();
const min = 60_000;

function msg(
  id: string,
  authorId: string,
  content: string,
  minutesAgo: number,
  reactions: Reaction[] = [],
): Message {
  return {
    id,
    authorId,
    content,
    timestamp: now - minutesAgo * min,
    encrypted: true,
    reactions,
  };
}

export const initialMessages: Record<string, Message[]> = {
  general: [
    msg("g1", "u2", "Σήμερα βράδυ gaming; Έχω στήσει τον server.", 46, [
      { emoji: "🎮", userIds: ["u1", "u4"] },
    ]),
    msg("g2", "u3", "Ναι, είμαι μέσα! Τι παίζουμε;", 44),
    msg("g3", "u4", "Λέω για κάνα co-op, έχω όρεξη για γέλιο 😄", 45, [
      { emoji: "😂", userIds: ["u1"] },
    ]),
    msg("g4", "u1", "Τέλεια, στήνω lobby και μπαίνουμε voice.", 43),
    msg("g5", "u2", "Φέρτε και snacks, θα πάει αργά η βραδιά 🍕", 42, [
      { emoji: "👍", userIds: ["u1", "u3", "u4"] },
    ]),
  ],
  gaming: [
    msg("gm1", "u4", "Ποιος είναι για ranked απόψε;", 120),
    msg("gm2", "u2", "Εγώ! Στις 21:00 στο Gaming voice.", 118, [
      { emoji: "🔥", userIds: ["u4"] },
    ]),
  ],
  dev: [
    msg("d1", "u4", "Έστησα καινούριο mod pack για το server μας.", 200),
    msg("d2", "u1", "Nice! Το δοκιμάζουμε το βράδυ;", 195),
    msg("d3", "u3", "Ναι, ρίξτε και κάνα screenshot μετά 📸", 190, [
      { emoji: "💯", userIds: ["u1", "u4"] },
    ]),
  ],
  random: [
    msg("r1", "u5", "Καλημέρα παιδιά ☕", 300),
  ],
};

export const initialDMMessages: Record<string, Message[]> = {
  "dm-u2": [
    msg("dm2a", "u2", "Ρε είδες το καινούριο update του παιχνιδιού;", 30),
    msg("dm2b", "u1", "Ναι! Το κατεβάζω τώρα, μπαίνω σε λίγο.", 28),
  ],
  "dm-u3": [
    msg("dm3a", "u3", "Έστειλα πρόσκληση στην Elena για την παρέα.", 60),
  ],
  "dm-u4": [
    msg("dm4a", "u4", "Είσαι για ranked αργότερα;", 90),
    msg("dm4b", "u1", "Πάντα 😎 Πες μου ώρα.", 88, [{ emoji: "✅", userIds: ["u4"] }]),
  ],
};

export const QUICK_EMOJIS = ["👍", "🔥", "😂", "❤️", "🎮", "🔒", "💯", "✅", "👀", "🚀"];

export const initialVoiceParticipants: Record<string, string[]> = {
  "voice-lounge": ["u4"],
  "voice-gaming": [],
};

const AUTO_REPLIES = [
  "Καλή φάση 👍",
  "Συμφωνώ.",
  "Έρχομαι σε 5.",
  "lol",
  "Μπαίνω voice τώρα.",
  "Ναι ρε, τέλειο αυτό.",
  "Ποιος άλλος είναι online;",
  "Δώσε μου ένα λεπτό.",
  "🔥🔥",
  "GG!",
];

export function randomReply(): string {
  return AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
}
