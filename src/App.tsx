import { startTransition, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ConnectScreen } from "./components/screens/ConnectScreen";
import { MainScreen } from "./components/screens/MainScreen";
import { PingTicker } from "./components/common/PingTicker";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { UpdateAvailableModal } from "./components/modals/UpdateAvailableModal";
import { StoreProvider, useStore } from "./store/store";
import { applyAccent } from "./lib/color";
import { tryRestoreSession } from "./lib/session";
import { checkForAppUpdate, installAppUpdate } from "./lib/updater";
import "./styles/global.css";

type Screen = "boot" | "connect" | "main";

const SKIP_KEY = "aegis:skipUpdateVersion";

function useViewportScrollGuard() {
  useEffect(() => {
    const reset = () => {
      const de = document.documentElement;
      const body = document.body;
      const root = document.getElementById("root");
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
      if (de.scrollTop !== 0 || de.scrollLeft !== 0) {
        de.scrollTop = 0;
        de.scrollLeft = 0;
      }
      if (body.scrollTop !== 0 || body.scrollLeft !== 0) {
        body.scrollTop = 0;
        body.scrollLeft = 0;
      }
      if (root && (root.scrollTop !== 0 || root.scrollLeft !== 0)) {
        root.scrollTop = 0;
        root.scrollLeft = 0;
      }
    };
    reset();
    window.addEventListener("scroll", reset, true);
    return () => window.removeEventListener("scroll", reset, true);
  }, []);
}

function AppShell() {
  const [screen, setScreen] = useState<Screen>("boot");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updatePercent, setUpdatePercent] = useState<number | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const { settings, hydrateFromServer, connectRealtime, disconnectRealtime, onlineMode, toast } =
    useStore();

  useViewportScrollGuard();

  useEffect(() => {
    applyAccent(settings.accent);
  }, [settings.accent]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const boot = await tryRestoreSession();
        if (cancelled) return;
        startTransition(() => {
          if (boot) {
            hydrateFromServer(boot);
            setScreen("main");
          } else {
            setScreen("connect");
          }
        });
      } catch {
        if (!cancelled) setScreen("connect");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromServer]);

  useEffect(() => {
    if (screen === "main" && onlineMode) {
      connectRealtime();
      return () => disconnectRealtime();
    }
    return undefined;
  }, [screen, onlineMode, connectRealtime, disconnectRealtime]);

  useEffect(() => {
    if (screen !== "main" || !isTauri()) return;
    let cancelled = false;

    const runCheck = async () => {
      const res = await checkForAppUpdate();
      if (cancelled || !res.available || !res.version) return;
      try {
        if (localStorage.getItem(SKIP_KEY) === res.version) return;
      } catch {
        /* ignore */
      }
      setUpdateVersion(res.version);
    };

    // Defer so first paint / WS connect stay responsive
    const initial = window.setTimeout(() => {
      void runCheck();
    }, 8000);
    const interval = window.setInterval(() => {
      void runCheck();
    }, 4 * 60 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [screen]);

  if (screen === "boot") {
    return (
      <div className="app">
        <div className="boot-splash">Σύνδεση…</div>
      </div>
    );
  }

  return (
    <div className="app">
      {!onlineMode ? <PingTicker /> : null}
      {screen === "connect" ? (
        <ConnectScreen
          onConnect={() => {
            setScreen("main");
          }}
        />
      ) : (
        <MainScreen />
      )}
      {updateVersion ? (
        <UpdateAvailableModal
          version={updateVersion}
          busy={updateBusy}
          progressPercent={updatePercent}
          statusText={updateStatus}
          onSkip={() => {
            if (updateBusy) return;
            try {
              localStorage.setItem(SKIP_KEY, updateVersion);
            } catch {
              /* ignore */
            }
            setUpdateVersion(null);
          }}
          onInstall={() => {
            setUpdateBusy(true);
            setUpdatePercent(0);
            setUpdateStatus("Ενημέρωση… η εφαρμογή θα επανεκκινήσει");
            void (async () => {
              const result = await installAppUpdate((p) => {
                if (p.phase === "downloading") {
                  setUpdatePercent(
                    typeof p.percent === "number" ? p.percent : null,
                  );
                  setUpdateStatus(
                    typeof p.percent === "number"
                      ? `Λήψη… ${p.percent}%`
                      : "Λήψη…",
                  );
                } else if (p.phase === "installing") {
                  setUpdatePercent(100);
                  setUpdateStatus("Εγκατάσταση… η εφαρμογή θα επανεκκινήσει");
                } else if (p.phase === "relaunching") {
                  setUpdateStatus("Επανεκκίνηση…");
                }
              });
              if (!result.ok) {
                setUpdateBusy(false);
                setUpdatePercent(null);
                setUpdateStatus(null);
                toast(result.error);
              }
            })();
          }}
        />
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </StoreProvider>
  );
}
