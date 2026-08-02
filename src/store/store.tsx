import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CURRENT_USER_ID,
  initialDMMessages,
  initialMessages,
  initialVoiceParticipants,
  randomReply,
  textChannels as initialTextChannels,
  voiceChannels as initialVoiceChannels,
  users as initialUsers,
  memberIds as initialMemberIds,
  dmConversations as initialDMs,
  type Channel,
  type DMConversation,
  type Message,
  type User,
  type UserStatus,
} from "../data/mock";
import {
  groups as initialGroups,
  inviteLinks as initialInvites,
  pendingRequests as initialRequests,
  HOME_SERVER_ID,
  PERSONAL_SPACE_ID,
  makeGroupChannels,
  type FriendInvite,
  type Group,
  type PendingRequest,
} from "../data/modules";
import { usePersisted } from "../lib/persist";
import { api, logout as apiLogout } from "../lib/api";
import type { BootstrapPayload } from "../lib/session";
import {
  fetchChannelMessages,
  fetchDmMessages,
} from "../lib/session";
import { realtime } from "../lib/realtime";
import {
  decryptText,
  encryptText,
  isEncryptedPayload,
} from "../lib/messageCrypto";
import { encodeMessageBody } from "../lib/messageBody";
import type { MediaMeta } from "../lib/media";
import {
  handleRtcSignal,
  type RtcSignal,
} from "../lib/webrtc";
import type { VoiceParticipant } from "../lib/voiceTypes";
import {
  handleVoiceSignal,
  joinVoiceMesh,
  leaveVoiceMesh,
  setLocalVoiceState,
  syncVoiceParticipants,
  type VoiceSignal,
} from "../lib/voiceMesh";

export type ActiveView =
  | { type: "channel"; id: string }
  | { type: "dm"; id: string };

export type AppModule =
  | "chat"
  | "personal"
  | "friends"
  | "radio"
  | "games"
  | "devportal"
  | "toolbox";

export interface Settings {
  accent: string;
  killSwitch: boolean;
  vpnConnected: boolean;
  notifications: boolean;
  showEncryptionBadges: boolean;
  compactMode: boolean;
  readReceipts: boolean;
}

export interface VoiceState {
  channelId: string | null;
  muted: boolean;
  deafened: boolean;
  participants: Record<string, string[]>;
}

export interface Toast {
  id: number;
  text: string;
}

interface StoreValue {
  currentUserId: string;
  onlineMode: boolean;
  users: Record<string, User>;
  memberIds: string[];
  /** Home server channels from API (or mock offline) */
  homeChannels: Channel[];
  dms: DMConversation[];
  messagesByChannel: Record<string, Message[]>;
  dmMessages: Record<string, Message[]>;
  activeView: ActiveView;
  activeModule: AppModule;
  typingUserId: string | null;
  unread: Record<string, number>;
  settings: Settings;
  voice: VoiceState;
  requests: PendingRequest[];
  invites: FriendInvite[];
  groups: Group[];
  /** Discord-like active server — `home` or a group id */
  activeGroupId: string;
  toasts: Toast[];
  /** Live RTT per user id (ms). Not persisted. */
  pings: Record<string, number | null>;

  setActiveView: (view: ActiveView) => void;
  setActiveModule: (module: AppModule) => void;
  setActiveGroup: (groupId: string) => void;
  sendMessage: (
    content: string,
    replyToId?: string,
    files?: import("../lib/media").MediaMeta[],
  ) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  setStatus: (status: UserStatus) => void;
  setUserPing: (userId: string, ping: number | null) => void;
  getPing: (userId: string) => number | null;
  updateProfile: (patch: Partial<User>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  joinVoice: (channelId: string) => void;
  leaveVoice: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;

  toast: (text: string) => void;
  openDM: (userId: string) => void;
  sendFriendRequest: (name: string) => void;
  acceptRequest: (requestId: string) => void;
  declineRequest: (requestId: string) => void;
  createInvite: () => void;
  createGroup: (name: string) => void;
  inviteToGame: (userId: string) => void;
  hydrateFromServer: (payload: BootstrapPayload) => void;
  connectRealtime: () => void;
  disconnectRealtime: () => void;
  signOut: () => Promise<void>;
  setPresence: (userId: string, status: UserStatus) => void;
  ingestChannelMessage: (channelId: string, message: Message) => void;
  ingestDmMessage: (threadId: string, message: Message) => void;
  sendTyping: () => void;
  /** targetId → userId → lastMessageId */
  readCursors: Record<string, Record<string, string | null>>;
  markRead: (targetId: string, lastMessageId: string | null) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export const ACCENT_OPTIONS = [
  { id: "azure", value: "#5cc8ff", label: "Azure" },
  { id: "violet", value: "#9d7bf0", label: "Violet" },
  { id: "mint", value: "#4be0a8", label: "Mint" },
  { id: "magenta", value: "#f472d0", label: "Magenta" },
  { id: "amber", value: "#ffb454", label: "Amber" },
];

const FRIEND_COLORS = ["#7aa2f7", "#bb9af7", "#e0af68", "#f7768e", "#9ece6a", "#5cc8ff", "#f472d0"];

function currentActiveKey(view: ActiveView): string {
  return view.id;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState(CURRENT_USER_ID);
  const [onlineMode, setOnlineMode] = useState(false);
  const [users, setUsers] = usePersisted<Record<string, User>>("users", initialUsers);
  const [memberIds, setMemberIds] = usePersisted<string[]>("members", initialMemberIds);
  const [homeChannels, setHomeChannels] = useState<Channel[]>([
    ...initialTextChannels,
    ...initialVoiceChannels,
  ]);
  const [dms, setDms] = usePersisted<DMConversation[]>("dms", initialDMs);
  const [messagesByChannel, setMessagesByChannel] =
    usePersisted<Record<string, Message[]>>("messages", initialMessages);
  const [dmMessages, setDmMessages] =
    usePersisted<Record<string, Message[]>>("dm-messages", initialDMMessages);
  const [requests, setRequests] = usePersisted<PendingRequest[]>("requests", initialRequests);
  const [invites, setInvites] = usePersisted<FriendInvite[]>("invites", initialInvites);
  const [groups, setGroups] = usePersisted<Group[]>("groups", initialGroups);
  const [activeGroupId, setActiveGroupId] = usePersisted<string>(
    "active-group",
    HOME_SERVER_ID,
  );
  const [activeView, setActiveViewState] = useState<ActiveView>({
    type: "channel",
    id: "general",
  });
  const [activeModule, setActiveModule] = useState<AppModule>("chat");
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [settings, setSettings] = usePersisted<Settings>("settings", {
    accent: "#5cc8ff",
    killSwitch: true,
    vpnConnected: true,
    notifications: true,
    showEncryptionBadges: true,
    compactMode: false,
    readReceipts: false,
  });
  const [voice, setVoice] = useState<VoiceState>({
    channelId: null,
    muted: false,
    deafened: false,
    participants: initialVoiceParticipants,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pings, setPings] = useState<Record<string, number | null>>({});
  const [readCursors, setReadCursors] = usePersisted<
    Record<string, Record<string, string | null>>
  >("read-cursors", {});

  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastId = useRef(0);
  const onlineRef = useRef(false);
  const currentUserRef = useRef(currentUserId);
  const activeViewRef = useRef(activeView);
  const settingsRef = useRef(settings);
  const usersRef = useRef(users);
  currentUserRef.current = currentUserId;
  onlineRef.current = onlineMode;
  activeViewRef.current = activeView;
  settingsRef.current = settings;
  usersRef.current = users;

  const notifyDesktop = useCallback((title: string, body: string) => {
    if (!settingsRef.current.notifications) return;
    if (typeof document !== "undefined" && document.hasFocus()) return;
    try {
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "default") {
        void Notification.requestPermission();
        return;
      }
      if (Notification.permission !== "granted") return;
      new Notification(title, { body, silent: false });
    } catch {
      /* ignore */
    }
  }, []);

  const bumpUnread = useCallback((key: string, authorId: string) => {
    if (authorId === currentUserRef.current) return;
    const focused = activeViewRef.current;
    if (focused.id === key) return;
    setUnread((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }, []);

  const toast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const markRead = useCallback(
    (targetId: string, lastMessageId: string | null) => {
      const me = currentUserRef.current;
      setReadCursors((prev) => ({
        ...prev,
        [targetId]: { ...(prev[targetId] ?? {}), [me]: lastMessageId },
      }));
      if (settingsRef.current.readReceipts && onlineRef.current) {
        realtime.sendRead(targetId, lastMessageId);
      }
    },
    [setReadCursors],
  );

  const setActiveView = useCallback(
    (view: ActiveView) => {
      setActiveViewState(view);
      setUnread((prev) => {
        const key = currentActiveKey(view);
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );
  const ensureDM = useCallback(
    (userId: string): string => {
      const dmId = `dm-${userId}`;
      setDms((prev) =>
        prev.some((d) => d.id === dmId) ? prev : [...prev, { id: dmId, userId }],
      );
      return dmId;
    },
    [setDms],
  );

  const openDM = useCallback(
    (userId: string) => {
      if (onlineRef.current) {
        void (async () => {
          try {
            const { threadId } = await api<{ threadId: string }>(
              `/dms/with/${userId}`,
              { method: "POST", body: {} },
            );
            setDms((prev) =>
              prev.some((d) => d.id === threadId)
                ? prev
                : [...prev, { id: threadId, userId }],
            );
            setActiveGroupId(PERSONAL_SPACE_ID);
            setActiveModule("personal");
            setActiveView({ type: "dm", id: threadId });
          } catch (err) {
            toast(err instanceof Error ? err.message : "Αποτυχία DM");
          }
        })();
        return;
      }
      const dmId = ensureDM(userId);
      setActiveGroupId(PERSONAL_SPACE_ID);
      setActiveModule("personal");
      setActiveView({ type: "dm", id: dmId });
    },
    [ensureDM, setActiveView, setDms, setActiveGroupId, toast],
  );

  const appendMessage = useCallback(
    (view: ActiveView, message: Message) => {
      if (view.type === "channel") {
        setMessagesByChannel((prev) => ({
          ...prev,
          [view.id]: [...(prev[view.id] ?? []), message],
        }));
      } else {
        setDmMessages((prev) => ({
          ...prev,
          [view.id]: [...(prev[view.id] ?? []), message],
        }));
      }
    },
    [setMessagesByChannel, setDmMessages],
  );

  const scheduleAutoReply = useCallback(
    (view: ActiveView) => {
      let responderId: string | null = null;
      if (view.type === "dm") {
        responderId = view.id.replace("dm-", "");
      } else {
        const online = Object.values(users).filter(
          (u) => u.id !== currentUserRef.current && u.status !== "offline",
        );
        if (online.length > 0) {
          responderId = online[Math.floor(Math.random() * online.length)].id;
        }
      }
      if (!responderId) return;
      const responder = responderId;

      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (replyTimer.current) clearTimeout(replyTimer.current);

      typingTimer.current = setTimeout(() => setTypingUserId(responder), 700);

      replyTimer.current = setTimeout(() => {
        setTypingUserId(null);
        const reply: Message = {
          id: uid("m"),
          authorId: responder,
          content: randomReply(),
          timestamp: Date.now(),
          encrypted: true,
          reactions: [],
        };
        appendMessage(view, reply);
        setActiveViewState((current) => {
          const sameView =
            current.type === view.type && current.id === view.id;
          if (!sameView) {
            setUnread((prev) => ({
              ...prev,
              [currentActiveKey(view)]:
                (prev[currentActiveKey(view)] ?? 0) + 1,
            }));
          }
          return current;
        });
      }, 2200);
    },
    [appendMessage, users],
  );

  const applyReaction = useCallback(
    (
      list: Message[],
      messageId: string,
      emoji: string,
      userId: string,
      added: boolean,
    ): Message[] =>
      list.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find((r) => r.emoji === emoji);
        if (added) {
          if (!existing) {
            return {
              ...m,
              reactions: [...m.reactions, { emoji, userIds: [userId] }],
            };
          }
          if (existing.userIds.includes(userId)) return m;
          return {
            ...m,
            reactions: m.reactions.map((r) =>
              r.emoji === emoji
                ? { ...r, userIds: [...r.userIds, userId] }
                : r,
            ),
          };
        }
        if (!existing) return m;
        const nextUsers = existing.userIds.filter((id) => id !== userId);
        const reactions = nextUsers.length
          ? m.reactions.map((r) =>
              r.emoji === emoji ? { ...r, userIds: nextUsers } : r,
            )
          : m.reactions.filter((r) => r.emoji !== emoji);
        return { ...m, reactions };
      }),
    [],
  );

  const ingestChannelMessage = useCallback(
    (channelId: string, message: Message) => {
      void (async () => {
        const content = isEncryptedPayload(message.content)
          ? await decryptText(message.content)
          : message.content;
        const decoded = {
          ...message,
          content,
          encrypted: isEncryptedPayload(message.content) || message.encrypted,
        };
        let added = false;
        setMessagesByChannel((prev) => {
          const list = prev[channelId] ?? [];
          const idx = list.findIndex((m) => m.id === decoded.id);
          if (idx >= 0) {
            const next = [...list];
            next[idx] = {
              ...decoded,
              reactions: decoded.reactions?.length
                ? decoded.reactions
                : list[idx].reactions,
            };
            return { ...prev, [channelId]: next };
          }
          added = true;
          return { ...prev, [channelId]: [...list, decoded] };
        });
        if (added) {
          bumpUnread(channelId, decoded.authorId);
          const author = usersRef.current[decoded.authorId]?.name ?? "Νέο μήνυμα";
          notifyDesktop(author, content.slice(0, 120) || "Νέο μήνυμα στο κανάλι");
        }
      })();
    },
    [setMessagesByChannel, bumpUnread, notifyDesktop],
  );

  const ingestDmMessage = useCallback(
    (threadId: string, message: Message) => {
      void (async () => {
        const content = isEncryptedPayload(message.content)
          ? await decryptText(message.content)
          : message.content;
        const decoded = {
          ...message,
          content,
          encrypted: isEncryptedPayload(message.content) || message.encrypted,
        };
        let added = false;
        setDmMessages((prev) => {
          const list = prev[threadId] ?? [];
          const idx = list.findIndex((m) => m.id === decoded.id);
          if (idx >= 0) {
            const next = [...list];
            next[idx] = {
              ...decoded,
              reactions: decoded.reactions?.length
                ? decoded.reactions
                : list[idx].reactions,
            };
            return { ...prev, [threadId]: next };
          }
          added = true;
          return { ...prev, [threadId]: [...list, decoded] };
        });
        setDms((prev) =>
          prev.some((d) => d.id === threadId)
            ? prev
            : [
                ...prev,
                {
                  id: threadId,
                  userId:
                    decoded.authorId === currentUserRef.current
                      ? threadId
                          .split(":")
                          .find(
                            (p) =>
                              p !== currentUserRef.current && p !== "dm",
                          ) ?? decoded.authorId
                      : decoded.authorId,
                },
              ],
        );
        if (added) {
          bumpUnread(threadId, decoded.authorId);
          const author = usersRef.current[decoded.authorId]?.name ?? "DM";
          notifyDesktop(author, content.slice(0, 120) || "Νέο προσωπικό μήνυμα");
        }
      })();
    },
    [setDmMessages, setDms, bumpUnread, notifyDesktop],
  );

  const removeChannelMessage = useCallback(
    (channelId: string, messageId: string) => {
      setMessagesByChannel((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] ?? []).filter((m) => m.id !== messageId),
      }));
    },
    [setMessagesByChannel],
  );

  const removeDmMessage = useCallback(
    (threadId: string, messageId: string) => {
      setDmMessages((prev) => ({
        ...prev,
        [threadId]: (prev[threadId] ?? []).filter((m) => m.id !== messageId),
      }));
    },
    [setDmMessages],
  );

  const sendTyping = useCallback(() => {
    if (!onlineRef.current) return;
    const view = activeViewRef.current;
    if (view.type === "dm" && view.id === "__personal_home__") return;
    realtime.sendTyping(view.id);
  }, []);

  const setActiveGroup = useCallback(
    (groupId: string) => {
      setActiveGroupId(groupId);
      if (groupId === PERSONAL_SPACE_ID) {
        setActiveModule("personal");
        setActiveViewState((prev) => {
          if (prev.type === "dm") return prev;
          const first = dms[0];
          return first
            ? { type: "dm", id: first.id }
            : { type: "dm", id: "__personal_home__" };
        });
        return;
      }
      setActiveModule("chat");
      if (groupId === HOME_SERVER_ID) {
        setActiveViewState({ type: "channel", id: "general" });
        return;
      }
      const g = groups.find((x) => x.id === groupId);
      const ch =
        g?.channels?.find((c) => c.type === "text") ??
        makeGroupChannels(groupId, g?.name ?? "Server")[0];
      setActiveViewState({ type: "channel", id: ch.id });
    },
    [groups, setActiveGroupId, dms],
  );

  const sendMessage = useCallback(
    (content: string, replyToId?: string, files?: MediaMeta[]) => {
      const trimmed = content.trim();
      if (!trimmed && !files?.length) return;
      if (activeView.type === "dm" && activeView.id === "__personal_home__") {
        return;
      }

      const plainBody = encodeMessageBody({ text: trimmed, files });

      if (onlineRef.current) {
        const view = activeView;
        void (async () => {
          try {
            const payload = await encryptText(plainBody);
            if (view.type === "channel") {
              const { message } = await api<{ message: Message }>(
                `/channels/${encodeURIComponent(view.id)}/messages`,
                { method: "POST", body: { content: payload, replyToId } },
              );
              ingestChannelMessage(view.id, {
                ...message,
                content: plainBody,
                encrypted: true,
              });
            } else {
              const { message } = await api<{ message: Message }>(
                `/dms/${encodeURIComponent(view.id)}/messages`,
                { method: "POST", body: { content: payload, replyToId } },
              );
              ingestDmMessage(view.id, {
                ...message,
                content: plainBody,
                encrypted: true,
              });
            }
          } catch (err) {
            toast(err instanceof Error ? err.message : "Αποτυχία αποστολής");
          }
        })();
        return;
      }

      if (files?.length) {
        toast("Για photo/video χρειάζεται online (κρυπτογραφημένο upload)");
        return;
      }

      const message: Message = {
        id: uid("m"),
        authorId: currentUserRef.current,
        content: plainBody,
        timestamp: Date.now(),
        encrypted: true,
        reactions: [],
        replyToId,
      };
      appendMessage(activeView, message);
      scheduleAutoReply(activeView);
    },
    [
      activeView,
      appendMessage,
      scheduleAutoReply,
      ingestChannelMessage,
      ingestDmMessage,
      toast,
    ],
  );

  const mutateActiveMessages = useCallback(
    (mutator: (list: Message[]) => Message[]) => {
      if (activeView.type === "channel") {
        setMessagesByChannel((prev) => ({
          ...prev,
          [activeView.id]: mutator(prev[activeView.id] ?? []),
        }));
      } else {
        setDmMessages((prev) => ({
          ...prev,
          [activeView.id]: mutator(prev[activeView.id] ?? []),
        }));
      }
    },
    [activeView, setMessagesByChannel, setDmMessages],
  );

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const prevSnapshot =
        activeView.type === "channel"
          ? messagesByChannel[activeView.id]
          : dmMessages[activeView.id];
      mutateActiveMessages((list) =>
        list.map((m) =>
          m.id === messageId ? { ...m, content: trimmed, edited: true } : m,
        ),
      );
      if (!onlineRef.current) return;
      void (async () => {
        try {
          const payload = await encryptText(trimmed);
          const path =
            activeView.type === "dm"
              ? `/dms/messages/${messageId}`
              : `/channels/messages/${messageId}`;
          await api(path, {
            method: "PATCH",
            body: { content: payload },
          });
        } catch (err) {
          if (prevSnapshot && activeView.type === "channel") {
            setMessagesByChannel((prev) => ({
              ...prev,
              [activeView.id]: prevSnapshot,
            }));
          } else if (prevSnapshot && activeView.type === "dm") {
            setDmMessages((prev) => ({
              ...prev,
              [activeView.id]: prevSnapshot,
            }));
          }
          toast(err instanceof Error ? err.message : "Αποτυχία επεξεργασίας");
        }
      })();
    },
    [
      mutateActiveMessages,
      activeView,
      messagesByChannel,
      dmMessages,
      setMessagesByChannel,
      setDmMessages,
      toast,
    ],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      const prevSnapshot =
        activeView.type === "channel"
          ? messagesByChannel[activeView.id]
          : dmMessages[activeView.id];
      mutateActiveMessages((list) => list.filter((m) => m.id !== messageId));
      if (!onlineRef.current) return;
      const path =
        activeView.type === "dm"
          ? `/dms/messages/${messageId}`
          : `/channels/messages/${messageId}`;
      void api(path, { method: "DELETE" }).catch((err) => {
        if (prevSnapshot && activeView.type === "channel") {
          setMessagesByChannel((prev) => ({
            ...prev,
            [activeView.id]: prevSnapshot,
          }));
        } else if (prevSnapshot && activeView.type === "dm") {
          setDmMessages((prev) => ({
            ...prev,
            [activeView.id]: prevSnapshot,
          }));
        }
        toast(err instanceof Error ? err.message : "Αποτυχία διαγραφής");
      });
    },
    [
      mutateActiveMessages,
      activeView,
      messagesByChannel,
      dmMessages,
      setMessagesByChannel,
      setDmMessages,
      toast,
    ],
  );

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      const me = currentUserRef.current;
      const prevSnapshot =
        activeView.type === "channel"
          ? messagesByChannel[activeView.id]
          : dmMessages[activeView.id];
      mutateActiveMessages((list) =>
        applyReaction(
          list,
          messageId,
          emoji,
          me,
          !list
            .find((m) => m.id === messageId)
            ?.reactions.find((r) => r.emoji === emoji)
            ?.userIds.includes(me),
        ),
      );
      if (!onlineRef.current) return;
      const path =
        activeView.type === "dm"
          ? `/dms/messages/${messageId}/reactions`
          : `/channels/messages/${messageId}/reactions`;
      void api(path, {
        method: "POST",
        body: { emoji },
      }).catch((err) => {
        if (prevSnapshot && activeView.type === "channel") {
          setMessagesByChannel((prev) => ({
            ...prev,
            [activeView.id]: prevSnapshot,
          }));
        } else if (prevSnapshot && activeView.type === "dm") {
          setDmMessages((prev) => ({
            ...prev,
            [activeView.id]: prevSnapshot,
          }));
        }
        toast(err instanceof Error ? err.message : "Αποτυχία reaction");
      });
    },
    [
      mutateActiveMessages,
      activeView,
      messagesByChannel,
      dmMessages,
      setMessagesByChannel,
      setDmMessages,
      toast,
      applyReaction,
    ],
  );

  const setPresence = useCallback(
    (userId: string, status: UserStatus) => {
      setUsers((prev) => {
        if (!prev[userId]) return prev;
        return { ...prev, [userId]: { ...prev[userId], status } };
      });
    },
    [setUsers],
  );

  const setStatus = useCallback(
    (status: UserStatus) => {
      const id = currentUserRef.current;
      setUsers((prev) => ({
        ...prev,
        [id]: { ...prev[id], status },
      }));
      if (onlineRef.current) {
        void api("/friends/me", { method: "PATCH", body: { status } }).catch(
          () => undefined,
        );
      }
    },
    [setUsers],
  );

  const setUserPing = useCallback((userId: string, ping: number | null) => {
    setPings((prev) => {
      if (prev[userId] === ping) return prev;
      return { ...prev, [userId]: ping };
    });
  }, []);

  const getPing = useCallback(
    (userId: string) => pings[userId] ?? null,
    [pings],
  );

  const updateProfile = useCallback(
    (patch: Partial<User>) => {
      const id = currentUserRef.current;
      setUsers((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...patch },
      }));
      if (onlineRef.current) {
        void api("/friends/me", {
          method: "PATCH",
          body: {
            displayName: patch.name,
            bio: patch.bio,
            color: patch.color,
            status: patch.status,
          },
        }).catch(() => undefined);
      }
    },
    [setUsers],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [setSettings],
  );

  const joinVoice = useCallback(
    (channelId: string) => {
      const me = currentUserRef.current;
      setVoice((prev) => {
        const participants = { ...prev.participants };
        if (prev.channelId) {
          participants[prev.channelId] = (
            participants[prev.channelId] ?? []
          ).filter((id) => id !== me);
        }
        participants[channelId] = [
          ...(participants[channelId] ?? []).filter((id) => id !== me),
          me,
        ];
        return { ...prev, channelId, participants };
      });
      if (onlineRef.current) {
        void (async () => {
          try {
            await joinVoiceMesh(channelId, me, false, false, []);
          } catch (err) {
            toast(
              err instanceof Error
                ? err.message
                : "Δεν ανοίγει το μικρόφωνο",
            );
            setVoice((prev) => ({
              ...prev,
              channelId: null,
              participants: {
                ...prev.participants,
                [channelId]: (prev.participants[channelId] ?? []).filter(
                  (id) => id !== me,
                ),
              },
            }));
          }
        })();
      }
    },
    [toast],
  );

  const leaveVoice = useCallback(() => {
    const me = currentUserRef.current;
    setVoice((prev) => {
      if (!prev.channelId) return prev;
      const participants = { ...prev.participants };
      participants[prev.channelId] = (participants[prev.channelId] ?? []).filter(
        (id) => id !== me,
      );
      return { ...prev, channelId: null, participants };
    });
    void leaveVoiceMesh(true);
  }, []);

  const toggleMute = useCallback(() => {
    setVoice((prev) => {
      const muted = !prev.muted;
      if (prev.channelId && onlineRef.current) {
        setLocalVoiceState(muted, prev.deafened);
      }
      return { ...prev, muted };
    });
  }, []);

  const toggleDeafen = useCallback(() => {
    setVoice((prev) => {
      const deafened = !prev.deafened;
      const muted = deafened ? true : prev.muted;
      if (prev.channelId && onlineRef.current) {
        setLocalVoiceState(muted, deafened);
      }
      return { ...prev, deafened, muted };
    });
  }, []);

  const sendFriendRequest = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (onlineRef.current) {
        void (async () => {
          try {
            const { request } = await api<{ request: PendingRequest }>(
              "/friends/requests",
              { method: "POST", body: { username: trimmed } },
            );
            setRequests((prev) => [...prev, request]);
            toast(`Στάλθηκε αίτημα φιλίας στον/στην ${trimmed}`);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Αποτυχία");
          }
        })();
        return;
      }
      const color =
        FRIEND_COLORS[Math.floor(Math.random() * FRIEND_COLORS.length)];
      setRequests((prev) => [
        ...prev,
        {
          id: uid("p"),
          name: trimmed,
          mutual: Math.floor(Math.random() * 5),
          direction: "outgoing",
          color,
        },
      ]);
      toast(`Στάλθηκε αίτημα φιλίας στον/στην ${trimmed}`);
    },
    [setRequests, toast],
  );

  const acceptRequest = useCallback(
    (requestId: string) => {
      if (onlineRef.current) {
        void (async () => {
          try {
            const { friendId } = await api<{ friendId: string }>(
              `/friends/requests/${requestId}/accept`,
              { method: "POST", body: {} },
            );
            setRequests((prev) => prev.filter((r) => r.id !== requestId));
            setMemberIds((ids) =>
              ids.includes(friendId) ? ids : [...ids, friendId],
            );
            try {
              const { friends } = await api<{ friends: import("../lib/api").ApiUser[] }>(
                "/friends",
              );
              setUsers((prev) => {
                const next = { ...prev };
                for (const f of friends) {
                  next[f.id] = {
                    id: f.id,
                    name: f.displayName || f.username,
                    status: (f.status as UserStatus) || "offline",
                    role: f.role,
                    color: f.color,
                    bio: f.bio,
                  };
                }
                return next;
              });
            } catch {
              /* roster refresh best-effort */
            }
            toast("Νέος φίλος προστέθηκε 🎉");
          } catch (err) {
            toast(err instanceof Error ? err.message : "Αποτυχία");
          }
        })();
        return;
      }
      setRequests((prev) => {
        const req = prev.find((r) => r.id === requestId);
        if (!req) return prev;
        const userId = uid("u");
        const newUser: User = {
          id: userId,
          name: req.name,
          status: "online",
          color: req.color,
          bio: "",
        };
        setUsers((u) => ({ ...u, [userId]: newUser }));
        setMemberIds((ids) => [...ids, userId]);
        setDms((d) => [...d, { id: `dm-${userId}`, userId }]);
        toast(`Ο/Η ${req.name} είναι πλέον φίλος σου 🎉`);
        return prev.filter((r) => r.id !== requestId);
      });
    },
    [setRequests, setUsers, setMemberIds, setDms, toast],
  );

  const declineRequest = useCallback(
    (requestId: string) => {
      if (onlineRef.current) {
        void api(`/friends/requests/${requestId}`, { method: "DELETE" }).catch(
          () => undefined,
        );
      }
      setRequests((prev) => {
        const req = prev.find((r) => r.id === requestId);
        if (req) {
          toast(
            req.direction === "incoming"
              ? "Το αίτημα απορρίφθηκε"
              : "Το αίτημα ακυρώθηκε",
          );
        }
        return prev.filter((r) => r.id !== requestId);
      });
    },
    [setRequests, toast],
  );

  const createInvite = useCallback(() => {
    if (onlineRef.current) {
      void (async () => {
        try {
          const { invite } = await api<{ invite: FriendInvite }>(
            "/friends/invites",
            { method: "POST", body: {} },
          );
          setInvites((prev) => [invite, ...prev]);
          toast("Νέο invite link έτοιμο");
        } catch (err) {
          toast(err instanceof Error ? err.message : "Αποτυχία");
        }
      })();
      return;
    }
    const code = `aegis.gg/${Math.random().toString(36).slice(2, 8)}`;
    setInvites((prev) => [
      { id: uid("i"), code, uses: 0, maxUses: 10, expires: "σε 7 μέρες" },
      ...prev,
    ]);
    toast("Νέο invite link έτοιμο");
  }, [setInvites, toast]);

  const createGroup = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (onlineRef.current) {
        void (async () => {
          try {
            const { group } = await api<{ group: Group }>("/friends/groups", {
              method: "POST",
              body: { name: trimmed },
            });
            const withChannels: Group = {
              ...group,
              channels:
                group.channels?.length
                  ? group.channels
                  : makeGroupChannels(group.id, group.name),
            };
            setGroups((prev) => [...prev, withChannels]);
            setActiveGroup(withChannels.id);
            toast(`Ο server «${trimmed}» είναι έτοιμος`);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Αποτυχία");
          }
        })();
        return;
      }
      const color =
        FRIEND_COLORS[Math.floor(Math.random() * FRIEND_COLORS.length)];
      const id = uid("gr");
      const created: Group = {
        id,
        name: trimmed,
        tag: "Server",
        members: [currentUserRef.current],
        activity: "μόλις δημιουργήθηκε",
        color,
        channels: makeGroupChannels(id, trimmed),
      };
      setGroups((prev) => [...prev, created]);
      setActiveGroup(id);
      toast(`Ο server «${trimmed}» είναι έτοιμος`);
    },
    [setGroups, toast, setActiveGroup],
  );

  const inviteToGame = useCallback(
    (userId: string) => {
      const plain =
        "🎮 Πρόσκληση σε παιχνίδι — μπες όποτε είσαι έτοιμος!";
      if (onlineRef.current) {
        void (async () => {
          try {
            const { threadId } = await api<{ threadId: string }>(
              `/dms/with/${userId}`,
              { method: "POST", body: {} },
            );
            const payload = await encryptText(plain);
            const { message } = await api<{ message: Message }>(
              `/dms/${encodeURIComponent(threadId)}/messages`,
              { method: "POST", body: { content: payload } },
            );
            ingestDmMessage(threadId, {
              ...message,
              content: plain,
              encrypted: true,
            });
            toast(
              `Η πρόσκληση στάλθηκε στον/στην ${users[userId]?.name ?? "φίλο"}`,
            );
          } catch (err) {
            toast(err instanceof Error ? err.message : "Αποτυχία");
          }
        })();
        return;
      }
      const dmId = ensureDM(userId);
      const message: Message = {
        id: uid("m"),
        authorId: currentUserRef.current,
        content: plain,
        timestamp: Date.now(),
        encrypted: true,
        reactions: [],
      };
      setDmMessages((prev) => ({
        ...prev,
        [dmId]: [...(prev[dmId] ?? []), message],
      }));
      toast(`Η πρόσκληση στάλθηκε στον/στην ${users[userId]?.name ?? "φίλο"}`);
    },
    [ensureDM, setDmMessages, toast, users, ingestDmMessage],
  );

  const hydrateFromServer = useCallback(
    (payload: BootstrapPayload) => {
      setOnlineMode(true);
      onlineRef.current = true;
      setCurrentUserId(payload.me.id);
      currentUserRef.current = payload.me.id;
      setUsers(payload.users);
      setMemberIds(payload.memberIds);
      setHomeChannels(
        payload.channels.length
          ? payload.channels
          : [...initialTextChannels, ...initialVoiceChannels],
      );
      setDms(payload.dms);
      setMessagesByChannel(payload.messagesByChannel);
      setDmMessages(payload.dmMessages);
      setRequests(payload.requests);
      setInvites(payload.invites);
      setGroups(
        payload.groups.map((g) => ({
          ...g,
          channels:
            g.channels?.length ? g.channels : makeGroupChannels(g.id, g.name),
        })),
      );
      setUnread({});
      setVoice({
        channelId: null,
        muted: false,
        deafened: false,
        participants: {},
      });
      setActiveModule("chat");
      setActiveGroupId(HOME_SERVER_ID);
      const firstText =
        payload.channels.find((c) => c.type === "text")?.id ?? "general";
      setActiveViewState({ type: "channel", id: firstText });
    },
    [
      setUsers,
      setMemberIds,
      setDms,
      setActiveGroupId,
      setMessagesByChannel,
      setDmMessages,
      setRequests,
      setInvites,
      setGroups,
    ],
  );

  const disconnectRealtime = useCallback(() => {
    realtime.disconnect();
  }, []);

  const signOut = useCallback(async () => {
    disconnectRealtime();
    await apiLogout();
    setOnlineMode(false);
    onlineRef.current = false;
    window.location.reload();
  }, [disconnectRealtime]);

  const connectRealtime = useCallback(() => {
    const catchUp = () => {
      void (async () => {
        try {
          const view = activeViewRef.current;
          if (view.type === "channel") {
            const msgs = await fetchChannelMessages(view.id);
            setMessagesByChannel((prev) => ({ ...prev, [view.id]: msgs }));
          } else if (view.id !== "__personal_home__") {
            const msgs = await fetchDmMessages(view.id);
            setDmMessages((prev) => ({ ...prev, [view.id]: msgs }));
          }
        } catch {
          /* ignore catch-up blips */
        }
      })();
    };

    realtime.setHandlers({
      onPresence: (userId, status) => {
        setPresence(userId, status as UserStatus);
      },
      onTyping: (_channelId, userId) => {
        setTypingUserId(userId);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingUserId(null), 2000);
      },
      onMessage: (channelId, message) => {
        ingestChannelMessage(channelId, message as Message);
        const view = activeViewRef.current;
        if (
          view.type === "channel" &&
          view.id === channelId &&
          settingsRef.current.readReceipts
        ) {
          const msg = message as Message;
          markRead(channelId, msg.id);
        }
      },
      onMessageUpdated: (channelId, message) => {
        ingestChannelMessage(channelId, message as Message);
      },
      onMessageDeleted: (channelId, messageId) => {
        removeChannelMessage(channelId, messageId);
      },
      onReaction: (channelId, messageId, emoji, userId, added) => {
        setMessagesByChannel((prev) => ({
          ...prev,
          [channelId]: applyReaction(
            prev[channelId] ?? [],
            messageId,
            emoji,
            userId,
            added,
          ),
        }));
      },
      onDm: (threadId, message) => {
        ingestDmMessage(threadId, message as Message);
        const view = activeViewRef.current;
        if (
          view.type === "dm" &&
          view.id === threadId &&
          settingsRef.current.readReceipts
        ) {
          markRead(threadId, (message as Message).id);
        }
      },
      onDmUpdated: (threadId, message) => {
        ingestDmMessage(threadId, message as Message);
      },
      onDmDeleted: (threadId, messageId) => {
        removeDmMessage(threadId, messageId);
      },
      onDmReaction: (threadId, messageId, emoji, userId, added) => {
        setDmMessages((prev) => ({
          ...prev,
          [threadId]: applyReaction(
            prev[threadId] ?? [],
            messageId,
            emoji,
            userId,
            added,
          ),
        }));
      },
      onRead: (targetId, userId, lastMessageId) => {
        setReadCursors((prev) => ({
          ...prev,
          [targetId]: { ...(prev[targetId] ?? {}), [userId]: lastMessageId },
        }));
      },
      onFriendRequest: (request) => {
        const req = request as PendingRequest;
        setRequests((prev) =>
          prev.some((r) => r.id === req.id) ? prev : [req, ...prev],
        );
        toast(`Νέο αίτημα φιλίας από ${req.name}`);
      },
      onRtc: (fromUserId, threadId, signal) => {
        void handleRtcSignal(fromUserId, threadId, signal as RtcSignal);
      },
      onVoiceState: (channelId, participants: VoiceParticipant[]) => {
        setVoice((prev) => ({
          ...prev,
          participants: {
            ...prev.participants,
            [channelId]: participants.map((p) => p.userId),
          },
        }));
        void syncVoiceParticipants(participants);
      },
      onVoiceSignal: (channelId, fromUserId, toUserId, signal) => {
        void handleVoiceSignal(
          channelId,
          fromUserId,
          toUserId,
          signal as VoiceSignal,
        );
      },
      onRadioState: (state) => {
        window.dispatchEvent(
          new CustomEvent("aegis-radio-state", { detail: state }),
        );
      },
      onGameSession: (session, action) => {
        window.dispatchEvent(
          new CustomEvent("aegis-game-session", { detail: { session, action } }),
        );
      },
      onPong: (rttMs) => {
        setUserPing(currentUserRef.current, rttMs);
      },
      onHello: (online) => {
        for (const id of online) {
          setPresence(id, "online");
        }
      },
      onOpen: () => {
        catchUp();
        if (
          settingsRef.current.notifications &&
          typeof Notification !== "undefined" &&
          Notification.permission === "default"
        ) {
          void Notification.requestPermission();
        }
      },
      onClose: () => {
        /* UI stays usable offline; reconnect is automatic */
      },
    });
    void realtime.connect();
  }, [
    setPresence,
    ingestChannelMessage,
    ingestDmMessage,
    removeChannelMessage,
    removeDmMessage,
    applyReaction,
    markRead,
    setUserPing,
    setRequests,
    toast,
    setMessagesByChannel,
    setDmMessages,
    setReadCursors,
  ]);

  const value = useMemo<StoreValue>(
    () => ({
      currentUserId,
      onlineMode,
      users,
      memberIds,
      homeChannels,
      dms,
      messagesByChannel,
      dmMessages,
      activeView,
      activeModule,
      typingUserId,
      unread,
      settings,
      voice,
      requests,
      invites,
      groups,
      activeGroupId,
      toasts,
      pings,
      setActiveView,
      setActiveModule,
      setActiveGroup,
      sendMessage,
      editMessage,
      deleteMessage,
      toggleReaction,
      setStatus,
      setUserPing,
      getPing,
      updateProfile,
      updateSettings,
      joinVoice,
      leaveVoice,
      toggleMute,
      toggleDeafen,
      toast,
      openDM,
      sendFriendRequest,
      acceptRequest,
      declineRequest,
      createInvite,
      createGroup,
      inviteToGame,
      hydrateFromServer,
      connectRealtime,
      disconnectRealtime,
      signOut,
      setPresence,
      ingestChannelMessage,
      ingestDmMessage,
      sendTyping,
      readCursors,
      markRead,
    }),
    [
      currentUserId,
      onlineMode,
      users,
      memberIds,
      homeChannels,
      dms,
      messagesByChannel,
      dmMessages,
      activeView,
      activeModule,
      typingUserId,
      unread,
      settings,
      voice,
      requests,
      invites,
      groups,
      activeGroupId,
      toasts,
      pings,
      setActiveView,
      setActiveModule,
      setActiveGroup,
      sendMessage,
      editMessage,
      deleteMessage,
      toggleReaction,
      setStatus,
      setUserPing,
      getPing,
      updateProfile,
      updateSettings,
      joinVoice,
      leaveVoice,
      toggleMute,
      toggleDeafen,
      toast,
      openDM,
      sendFriendRequest,
      acceptRequest,
      declineRequest,
      createInvite,
      createGroup,
      inviteToGame,
      hydrateFromServer,
      connectRealtime,
      disconnectRealtime,
      signOut,
      setPresence,
      ingestChannelMessage,
      ingestDmMessage,
      sendTyping,
      readCursors,
      markRead,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
