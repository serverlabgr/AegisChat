import { isTauri as tauriIsTauri } from "@tauri-apps/api/core";

/** Never throw — missing IPC / broken shell must not white-screen the app. */
export function isTauri(): boolean {
  try {
    return tauriIsTauri();
  } catch {
    return false;
  }
}
