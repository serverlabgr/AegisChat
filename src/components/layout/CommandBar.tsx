import { useEffect, useState } from "react";
import {
  Gamepad2,
  ChevronDown,
  Search,
  Minus,
  Square,
  X,
  Users,
  Activity,
  Smile,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { useStore } from "../../store/store";
import { BUILD_VERSION, getAppVersion } from "../../lib/appVersion";
import { pingTone } from "../../lib/ping";
import { HudReadout } from "../common/Hud";
import "./CommandBar.css";

async function withWindow(action: (win: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
  if (!isTauri()) return;
  await action(getCurrentWindow());
}

export function CommandBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { users, memberIds, currentUserId, getPing } = useStore();
  const [version, setVersion] = useState(BUILD_VERSION);
  const online = memberIds.filter((id) => users[id]?.status !== "offline").length;
  const ping = getPing(currentUserId);
  const pingLabel = ping == null ? "—" : `${ping}ms`;

  useEffect(() => {
    void getAppVersion().then(setVersion);
  }, []);

  return (
    <header className="cmdbar" data-tauri-drag-region>
      <div className="cmdbar__identity">
        <div className="cmdbar__logo">
          <Gamepad2 size={15} />
        </div>
        <div className="cmdbar__node">
          <span className="cmdbar__node-name">AEGIS</span>
          <span className="cmdbar__node-sub">η παρέα</span>
        </div>
        <button type="button" className="cmdbar__switch" aria-label="Switch node">
          <ChevronDown size={14} />
        </button>
      </div>

      <button type="button" className="cmdbar__command" onClick={onOpenCommand}>
        <Search size={14} />
        <span className="cmdbar__command-text">Αναζήτηση ή μετάβαση…</span>
        <kbd className="cmdbar__kbd">Ctrl K</kbd>
      </button>

      <div className="cmdbar__hud">
        <HudReadout
          label="online"
          tone="ok"
          value={`${online} φίλοι`}
          icon={<Users size={11} />}
        />
        <HudReadout
          label="ping"
          tone={pingTone(ping)}
          value={pingLabel}
          icon={<Activity size={11} />}
        />
        <HudReadout label="mood" value="chill" icon={<Smile size={11} />} />
      </div>

      <span className="cmdbar__version" title={`Aegis v${version}`} aria-label={`Version ${version}`}>
        v{version}
      </span>

      <div className="cmdbar__controls">
        <button
          type="button"
          className="cmdbar__win"
          aria-label="Minimize"
          onClick={() => void withWindow((w) => w.minimize())}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="cmdbar__win"
          aria-label="Maximize"
          onClick={() => void withWindow((w) => w.toggleMaximize())}
        >
          <Square size={11} />
        </button>
        <button
          type="button"
          className="cmdbar__win cmdbar__win--close"
          aria-label="Close"
          onClick={() => void withWindow((w) => w.close())}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
