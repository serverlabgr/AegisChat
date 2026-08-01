import { ensureFreshAccessToken, wsUrl } from "./api";
import { loadTokens } from "./authStorage";

export type RealtimeHandlers = {
  onPresence?: (userId: string, status: string) => void;
  onTyping?: (channelId: string, userId: string) => void;
  onMessage?: (channelId: string, message: unknown) => void;
  onDm?: (threadId: string, message: unknown) => void;
  onFriendRequest?: (request: unknown) => void;
  onRtc?: (fromUserId: string, threadId: string, signal: unknown) => void;
  onPong?: (rttMs: number) => void;
  onHello?: (online: string[]) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private handlers: RealtimeHandlers = {};
  private attempt = 0;

  setHandlers(handlers: RealtimeHandlers) {
    this.handlers = handlers;
  }

  async connect() {
    this.stopped = false;
    const access =
      (await ensureFreshAccessToken()) ??
      (await loadTokens())?.accessToken ??
      null;
    if (!access) return;
    this.open(access);
  }

  private open(accessToken: string) {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    const ws = new WebSocket(wsUrl(accessToken));
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.startPing();
      this.handlers.onOpen?.();
    };

    ws.onmessage = (ev) => {
      let msg: {
        type: string;
        userId?: string;
        status?: string;
        channelId?: string;
        threadId?: string;
        message?: unknown;
        request?: unknown;
        online?: string[];
        clientTime?: number;
        serverTime?: number;
        fromUserId?: string;
        signal?: unknown;
      };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      switch (msg.type) {
        case "hello":
          this.handlers.onHello?.(msg.online ?? []);
          break;
        case "presence":
          if (msg.userId && msg.status) {
            this.handlers.onPresence?.(msg.userId, msg.status);
          }
          break;
        case "typing":
          if (msg.channelId && msg.userId) {
            this.handlers.onTyping?.(msg.channelId, msg.userId);
          }
          break;
        case "message":
          if (msg.channelId && msg.message) {
            this.handlers.onMessage?.(msg.channelId, msg.message);
          }
          break;
        case "dm":
          if (msg.threadId && msg.message) {
            this.handlers.onDm?.(msg.threadId, msg.message);
          }
          break;
        case "friend_request":
          if (msg.request) {
            this.handlers.onFriendRequest?.(msg.request);
          }
          break;
        case "rtc":
          if (msg.fromUserId && msg.threadId && msg.signal != null) {
            this.handlers.onRtc?.(msg.fromUserId, msg.threadId, msg.signal);
          }
          break;
        case "pong":
          if (typeof msg.clientTime === "number") {
            this.handlers.onPong?.(Date.now() - msg.clientTime);
          }
          break;
      }
    };

    ws.onclose = () => {
      this.stopPing();
      this.handlers.onClose?.();
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({ type: "ping", clientTime: Date.now() }),
        );
      }
    }, 4000);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.attempt, 5));
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  sendTyping(channelId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "typing", channelId }));
    }
  }

  sendRtc(toUserId: string, threadId: string, signal: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({ type: "rtc", toUserId, threadId, signal }),
      );
    }
  }

  disconnect() {
    this.stopped = true;
    this.attempt = 0;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
  }
}

export const realtime = new RealtimeClient();
