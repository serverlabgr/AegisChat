import { ensureFreshAccessToken, wsUrl } from "./api";
import { loadTokens } from "./authStorage";
import type { RadioState, VoiceParticipant } from "./voiceTypes";

export type RealtimeHandlers = {
  onPresence?: (userId: string, status: string) => void;
  onTyping?: (channelId: string, userId: string) => void;
  onMessage?: (channelId: string, message: unknown) => void;
  onMessageUpdated?: (channelId: string, message: unknown) => void;
  onMessageDeleted?: (channelId: string, messageId: string) => void;
  onReaction?: (
    channelId: string,
    messageId: string,
    emoji: string,
    userId: string,
    added: boolean,
  ) => void;
  onDm?: (threadId: string, message: unknown) => void;
  onDmUpdated?: (threadId: string, message: unknown) => void;
  onDmDeleted?: (threadId: string, messageId: string) => void;
  onDmReaction?: (
    threadId: string,
    messageId: string,
    emoji: string,
    userId: string,
    added: boolean,
  ) => void;
  onRead?: (
    targetId: string,
    userId: string,
    lastMessageId: string | null,
  ) => void;
  onFriendRequest?: (request: unknown) => void;
  onRtc?: (fromUserId: string, threadId: string, signal: unknown) => void;
  onVoiceState?: (channelId: string, participants: VoiceParticipant[]) => void;
  onVoiceSignal?: (
    channelId: string,
    fromUserId: string,
    toUserId: string,
    signal: unknown,
  ) => void;
  onRadioState?: (state: RadioState) => void;
  onGameSession?: (
    session: unknown,
    action: "created" | "updated" | "deleted",
  ) => void;
  onChannelsChanged?: (groupId: string | null) => void;
  onPin?: (
    channelId: string,
    messageId: string,
    pinned: boolean,
    pinnedBy: string,
  ) => void;
  onMention?: (
    channelId: string,
    messageId: string,
    fromUserId: string,
  ) => void;
  onPresenceActivity?: (userId: string, activity: string | null) => void;
  onPong?: (rttMs: number) => void;
  onHello?: (online: string[], radio?: RadioState) => void;
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
    try {
      const access =
        (await ensureFreshAccessToken()) ??
        (await loadTokens())?.accessToken ??
        null;
      if (!access) return;
      this.open(access);
    } catch {
      if (!this.stopped) this.scheduleReconnect();
    }
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
        messageId?: string;
        emoji?: string;
        added?: boolean;
        request?: unknown;
        online?: string[];
        clientTime?: number;
        serverTime?: number;
        fromUserId?: string;
        toUserId?: string;
        signal?: unknown;
        participants?: VoiceParticipant[];
        state?: RadioState;
        radio?: RadioState;
        targetId?: string;
        lastMessageId?: string | null;
        session?: unknown;
        action?: "created" | "updated" | "deleted";
        groupId?: string | null;
        pinned?: boolean;
        pinnedBy?: string;
        activity?: string | null;
      };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      try {
        this.dispatch(msg);
      } catch {
        /* Handler bugs must not kill the socket */
      }
    };

    ws.onerror = () => {
      // onclose will fire and schedule reconnect
    };

    ws.onclose = () => {
      this.stopPing();
      this.handlers.onClose?.();
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private dispatch(msg: {
    type: string;
    userId?: string;
    status?: string;
    channelId?: string;
    threadId?: string;
    message?: unknown;
    messageId?: string;
    emoji?: string;
    added?: boolean;
    request?: unknown;
    online?: string[];
    clientTime?: number;
    serverTime?: number;
    fromUserId?: string;
    toUserId?: string;
    signal?: unknown;
    participants?: VoiceParticipant[];
    state?: RadioState;
    radio?: RadioState;
    targetId?: string;
    lastMessageId?: string | null;
    session?: unknown;
    action?: "created" | "updated" | "deleted";
    groupId?: string | null;
    pinned?: boolean;
    pinnedBy?: string;
    activity?: string | null;
  }) {
    switch (msg.type) {
      case "hello":
        this.handlers.onHello?.(msg.online ?? [], msg.radio);
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
      case "message_updated":
        if (msg.channelId && msg.message) {
          this.handlers.onMessageUpdated?.(msg.channelId, msg.message);
        }
        break;
      case "message_deleted":
        if (msg.channelId && msg.messageId) {
          this.handlers.onMessageDeleted?.(msg.channelId, msg.messageId);
        }
        break;
      case "reaction":
        if (
          msg.channelId &&
          msg.messageId &&
          msg.emoji &&
          msg.userId &&
          typeof msg.added === "boolean"
        ) {
          this.handlers.onReaction?.(
            msg.channelId,
            msg.messageId,
            msg.emoji,
            msg.userId,
            msg.added,
          );
        }
        break;
      case "dm":
        if (msg.threadId && msg.message) {
          this.handlers.onDm?.(msg.threadId, msg.message);
        }
        break;
      case "dm_updated":
        if (msg.threadId && msg.message) {
          this.handlers.onDmUpdated?.(msg.threadId, msg.message);
        }
        break;
      case "dm_deleted":
        if (msg.threadId && msg.messageId) {
          this.handlers.onDmDeleted?.(msg.threadId, msg.messageId);
        }
        break;
      case "dm_reaction":
        if (
          msg.threadId &&
          msg.messageId &&
          msg.emoji &&
          msg.userId &&
          typeof msg.added === "boolean"
        ) {
          this.handlers.onDmReaction?.(
            msg.threadId,
            msg.messageId,
            msg.emoji,
            msg.userId,
            msg.added,
          );
        }
        break;
      case "read":
        if (msg.targetId && msg.userId) {
          this.handlers.onRead?.(
            msg.targetId,
            msg.userId,
            msg.lastMessageId ?? null,
          );
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
      case "voice_state":
        if (msg.channelId && msg.participants) {
          this.handlers.onVoiceState?.(msg.channelId, msg.participants);
        }
        break;
      case "voice_signal":
        if (
          msg.channelId &&
          msg.fromUserId &&
          msg.toUserId &&
          msg.signal != null
        ) {
          this.handlers.onVoiceSignal?.(
            msg.channelId,
            msg.fromUserId,
            msg.toUserId,
            msg.signal,
          );
        }
        break;
      case "radio_state":
        if (msg.state) {
          this.handlers.onRadioState?.(msg.state);
        }
        break;
      case "game_session":
        if (msg.session && msg.action) {
          this.handlers.onGameSession?.(msg.session, msg.action);
        }
        break;
      case "channels_changed":
        this.handlers.onChannelsChanged?.(msg.groupId ?? null);
        break;
      case "pin":
        if (msg.channelId && msg.messageId && msg.pinnedBy != null) {
          this.handlers.onPin?.(
            msg.channelId,
            msg.messageId,
            Boolean(msg.pinned),
            msg.pinnedBy,
          );
        }
        break;
      case "mention":
        if (msg.channelId && msg.messageId && msg.fromUserId) {
          this.handlers.onMention?.(
            msg.channelId,
            msg.messageId,
            msg.fromUserId,
          );
        }
        break;
      case "presence_activity":
        if (msg.userId) {
          this.handlers.onPresenceActivity?.(
            msg.userId,
            (msg.activity as string | null | undefined) ?? null,
          );
        }
        break;
      case "pong":
        if (typeof msg.clientTime === "number") {
          this.handlers.onPong?.(Date.now() - msg.clientTime);
        }
        break;
    }
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
      void this.connect().catch(() => {
        if (!this.stopped) this.scheduleReconnect();
      });
    }, delay);
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  sendTyping(channelId: string) {
    this.send({ type: "typing", channelId });
  }

  sendRtc(toUserId: string, threadId: string, signal: unknown) {
    this.send({ type: "rtc", toUserId, threadId, signal });
  }

  sendVoiceJoin(channelId: string, muted: boolean, deafened: boolean) {
    this.send({ type: "voice_join", channelId, muted, deafened });
  }

  sendVoiceLeave(channelId: string) {
    this.send({ type: "voice_leave", channelId });
  }

  sendVoiceState(channelId: string, muted: boolean, deafened: boolean) {
    this.send({ type: "voice_state", channelId, muted, deafened });
  }

  sendVoiceSignal(channelId: string, toUserId: string, signal: unknown) {
    this.send({ type: "voice_signal", channelId, toUserId, signal });
  }

  sendRead(targetId: string, lastMessageId: string | null) {
    this.send({ type: "read", targetId, lastMessageId });
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
