import { isTauri } from "./tauriEnv";

export type UpdateProgress = {
  phase: "checking" | "downloading" | "installing" | "relaunching";
  /** 0–100 while downloading; omitted for other phases */
  percent?: number;
};

export type UpdateCheckResult =
  | { available: false }
  | { available: true; version: string };

export type UpdateInstallResult =
  | { ok: true }
  | { ok: false; error: string };

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
    return "Η σιωπηλή ενημέρωση χρειάζεται εγκατάσταση per-user. Κατέβασε το Setup από το LAN ή το GitHub και επανεγκατέστησε.";
  }
  if (lower.includes("signature") || lower.includes("pubkey")) {
    return "Αποτυχία επαλήθευσης υπογραφής update.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timed out")) {
    return "Δεν κατέβηκε το update (δίκτυο). Δοκίμασε ξανά ή το LAN mirror.";
  }
  return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
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
    // Missing pubkey / no release yet / offline — silent in check path.
    return { available: false };
  }
}

/**
 * Download in-app, quiet-install (no NSIS wizard), then relaunch.
 * On Windows the process may exit during install — relaunch is best-effort.
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

    onProgress?.({ phase: "relaunching" });
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch {
      // Windows NSIS quiet install often exits the process before this runs.
      // If we're still here, tell the caller to ask the user to reopen.
      return {
        ok: false,
        error:
          "Η ενημέρωση εγκαταστάθηκε αλλά δεν έγινε επανεκκίνηση. Άνοιξε ξανά το Aegis.",
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapUpdateError(err) };
  }
}
