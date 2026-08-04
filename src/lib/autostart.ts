import { isTauri } from "./tauriEnv";

export async function getAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { isEnabled } = await import("@tauri-apps/plugin-autostart");
    return await isEnabled();
  } catch {
    return false;
  }
}

export async function setAutostartEnabled(enabled: boolean): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { enable, disable } = await import("@tauri-apps/plugin-autostart");
    if (enabled) await enable();
    else await disable();
    return true;
  } catch {
    return false;
  }
}
