import { useState } from "react";
import {
  Gamepad2,
  ArrowRight,
  Minus,
  Square,
  X,
  LogIn,
  UserPlus,
} from "lucide-react";
import { isTauri } from "../../lib/tauriEnv";
import { login, register } from "../../lib/api";
import { bootstrapForUser } from "../../lib/session";
import { loadServerUrl, saveServerUrl } from "../../lib/serverConfig";
import { bootstrapVault } from "../../lib/vault";
import { useStore } from "../../store/store";
import { RecoveryKeyModal } from "../modals/RecoveryKeyModal";
import "./ConnectScreen.css";

interface ConnectScreenProps {
  onConnect: () => void;
}

type Mode = "login" | "register";

async function withWindow(
  action: (win: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
  }) => Promise<void>,
) {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await action(getCurrentWindow());
  } catch {
    /* Window APIs can fail outside a healthy Tauri shell */
  }
}

export function ConnectScreen({ onConnect }: ConnectScreenProps) {
  const { hydrateFromServer, toast } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const isDev = import.meta.env.DEV;
  const [serverUrl, setServerUrl] = useState(loadServerUrl);
  const [username, setUsername] = useState(isDev ? "admin" : "");
  const [password, setPassword] = useState(isDev ? "changeme123" : "");
  const [inviteCode, setInviteCode] = useState(isDev ? "parea-x9f2" : "");
  const [displayName, setDisplayName] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newRecovery, setNewRecovery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      saveServerUrl(serverUrl);
      const auth =
        mode === "login"
          ? await login(username.trim(), password)
          : await register({
              inviteCode: inviteCode.trim(),
              username: username.trim(),
              password,
              displayName: displayName.trim() || undefined,
            });
      const vault = await bootstrapVault({
        password,
        recoveryKey: recoveryKey.trim() || undefined,
      });
      const boot = await bootstrapForUser(auth.user);
      hydrateFromServer(boot);
      toast(`Καλώς ήρθες, ${boot.me.name}`);
      if (vault.recoveryKey) {
        setNewRecovery(vault.recoveryKey);
      } else {
        onConnect();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία σύνδεσης");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="connect">
      <div className="connect__chrome" data-tauri-drag-region>
        <button
          type="button"
          className="connect__win"
          aria-label="Minimize"
          onClick={() => void withWindow((w) => w.minimize())}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="connect__win"
          aria-label="Maximize"
          onClick={() => void withWindow((w) => w.toggleMaximize())}
        >
          <Square size={11} />
        </button>
        <button
          type="button"
          className="connect__win connect__win--close"
          aria-label="Close"
          onClick={() => void withWindow((w) => w.close())}
        >
          <X size={14} />
        </button>
      </div>

      <div className="connect__panel">
        <div className="connect__glow" />
        <header className="connect__header">
          <div className="connect__logo">
            <Gamepad2 size={30} />
          </div>
          <h1>Aegis</h1>
          <p className="connect__tag">Το στέκι της παρέας σου</p>
        </header>

        <div className="connect__modes">
          <button
            type="button"
            className={`connect__mode${mode === "login" ? " connect__mode--on" : ""}`}
            onClick={() => setMode("login")}
          >
            <LogIn size={14} /> Σύνδεση
          </button>
          <button
            type="button"
            className={`connect__mode${mode === "register" ? " connect__mode--on" : ""}`}
            onClick={() => setMode("register")}
          >
            <UserPlus size={14} /> Πρόσκληση
          </button>
        </div>

        <form
          className="connect__form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="connect__field">
            <span>Server URL</span>
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.235:3001"
              autoComplete="url"
              required
            />
          </label>

          {mode === "register" ? (
            <>
              <label className="connect__field">
                <span>Invite code</span>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="connect__field">
                <span>Εμφανιζόμενο όνομα</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="προαιρετικό"
                />
              </label>
            </>
          ) : null}

          <label className="connect__field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="connect__field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "register" ? 8 : 1}
            />
          </label>

          <label className="connect__field">
            <span>Recovery Key παρέας</span>
            <input
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="AEGIS-…. (αν το έχεις — αλλιώς άστο κενό)"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <p className="connect__hint">
            Όλα (μηνύματα, φωτο, video) κρυπτογραφούνται στον υπολογιστή σου. Το server
            κρατά μόνο ciphertext. Το πρώτο μέλος δημιουργεί το Recovery Key· οι υπόλοιποι
            το βάζουν εδώ μία φορά.
          </p>

          {error ? <p className="connect__error">{error}</p> : null}

          <button type="submit" className="connect__btn" disabled={busy}>
            {busy
              ? "Σύνδεση…"
              : mode === "login"
                ? "Μπες στην παρέα"
                : "Δημιούργησε λογαριασμό"}
            {!busy ? <ArrowRight size={18} /> : null}
          </button>
        </form>

        <footer className="connect__footer">
          {import.meta.env.DEV ? (
            <>
              <span>Dev: admin / changeme123</span>
              <span className="connect__dot" />
              <span>invite: parea-x9f2</span>
            </>
          ) : (
            <span>Invite-only · Aegis για την παρέα</span>
          )}
        </footer>
      </div>

      {newRecovery ? (
        <RecoveryKeyModal
          recoveryKey={newRecovery}
          onClose={() => {
            setNewRecovery(null);
            onConnect();
          }}
        />
      ) : null}
    </div>
  );
}
