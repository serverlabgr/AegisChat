import { useEffect, useState } from "react";
import {
  Code2,
  KeyRound,
  Bot,
  Webhook,
  Plus,
  Copy,
  Check,
  Trash2,
  BookOpen,
} from "lucide-react";
import type { ApiKey, Bot as BotType, Webhook as WebhookType } from "../../data/modules";
import { useStore } from "../../store/store";
import { usePersisted } from "../../lib/persist";
import { copyText } from "../../lib/clipboard";
import { api } from "../../lib/api";
import { loadServerUrl } from "../../lib/serverConfig";
import "./module.css";
import "./DevPortalScreen.css";

type Tab = "keys" | "bots" | "webhooks";

const BOT_ICONS = ["🤖", "🎲", "📣", "🧠", "⚡"];

export function DevPortalScreen() {
  const { toast, onlineMode, homeChannels } = useStore();
  const [tab, setTab] = useState<Tab>("keys");
  const [copied, setCopied] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [bots, setBots] = usePersisted<BotType[]>("bots", []);
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [keyFormOpen, setKeyFormOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const [botFormOpen, setBotFormOpen] = useState(false);
  const [botName, setBotName] = useState("");
  const [hookFormOpen, setHookFormOpen] = useState(false);
  const [hookName, setHookName] = useState("");
  const [hookChannel, setHookChannel] = useState("general");

  const refresh = async () => {
    if (!onlineMode) return;
    try {
      const [tok, hooks] = await Promise.all([
        api<{ tokens: ApiKey[] }>("/tokens"),
        api<{
          webhooks: {
            id: string;
            name: string;
            channel: string;
            url: string;
          }[];
        }>("/tokens/webhooks"),
      ]);
      setKeys(tok.tokens);
      const base = loadServerUrl().replace(/\/$/, "");
      setWebhooks(
        hooks.webhooks.map((w) => ({
          id: w.id,
          name: w.name,
          target: `${base}${w.url}`,
          events: 0,
        })),
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Αποτυχία φόρτωσης");
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineMode]);

  const copy = async (id: string, text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
    } else {
      toast("Δεν ήταν δυνατή η αντιγραφή");
    }
  };

  const createKey = () => {
    if (!keyLabel.trim()) return;
    if (!onlineMode) {
      toast("Χρειάζεται online");
      return;
    }
    void (async () => {
      try {
        const { token } = await api<{ token: ApiKey }>("/tokens", {
          method: "POST",
          body: { label: keyLabel.trim() },
        });
        setKeys((prev) => [token, ...prev]);
        setKeyLabel("");
        setKeyFormOpen(false);
        toast("Νέο API key — αντιγράψε το τώρα (φαίνεται μία φορά)");
        await copy(token.id, token.key);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Αποτυχία");
      }
    })();
  };

  const deleteKey = (id: string) => {
    if (!onlineMode) return;
    void api(`/tokens/${id}`, { method: "DELETE" })
      .then(() => {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        toast("Το API key ανακλήθηκε");
      })
      .catch((err) => toast(err instanceof Error ? err.message : "Αποτυχία"));
  };

  const createBot = () => {
    if (!botName.trim()) return;
    setBots((prev) => [
      ...prev,
      {
        id: `b-${Date.now()}`,
        name: botName.trim(),
        desc: "Τοπικό bot label — χρησιμοποίησε API key για πραγματικά hooks",
        online: false,
        icon: BOT_ICONS[Math.floor(Math.random() * BOT_ICONS.length)],
      },
    ]);
    setBotName("");
    setBotFormOpen(false);
    toast("Το bot label δημιουργήθηκε");
  };

  const toggleBot = (id: string) => {
    setBots((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        toast(b.online ? `Το ${b.name} σταμάτησε` : `Το ${b.name} ξεκίνησε`);
        return { ...b, online: !b.online };
      }),
    );
  };

  const createWebhook = () => {
    if (!hookName.trim()) return;
    if (!onlineMode) {
      toast("Χρειάζεται online");
      return;
    }
    void (async () => {
      try {
        const { webhook } = await api<{
          webhook: {
            id: string;
            name: string;
            channel: string;
            url: string;
            token: string;
          };
        }>("/tokens/webhooks", {
          method: "POST",
          body: { name: hookName.trim(), channelId: hookChannel },
        });
        const base = loadServerUrl().replace(/\/$/, "");
        setWebhooks((prev) => [
          {
            id: webhook.id,
            name: webhook.name,
            target: `${base}${webhook.url}`,
            events: 0,
          },
          ...prev,
        ]);
        setHookName("");
        setHookFormOpen(false);
        toast("Webhook έτοιμο — κράτα το token");
        await copy(webhook.id, webhook.token);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Αποτυχία");
      }
    })();
  };

  const deleteWebhook = (id: string) => {
    if (!onlineMode) return;
    void api(`/tokens/webhooks/${id}`, { method: "DELETE" })
      .then(() => {
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
        toast("Το webhook διαγράφηκε");
      })
      .catch((err) => toast(err instanceof Error ? err.message : "Αποτυχία"));
  };

  const textChannels = homeChannels.filter((c) => c.type === "text");

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Code2 size={18} />
        </span>
        <span className="module__title">Developer Portal</span>
        <span className="module__sub">API tokens & webhooks</span>
        <div className="module__header-actions">
          <button
            className="btn btn--sm btn--ghost"
            onClick={() =>
              toast("POST /hooks/:id με { content, token } → μήνυμα στο κανάλι")
            }
          >
            <BookOpen size={15} />
            Docs
          </button>
        </div>
      </header>

      <div className="module__body">
        <div className="module__tabs" style={{ padding: "0 0 12px" }}>
          <button
            className={`module__tab${tab === "keys" ? " module__tab--active" : ""}`}
            onClick={() => setTab("keys")}
          >
            <KeyRound size={15} /> API Keys
          </button>
          <button
            className={`module__tab${tab === "bots" ? " module__tab--active" : ""}`}
            onClick={() => setTab("bots")}
          >
            <Bot size={15} /> Bots
          </button>
          <button
            className={`module__tab${tab === "webhooks" ? " module__tab--active" : ""}`}
            onClick={() => setTab("webhooks")}
          >
            <Webhook size={15} /> Webhooks
          </button>
        </div>

        {tab === "keys" ? (
          <div className="dev-list">
            {keyFormOpen ? (
              <div className="module__inline-form module__inline-form--flush">
                <input
                  autoFocus
                  placeholder="Όνομα key"
                  value={keyLabel}
                  onChange={(e) => setKeyLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createKey();
                    if (e.key === "Escape") setKeyFormOpen(false);
                  }}
                />
                <button
                  className="btn btn--primary btn--sm"
                  onClick={createKey}
                  disabled={!keyLabel.trim()}
                >
                  Δημιουργία
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setKeyFormOpen(false)}
                >
                  Άκυρο
                </button>
              </div>
            ) : null}
            {keys.map((k) => (
              <div key={k.id} className="card dev-row">
                <span className="dev-row__icon">
                  <KeyRound size={17} />
                </span>
                <div className="dev-row__info">
                  <span className="dev-row__name">{k.label}</span>
                  <code className="dev-row__code">{k.key}</code>
                  <div className="dev-row__scopes">
                    {k.scopes.map((s) => (
                      <span key={s} className="chip">
                        {s}
                      </span>
                    ))}
                    <span className="dev-row__meta">{k.created}</span>
                  </div>
                </div>
                <div className="dev-row__actions">
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={() => void copy(k.id, k.key)}
                  >
                    {copied === k.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => deleteKey(k.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!keyFormOpen ? (
              <button
                className="btn btn--primary"
                style={{ alignSelf: "flex-start" }}
                onClick={() => setKeyFormOpen(true)}
              >
                <Plus size={15} /> Νέο API key
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === "bots" ? (
          <>
            {botFormOpen ? (
              <div className="module__inline-form module__inline-form--flush">
                <input
                  autoFocus
                  placeholder="Όνομα bot"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createBot();
                    if (e.key === "Escape") setBotFormOpen(false);
                  }}
                />
                <button
                  className="btn btn--primary btn--sm"
                  onClick={createBot}
                  disabled={!botName.trim()}
                >
                  Δημιουργία
                </button>
              </div>
            ) : null}
            <div className="grid grid--cards">
              {bots.map((b) => (
                <div key={b.id} className="card card--hover dev-bot">
                  <span className="dev-bot__icon">{b.icon}</span>
                  <div className="dev-bot__info">
                    <span className="dev-bot__name">
                      {b.name}
                      <span
                        className={`dot dot--${b.online ? "online" : "offline"}`}
                      />
                    </span>
                    <span className="dev-bot__desc">{b.desc}</span>
                  </div>
                  <button
                    className={`btn btn--sm ${b.online ? "btn--danger" : "btn--primary"}`}
                    onClick={() => toggleBot(b.id)}
                  >
                    {b.online ? "Stop" : "Start"}
                  </button>
                </div>
              ))}
              <button
                className="card dev-bot dev-bot--new"
                onClick={() => setBotFormOpen(true)}
              >
                <Plus size={20} />
                <span>Νέο bot</span>
              </button>
            </div>
          </>
        ) : null}

        {tab === "webhooks" ? (
          <div className="dev-list">
            {hookFormOpen ? (
              <div className="module__inline-form module__inline-form--flush">
                <input
                  autoFocus
                  placeholder="Όνομα webhook"
                  value={hookName}
                  onChange={(e) => setHookName(e.target.value)}
                />
                <select
                  value={hookChannel}
                  onChange={(e) => setHookChannel(e.target.value)}
                >
                  {textChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn--primary btn--sm"
                  onClick={createWebhook}
                  disabled={!hookName.trim()}
                >
                  Δημιουργία
                </button>
              </div>
            ) : null}
            {webhooks.map((w) => (
              <div key={w.id} className="card dev-row">
                <span className="dev-row__icon">
                  <Webhook size={17} />
                </span>
                <div className="dev-row__info">
                  <span className="dev-row__name">{w.name}</span>
                  <code className="dev-row__code">{w.target}</code>
                </div>
                <div className="dev-row__actions">
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={() => void copy(w.id, w.target)}
                  >
                    {copied === w.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => deleteWebhook(w.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!hookFormOpen ? (
              <button
                className="btn btn--primary"
                style={{ alignSelf: "flex-start" }}
                onClick={() => setHookFormOpen(true)}
              >
                <Plus size={15} /> Νέο webhook
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
