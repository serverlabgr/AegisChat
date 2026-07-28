import { useState } from "react";
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
  Activity,
  ArrowUpRight,
  Power,
} from "lucide-react";
import {
  apiKeys as initialKeys,
  bots as initialBots,
  webhooks as initialWebhooks,
  type ApiKey,
  type Bot as BotType,
  type Webhook as WebhookType,
} from "../../data/modules";
import { useStore } from "../../store/store";
import { usePersisted } from "../../lib/persist";
import { copyText } from "../../lib/clipboard";
import { SoonBanner } from "./SoonBanner";
import "./module.css";
import "./DevPortalScreen.css";

type Tab = "keys" | "bots" | "webhooks";

function randomToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 22; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `aeg_live_${out}`;
}

const BOT_ICONS = ["🤖", "🎲", "📣", "🧠", "⚡"];

export function DevPortalScreen() {
  const { toast } = useStore();
  const [tab, setTab] = useState<Tab>("keys");
  const [copied, setCopied] = useState<string | null>(null);
  const [keys, setKeys] = usePersisted<ApiKey[]>("api-keys", initialKeys);
  const [bots, setBots] = usePersisted<BotType[]>("bots", initialBots);
  const [webhooks, setWebhooks] = usePersisted<WebhookType[]>("webhooks", initialWebhooks);
  const [keyFormOpen, setKeyFormOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const [botFormOpen, setBotFormOpen] = useState(false);
  const [botName, setBotName] = useState("");
  const [hookFormOpen, setHookFormOpen] = useState(false);
  const [hookName, setHookName] = useState("");

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
    const key: ApiKey = {
      id: `k-${Date.now()}`,
      label: keyLabel.trim(),
      key: randomToken(),
      created: "μόλις τώρα",
      scopes: ["messages"],
    };
    setKeys((prev) => [key, ...prev]);
    setKeyLabel("");
    setKeyFormOpen(false);
    toast("Νέο API key δημιουργήθηκε");
  };

  const deleteKey = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast("Το API key ανακλήθηκε");
  };

  const createBot = () => {
    if (!botName.trim()) return;
    setBots((prev) => [
      ...prev,
      {
        id: `b-${Date.now()}`,
        name: botName.trim(),
        desc: "Νέο bot — ρύθμισέ το από το Manage",
        online: false,
        icon: BOT_ICONS[Math.floor(Math.random() * BOT_ICONS.length)],
      },
    ]);
    setBotName("");
    setBotFormOpen(false);
    toast("Το bot δημιουργήθηκε");
  };

  const toggleBot = (id: string) => {
    setBots((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        toast(b.online ? `Το ${b.name} σταμάτησε` : `Το ${b.name} ξεκίνησε 🟢`);
        return { ...b, online: !b.online };
      }),
    );
  };

  const createWebhook = () => {
    if (!hookName.trim()) return;
    setWebhooks((prev) => [
      ...prev,
      {
        id: `w-${Date.now()}`,
        name: hookName.trim(),
        target: `https://aegis.gg/hooks/${Math.random().toString(36).slice(2, 8)}`,
        events: 0,
      },
    ]);
    setHookName("");
    setHookFormOpen(false);
    toast("Το webhook δημιουργήθηκε");
  };

  const deleteWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    toast("Το webhook διαγράφηκε");
  };

  return (
    <div className="module">
      <header className="module__header">
        <span className="module__header-icon">
          <Code2 size={18} />
        </span>
        <span className="module__title">Developer Portal</span>
        <span className="module__sub">API, bots & automations για την παρέα</span>
        <div className="module__header-actions">
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => toast("Τα docs έρχονται με το πρώτο public release")}
          >
            <BookOpen size={15} />
            Docs
          </button>
        </div>
      </header>

      <div className="module__body">
        <SoonBanner feature="Dev Portal" />
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div className="card dev-stat">
            <span className="dev-stat__label"><Activity size={13} /> API calls (24h)</span>
            <strong>12,486</strong>
            <span className="dev-stat__trend">+8% <ArrowUpRight size={12} /></span>
          </div>
          <div className="card dev-stat">
            <span className="dev-stat__label"><Bot size={13} /> Ενεργά bots</span>
            <strong>{bots.filter((b) => b.online).length}</strong>
            <span className="dev-stat__sub">από {bots.length}</span>
          </div>
          <div className="card dev-stat">
            <span className="dev-stat__label"><Webhook size={13} /> Webhooks</span>
            <strong>{webhooks.length}</strong>
            <span className="dev-stat__sub">{webhooks.reduce((a, w) => a + w.events, 0)} events</span>
          </div>
          <div className="card dev-stat">
            <span className="dev-stat__label"><KeyRound size={13} /> API keys</span>
            <strong>{keys.length}</strong>
            <span className="dev-stat__sub">active</span>
          </div>
        </div>

        <div className="module__tabs" style={{ padding: "18px 0 0" }}>
          <button className={`module__tab${tab === "keys" ? " module__tab--active" : ""}`} onClick={() => setTab("keys")}>
            <KeyRound size={15} /> API Keys
          </button>
          <button className={`module__tab${tab === "bots" ? " module__tab--active" : ""}`} onClick={() => setTab("bots")}>
            <Bot size={15} /> Bots
          </button>
          <button className={`module__tab${tab === "webhooks" ? " module__tab--active" : ""}`} onClick={() => setTab("webhooks")}>
            <Webhook size={15} /> Webhooks
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          {tab === "keys" ? (
            <div className="dev-list">
              {keyFormOpen ? (
                <div className="module__inline-form module__inline-form--flush">
                  <input
                    autoFocus
                    placeholder="Όνομα key, π.χ. Bot · MusicBot"
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createKey();
                      if (e.key === "Escape") setKeyFormOpen(false);
                    }}
                  />
                  <button className="btn btn--primary btn--sm" onClick={createKey} disabled={!keyLabel.trim()}>
                    Δημιουργία
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setKeyFormOpen(false)}>
                    Άκυρο
                  </button>
                </div>
              ) : null}
              {keys.map((k) => (
                <div key={k.id} className="card dev-row">
                  <span className="dev-row__icon"><KeyRound size={17} /></span>
                  <div className="dev-row__info">
                    <span className="dev-row__name">{k.label}</span>
                    <code className="dev-row__code">{`${k.key.slice(0, 13)}…${k.key.slice(-4)}`}</code>
                    <div className="dev-row__scopes">
                      {k.scopes.map((s) => (
                        <span key={s} className="chip">{s}</span>
                      ))}
                      <span className="dev-row__meta">δημιουργήθηκε {k.created}</span>
                    </div>
                  </div>
                  <div className="dev-row__actions">
                    <button className="btn btn--sm btn--ghost" onClick={() => void copy(k.id, k.key)}>
                      {copied === k.id ? <Check size={14} /> : <Copy size={14} />}
                      {copied === k.id ? "OK" : "Copy"}
                    </button>
                    <button
                      className="btn btn--sm btn--danger"
                      title="Διαγραφή key"
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
                    placeholder="Όνομα bot, π.χ. QuizBot"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createBot();
                      if (e.key === "Escape") setBotFormOpen(false);
                    }}
                  />
                  <button className="btn btn--primary btn--sm" onClick={createBot} disabled={!botName.trim()}>
                    Δημιουργία
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setBotFormOpen(false)}>
                    Άκυρο
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
                        <span className={`dot dot--${b.online ? "online" : "offline"}`} />
                      </span>
                      <span className="dev-bot__desc">{b.desc}</span>
                    </div>
                    <button
                      className={`btn btn--sm ${b.online ? "btn--danger" : "btn--primary"}`}
                      onClick={() => toggleBot(b.id)}
                    >
                      <Power size={13} />
                      {b.online ? "Stop" : "Start"}
                    </button>
                  </div>
                ))}
                <button className="card dev-bot dev-bot--new" onClick={() => setBotFormOpen(true)}>
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
                    placeholder="Όνομα webhook, π.χ. GitHub → #dev-talk"
                    value={hookName}
                    onChange={(e) => setHookName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createWebhook();
                      if (e.key === "Escape") setHookFormOpen(false);
                    }}
                  />
                  <button className="btn btn--primary btn--sm" onClick={createWebhook} disabled={!hookName.trim()}>
                    Δημιουργία
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setHookFormOpen(false)}>
                    Άκυρο
                  </button>
                </div>
              ) : null}
              {webhooks.map((w) => (
                <div key={w.id} className="card dev-row">
                  <span className="dev-row__icon"><Webhook size={17} /></span>
                  <div className="dev-row__info">
                    <span className="dev-row__name">{w.name}</span>
                    <code className="dev-row__code">{w.target}</code>
                    <span className="dev-row__meta">{w.events} events delivered</span>
                  </div>
                  <div className="dev-row__actions">
                    <button className="btn btn--sm btn--ghost" onClick={() => void copy(w.id, w.target)}>
                      {copied === w.id ? <Check size={14} /> : <Copy size={14} />}
                      {copied === w.id ? "OK" : "URL"}
                    </button>
                    <button
                      className="btn btn--sm btn--danger"
                      title="Διαγραφή webhook"
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
    </div>
  );
}
