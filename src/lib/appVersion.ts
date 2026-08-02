declare const __APP_VERSION__: string;

/** Version baked in at build time via Vite `define`. */
export const BUILD_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

/** Live app version: Tauri package version when desktop, else BUILD_VERSION. */
export async function getAppVersion(): Promise<string> {
  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      const { getVersion } = await import("@tauri-apps/api/app");
      return await getVersion();
    }
  } catch {
    /* fall through */
  }
  return BUILD_VERSION;
}
