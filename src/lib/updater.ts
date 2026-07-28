import { isTauri } from "@tauri-apps/api/core";

/** Check GitHub Releases for a newer Aegis build (desktop only). */
export async function checkForAppUpdate(): Promise<{
  available: boolean;
  version?: string;
}> {
  if (!isTauri()) return { available: false };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { available: false };
    return { available: true, version: update.version };
  } catch {
    // Missing pubkey / no release yet — silent in dev.
    return { available: false };
  }
}

/** Download, install, then relaunch the app. */
export async function installAppUpdate(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return false;
    await update.downloadAndInstall();
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
    return true;
  } catch {
    return false;
  }
}
