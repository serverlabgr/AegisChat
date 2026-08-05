import { startTransition, useEffect, useState } from "react";
import { ConnectScreen } from "./components/screens/ConnectScreen";
import { MainScreen } from "./components/screens/MainScreen";
import { PingTicker } from "./components/common/PingTicker";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { UpdateAvailableModal } from "./components/modals/UpdateAvailableModal";
import { StoreProvider, useStore } from "./store/store";
import { applyAccent } from "./lib/color";
import { tryRestoreSession } from "./lib/session";
import { isTauri } from "./lib/tauriEnv";
import {
  checkForAppUpdate,
  consumeUpdateTarget,
  installAppUpdate,
} from "./lib/updater";
import { getAppVersion } from "./lib/appVersion";
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
    if (!isTauri()) return;
    void getAppVersion().then((v) => {
      const updated = consumeUpdateTarget(v);
      if (updated) toast(`Ενημερώθηκες στο v${updated}`);
    });
  }, [toast]);

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
            setUpdateStatus("Λήψη ενημέρωσης…");
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
                  setUpdateStatus("Εγκατάσταση… θα επανεκκινήσει");
                } else if (p.phase === "waiting") {
                  setUpdateStatus(
                    "Αν δεν ανοίξει αυτόματα, άνοιξέ το από Έναρξη",
                  );
                }
              });
              // On Windows the process usually exits mid-install (NSIS /R).
              // If we get here, show guidance instead of forcing relaunch.
              setUpdateBusy(false);
              setUpdatePercent(null);
              setUpdateStatus(null);
              if (!result.ok) {
                toast(result.error);
              } else {
                toast(
                  "Ενημέρωση OK — άνοιξε το Aegis από το μενού Έναρξη αν δεν άνοιξε μόνο του",
                );
              }
            })();
          }}
        />
      ) : null}
    </div>
  );
}

export default function App() {
  // ErrorBoundary must wrap StoreProvider so a store/init throw still shows UI.
  return (
    <ErrorBoundary>
      <StoreProvider>
        <ErrorBoundary fallbackTitle="Σφάλμα οθόνης">
          <AppShell />
        </ErrorBoundary>
      </StoreProvider>
    </ErrorBoundary>
  );
}
