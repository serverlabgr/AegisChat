import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyAccessToken } from "./auth.js";
import { query } from "./db.js";

type Client = {
  ws: WebSocket;
  userId: string;
  username: string;
  lastPong: number;
};

export type VoiceParticipant = {
  userId: string;
  muted: boolean;
  deafened: boolean;
};

export type OutEvent =
  | { type: "presence"; userId: string; status: string }
  | { type: "typing"; channelId: string; userId: string; username: string }
  | { type: "message"; channelId: string; message: unknown }
  | { type: "message_updated"; channelId: string; message: unknown }
  | { type: "message_deleted"; channelId: string; messageId: string }
  | {
      type: "reaction";
      channelId: string;
      messageId: string;
      emoji: string;
      userId: string;
      added: boolean;
    }
  | { type: "dm"; threadId: string; message: unknown }
  | { type: "dm_updated"; threadId: string; message: unknown }
  | { type: "dm_deleted"; threadId: string; messageId: string }
  | {
      type: "dm_reaction";
      threadId: string;
      messageId: string;
      emoji: string;
      userId: string;
      added: boolean;
    }
  | {
      type: "read";
      targetId: string;
      userId: string;
      lastMessageId: string | null;
    }
  | { type: "friend_request"; request: unknown }
  | { type: "pong"; serverTime: number; clientTime?: number }
  | {
      type: "rtc";
      fromUserId: string;
      threadId: string;
      signal: unknown;
    }
  | {
      type: "voice_state";
      channelId: string;
      participants: VoiceParticipant[];
    }
  | {
      type: "voice_signal";
      channelId: string;
      fromUserId: string;
      toUserId: string;
      signal: unknown;
    }
  | {
      type: "radio_state";
      state: RadioState;
    }
  | {
      type: "game_session";
      session: unknown;
      action: "created" | "updated" | "deleted";
    }
  | {
      type: "channels_changed";
      groupId: string | null;
    }
  | {
      type: "pin";
      channelId: string;
      messageId: string;
      pinned: boolean;
      pinnedBy: string;
    }
  | {
      type: "mention";
      channelId: string;
      messageId: string;
      fromUserId: string;
    }
  | {
      type: "presence_activity";
      userId: string;
      activity: string | null;
    }
  | {
      type: "thread_created";
      channelId: string;
      thread: unknown;
    }
  | {
      type: "thread_message";
      channelId: string;
      threadId: string;
      message: unknown;
    };

export type RadioState = {
  trackUrl: string;
  title: string;
  playing: boolean;
  position: number;
  updatedAt: number;
  updatedBy: string | null;
  source?: "stream" | "spotify";
};

/** channelId → participants */
const voiceRooms = new Map<string, Map<string, VoiceParticipant>>();

let radioState: RadioState = {
  trackUrl: "",
  title: "Σίγαση",
  playing: false,
  position: 0,
  updatedAt: Date.now(),
  updatedBy: null,
};

export function getRadioState(): RadioState {
  return { ...radioState };
}

export function setRadioState(patch: Partial<RadioState>, userId: string | null) {
  radioState = {
    ...radioState,
    ...patch,
    updatedAt: Date.now(),
    updatedBy: userId,
  };
  broadcast({ type: "radio_state", state: getRadioState() });
  return getRadioState();
}

export function getVoiceRoom(channelId: string): VoiceParticipant[] {
  const room = voiceRooms.get(channelId);
  if (!room) return [];
  return [...room.values()];
}

export function voiceJoin(
  channelId: string,
  userId: string,
  muted = false,
  deafened = false,
): VoiceParticipant[] {
  // Leave any other room first
  for (const [cid, room] of [...voiceRooms.entries()]) {
    if (cid === channelId) continue;
    if (room.delete(userId)) {
      if (room.size === 0) voiceRooms.delete(cid);
      broadcast({
        type: "voice_state",
        channelId: cid,
        participants: getVoiceRoom(cid),
      });
    }
  }
  let room = voiceRooms.get(channelId);
  if (!room) {
    room = new Map();
    voiceRooms.set(channelId, room);
  }
  room.set(userId, { userId, muted, deafened });
  const participants = getVoiceRoom(channelId);
  broadcast({ type: "voice_state", channelId, participants });
  return participants;
}

export function voiceLeave(channelId: string, userId: string): VoiceParticipant[] {
  const room = voiceRooms.get(channelId);
  if (!room) return [];
  room.delete(userId);
  if (room.size === 0) voiceRooms.delete(channelId);
  const participants = getVoiceRoom(channelId);
  broadcast({ type: "voice_state", channelId, participants });
  return participants;
}

export function voiceUpdateState(
  channelId: string,
  userId: string,
  patch: { muted?: boolean; deafened?: boolean },
): VoiceParticipant[] {
  const room = voiceRooms.get(channelId);
  if (!room) return [];
  const cur = room.get(userId);
  if (!cur) return getVoiceRoom(channelId);
  room.set(userId, {
    ...cur,
    muted: patch.muted ?? cur.muted,
    deafened: patch.deafened ?? cur.deafened,
  });
  const participants = getVoiceRoom(channelId);
  broadcast({ type: "voice_state", channelId, participants });
  return participants;
}

function leaveAllVoice(userId: string) {
  for (const [channelId, room] of [...voiceRooms.entries()]) {
    if (room.has(userId)) {
      voiceLeave(channelId, userId);
    }
  }
}

const clients = new Map<string, Set<Client>>();

export function getOnlineUserIds(): string[] {
  return [...clients.keys()];
}

export function broadcast(event: OutEvent, exceptUserId?: string) {
  const raw = JSON.stringify(event);
  for (const [userId, set] of clients) {
    if (exceptUserId && userId === exceptUserId) continue;
    for (const c of set) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(raw);
    }
  }
}

export function sendToUser(userId: string, event: OutEvent) {
  const set = clients.get(userId);
  if (!set) return;
  const raw = JSON.stringify(event);
  for (const c of set) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(raw);
  }
}

export function notifyThreadPeers(
  userA: string,
  userB: string,
  event: OutEvent,
) {
  sendToUser(userA, event);
  sendToUser(userB, event);
}

export function attachWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const token = url.searchParams.get("token");
    if (!token) {
      ws.close(4401, "Unauthorized");
      return;
    }
    const payload = await verifyAccessToken(token);
    if (!payload) {
      ws.close(4401, "Unauthorized");
      return;
    }

    const client: Client = {
      ws,
      userId: payload.sub,
      username: payload.username,
      lastPong: Date.now(),
    };

    let set = clients.get(payload.sub);
    if (!set) {
      set = new Set();
      clients.set(payload.sub, set);
    }
    const wasOffline = set.size === 0;
    set.add(client);

    if (wasOffline) {
      await query(`UPDATE users SET status = 'online' WHERE id = $1`, [
        payload.sub,
      ]);
      broadcast({
        type: "presence",
        userId: payload.sub,
        status: "online",
      });
    }

    ws.send(
      JSON.stringify({
        type: "hello",
        userId: payload.sub,
        online: getOnlineUserIds(),
        radio: getRadioState(),
      }),
    );

    // Send current voice rooms snapshot
    for (const [channelId] of voiceRooms) {
      ws.send(
        JSON.stringify({
          type: "voice_state",
          channelId,
          participants: getVoiceRoom(channelId),
        }),
      );
    }

    ws.on("message", (data) => {
      let msg: {
        type?: string;
        channelId?: string;
        clientTime?: number;
        toUserId?: string;
        threadId?: string;
        signal?: unknown;
        muted?: boolean;
        deafened?: boolean;
        targetId?: string;
        lastMessageId?: string | null;
      };
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (msg.type === "ping") {
        client.lastPong = Date.now();
        const event: OutEvent = {
          type: "pong",
          serverTime: Date.now(),
          clientTime: msg.clientTime,
        };
        ws.send(JSON.stringify(event));
        return;
      }
      if (msg.type === "typing" && msg.channelId) {
        broadcast(
          {
            type: "typing",
            channelId: msg.channelId,
            userId: client.userId,
            username: client.username,
          },
          client.userId,
        );
        return;
      }
      if (
        msg.type === "rtc" &&
        msg.toUserId &&
        msg.threadId &&
        msg.signal != null
      ) {
        sendToUser(msg.toUserId, {
          type: "rtc",
          fromUserId: client.userId,
          threadId: msg.threadId,
          signal: msg.signal,
        });
        return;
      }
      if (msg.type === "voice_join" && msg.channelId) {
        voiceJoin(
          msg.channelId,
          client.userId,
          Boolean(msg.muted),
          Boolean(msg.deafened),
        );
        return;
      }
      if (msg.type === "voice_leave" && msg.channelId) {
        voiceLeave(msg.channelId, client.userId);
        return;
      }
      if (msg.type === "voice_state" && msg.channelId) {
        voiceUpdateState(msg.channelId, client.userId, {
          muted: msg.muted,
          deafened: msg.deafened,
        });
        return;
      }
      if (
        msg.type === "voice_signal" &&
        msg.channelId &&
        msg.toUserId &&
        msg.signal != null
      ) {
        sendToUser(msg.toUserId, {
          type: "voice_signal",
          channelId: msg.channelId,
          fromUserId: client.userId,
          toUserId: msg.toUserId,
          signal: msg.signal,
        });
        return;
      }
      if (msg.type === "read" && msg.targetId) {
        const lastMessageId = msg.lastMessageId ?? null;
        void (async () => {
          try {
            await query(
              `INSERT INTO read_cursors (user_id, target_id, last_message_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (user_id, target_id)
               DO UPDATE SET last_message_id = EXCLUDED.last_message_id, updated_at = now()`,
              [client.userId, msg.targetId, lastMessageId],
            );
          } catch {
            /* table may not exist yet — still broadcast */
          }
          broadcast(
            {
              type: "read",
              targetId: msg.targetId!,
              userId: client.userId,
              lastMessageId,
            },
            undefined,
          );
        })();
      }
    });

    ws.on("close", async () => {
      set!.delete(client);
      if (set!.size === 0) {
        clients.delete(payload.sub);
        leaveAllVoice(payload.sub);
        await query(`UPDATE users SET status = 'offline' WHERE id = $1`, [
          payload.sub,
        ]);
        broadcast({
          type: "presence",
          userId: payload.sub,
          status: "offline",
        });
      }
    });
  });

  return wss;
}
