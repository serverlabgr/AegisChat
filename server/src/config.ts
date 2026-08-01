import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const isProd = process.env.NODE_ENV === "production";

const jwtSecret = required(
  "JWT_SECRET",
  isProd ? undefined : "dev-only-change-me-aegis-jwt-secret-32b+",
);

if (isProd && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

export const config = {
  databaseUrl: required(
    "DATABASE_URL",
    isProd ? undefined : "postgres://aegis:aegis@localhost:5432/aegis",
  ),
  jwtSecret,
  port: Number(process.env.PORT ?? 3001),
  /** Comma-separated list of allowed browser / Tauri origins. */
  corsOrigins: (
    process.env.CORS_ORIGIN ??
    "http://localhost:8765,http://127.0.0.1:8765,http://localhost:1420,http://localhost:5173,http://tauri.localhost,https://tauri.localhost"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  accessTtlSec: Number(process.env.ACCESS_TTL_SEC ?? 900),
  refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS ?? 30),
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  /**
   * Max encrypted upload size in bytes.
   * 0 = no artificial cap. Default 2GB (aligned with Windows client).
   */
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 2_147_483_648),
};
