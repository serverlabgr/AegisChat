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

type OutEvent =
  | { type: "presence"; userId: string; status: string }
  | { type: "typing"; channelId: string; userId: string; username: string }
  | { type: "message"; channelId: string; message: unknown }
  | { type: "dm"; threadId: string; message: unknown }
  | { type: "friend_request"; request: unknown }
  | { type: "pong"; serverTime: number; clientTime?: number }
  | {
      type: "rtc";
      fromUserId: string;
      threadId: string;
      signal: unknown;
    };

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
      }),
    );

    ws.on("message", (data) => {
      let msg: {
        type?: string;
        channelId?: string;
        clientTime?: number;
        toUserId?: string;
        threadId?: string;
        signal?: unknown;
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
      }
    });

    ws.on("close", async () => {
      set!.delete(client);
      if (set!.size === 0) {
        clients.delete(payload.sub);
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
