import { isTauri } from "./tauriEnv";

export type UpdateProgress = {
  phase: "checking" | "downloading" | "installing" | "waiting";
  /** 0–100 while downloading; omitted for other phases */
  percent?: number;
};

export type UpdateCheckResult =
  | { available: false }
  | { available: true; version: string };

export type UpdateInstallResult =
  | { ok: true }
  | { ok: false; error: string };

const UPDATE_TARGET_KEY = "aegis:updateTargetVersion";

function mapUpdateError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Άγνωστο σφάλμα";
  const lower = raw.toLowerCase();
  if (
    lower.includes("privilege") ||
    lower.includes("elevat") ||
    lower.includes("admin") ||
    lower.includes("access is denied") ||
    lower.includes("permission")
  ) {
    return "Η ενημέρωση χρειάζεται δικαιώματα. Κατέβασε το Setup από το LAN και επανεγκατέστησε.";
  }
  if (lower.includes("signature") || lower.includes("pubkey")) {
    return "Αποτυχία επαλήθευσης υπογραφής update.";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timed out")
  ) {
    return "Δεν κατέβηκε το update (δίκτυο). Δοκίμασε ξανά ή το LAN mirror.";
  }
  return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
}

/** Remember target version so we can toast after a successful NSIS restart. */
export function markUpdateTarget(version: string): void {
  try {
    localStorage.setItem(UPDATE_TARGET_KEY, version);
  } catch {
    /* ignore */
  }
}

/** If we restarted onto the target version, return it and clear the flag. */
export function consumeUpdateTarget(currentVersion: string): string | null {
  try {
    const target = localStorage.getItem(UPDATE_TARGET_KEY);
    if (!target || target !== currentVersion) return null;
    localStorage.removeItem(UPDATE_TARGET_KEY);
    return target;
  } catch {
    return null;
  }
}

/** Check GitHub Releases (then LAN) for a newer Aegis build (desktop only). */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri()) return { available: false };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { available: false };
    return { available: true, version: update.version };
  } catch {
    return { available: false };
  }
}

/**
 * Download + install via NSIS (passive: progress bar, no wizard).
 *
 * On Windows, Tauri launches the NSIS installer with /P /R and exits this
 * process. Do NOT call relaunch() afterwards — that races the installer and
 * often leaves the app closed with no restart.
 */
export async function installAppUpdate(
  onProgress?: (p: UpdateProgress) => void,
): Promise<UpdateInstallResult> {
  if (!isTauri()) {
    return { ok: false, error: "Updates μόνο στο desktop app" };
  }
  try {
    onProgress?.({ phase: "checking" });
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      return { ok: false, error: "Δεν βρέθηκε διαθέσιμο update" };
    }

    markUpdateTarget(update.version);

    let downloaded = 0;
    let contentLength = 0;
    onProgress?.({ phase: "downloading", percent: 0 });

    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        contentLength = event.data.contentLength ?? 0;
        downloaded = 0;
        onProgress?.({ phase: "downloading", percent: 0 });
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        const percent =
          contentLength > 0
            ? Math.min(99, Math.round((downloaded / contentLength) * 100))
            : undefined;
        onProgress?.({ phase: "downloading", percent });
      } else if (event.event === "Finished") {
        onProgress?.({ phase: "installing" });
      }
    });

    // Windows usually never reaches here (process exits when NSIS starts).
    // If it does, do not relaunch — tell the user to open from Start.
    onProgress?.({ phase: "waiting" });
    return {
      ok: false,
      error:
        "Η εγκατάσταση ξεκίνησε. Αν δεν ανοίξει αυτόματα, άνοιξε το Aegis από το μενού Έναρξη.",
    };
  } catch (err) {
    // On Windows, process exit during install can surface as an error — keep target flag.
    const msg = mapUpdateError(err);
    const lower = msg.toLowerCase();
    if (
      lower.includes("exit") ||
      lower.includes("closed") ||
      lower.includes("killed") ||
      lower.includes("aborted")
    ) {
      return { ok: true };
    }
    try {
      localStorage.removeItem(UPDATE_TARGET_KEY);
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg };
  }
}
