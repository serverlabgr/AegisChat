import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Plus, Send, Trash2, Loader2 } from "lucide-react";
import { useStore } from "../../store/store";
import { api } from "../../lib/api";
import "./module.css";
import "./AiChatScreen.css";

type AiThread = {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
};

type AiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
};

export function AiChatScreen() {
  const { toast, onlineMode } = useStore();
  const [status, setStatus] = useState<{
    configured: boolean;
    reachable: boolean;
    defaultModel: string;
  } | null>(null);
  const [models, setModels] = useState<{ name: string }[]>([]);
  const [model, setModel] = useState("");
  const [threads, setThreads] = useState<AiThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!onlineMode) return;
    try {
      const s = await api<{
        configured: boolean;
        reachable: boolean;
        defaultModel: string;
      }>("/ai/status");
      setStatus(s);
      if (!model && s.defaultModel) setModel(s.defaultModel);
      if (s.configured) {
        const m = await api<{ models: { name: string }[]; error?: string }>(
          "/ai/models",
        );
        setModels(m.models ?? []);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία AI status");
    }
  }, [onlineMode, toast, model]);

  const refreshThreads = useCallback(async () => {
    if (!onlineMode) return;
    try {
      const { threads: list } = await api<{ threads: AiThread[] }>(
        "/ai/threads",
      );
      setThreads(list);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία threads");
    }
  }, [onlineMode, toast]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      try {
        const { messages: msgs } = await api<{ messages: AiMessage[] }>(
          `/ai/threads/${threadId}/messages`,
        );
        setMessages(msgs);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Αποτυχία μηνυμάτων");
      }
    },
    [toast],
  );

  useEffect(() => {
    void refreshStatus();
    void refreshThreads();
  }, [refreshStatus, refreshThreads]);

  useEffect(() => {
    if (activeId) void loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const newChat = async () => {
    if (!onlineMode) {
      toast("Χρειάζεται online");
      return;
    }
    try {
      const { thread } = await api<{ thread: AiThread }>("/ai/threads", {
        method: "POST",
        body: { model: model || undefined },
      });
      setThreads((prev) => [thread, ...prev]);
      setActiveId(thread.id);
      setMessages([]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία");
    }
  };

  const removeThread = async (id: string) => {
    try {
      await api(`/ai/threads/${id}`, { method: "DELETE" });
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      toast("Διαγράφηκε η συνομιλία");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία διαγραφής");
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!onlineMode) {
      toast("Χρειάζεται online");
      return;
    }
    if (!status?.configured) {
      toast("Ollama δεν είναι ρυθμισμένο στο server (OLLAMA_URL)");
      return;
    }
    setBusy(true);
    setInput("");
    // Optimistic user bubble
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: text,
        createdAt: Date.now(),
      },
    ]);
    try {
      const res = await api<{
        threadId: string;
        model: string;
        userMessage: AiMessage;
        assistantMessage: AiMessage;
      }>("/ai/chat", {
        method: "POST",
        body: {
          threadId: activeId ?? undefined,
          content: text,
          model: model || undefined,
        },
      });
      if (!activeId) {
        setActiveId(res.threadId);
        await refreshThreads();
      } else {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === res.threadId
              ? { ...t, updatedAt: Date.now(), model: res.model }
              : t,
          ),
        );
      }
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return [...withoutTemp, res.userMessage, res.assistantMessage];
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
      toast(err instanceof Error ? err.message : "Αποτυχία AI");
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = !onlineMode
    ? "offline"
    : !status
      ? "…"
      : !status.configured
        ? "χωρίς OLLAMA_URL"
        : status.reachable
          ? `Ollama · ${model || status.defaultModel}`
          : "Ollama unreachable";

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Bot size={18} />
        </span>
        <span className="module__title">AI Chat</span>
        <span className="module__sub">{statusLabel}</span>
        <div className="module__header-actions">
          {models.length > 0 ? (
            <select
              className="ai-model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              title="Μοντέλο"
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void newChat()}
          >
            <Plus size={14} /> Νέα
          </button>
        </div>
      </header>

      <div className="ai-layout">
        <aside className="ai-sidebar">
          {threads.length === 0 ? (
            <p className="ai-sidebar__empty">Καμία συνομιλία ακόμα</p>
          ) : (
            <ul className="ai-thread-list">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`ai-thread${activeId === t.id ? " ai-thread--on" : ""}`}
                    onClick={() => setActiveId(t.id)}
                  >
                    <span className="ai-thread__title">{t.title}</span>
                    <span className="ai-thread__meta">{t.model}</span>
                  </button>
                  <button
                    type="button"
                    className="ai-thread__del"
                    title="Διαγραφή"
                    onClick={() => void removeThread(t.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="ai-main">
          {!status?.configured ? (
            <div className="ai-empty">
              <Bot size={36} />
              <p>
                Βάλε στο server <code>OLLAMA_URL</code> (π.χ.{" "}
                <code>http://192.168.1.235:11434</code>) και{" "}
                <code>OLLAMA_MODEL</code>, μετά rebuild το API.
              </p>
            </div>
          ) : messages.length === 0 && !busy ? (
            <div className="ai-empty">
              <Bot size={36} />
              <p>Ρώτα ό,τι θες — μιλάει με το δικό σου Ollama.</p>
            </div>
          ) : (
            <div className="ai-messages">
              {messages
                .filter((m) => m.role !== "system")
                .map((m) => (
                  <div
                    key={m.id}
                    className={`ai-bubble ai-bubble--${m.role}`}
                  >
                    <span className="ai-bubble__role">
                      {m.role === "user" ? "Εσύ" : "AI"}
                    </span>
                    <div className="ai-bubble__text">{m.content}</div>
                  </div>
                ))}
              {busy ? (
                <div className="ai-bubble ai-bubble--assistant">
                  <span className="ai-bubble__role">AI</span>
                  <div className="ai-bubble__text ai-bubble__thinking">
                    <Loader2 size={16} className="ai-spin" /> Σκέφτεται…
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}

          <form
            className="ai-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                status?.configured
                  ? "Μήνυμα προς το chatbot…"
                  : "Ollama δεν είναι ρυθμισμένο"
              }
              disabled={busy || !status?.configured}
              maxLength={16000}
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={busy || !input.trim() || !status?.configured}
            >
              {busy ? <Loader2 size={16} className="ai-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
