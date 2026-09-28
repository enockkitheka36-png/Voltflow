import { PlatformError, PLATFORM_ERROR_CODES } from "./errors.js";

export const TRUST_FOUNDATION_VERSION = "Voltflow 11.8";
export const PROVIDER_MODES = Object.freeze(["local-demo", "supabase"]);
export const EVIDENCE_BUCKET = "project-evidence";

function decodeJwtPayload(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const normal = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normal.padEnd(Math.ceil(normal.length / 4) * 4, "=");
    const decoded = typeof atob === "function"
      ? atob(padded)
      : globalThis.Buffer?.from(padded, "base64").toString("utf8");
    return decoded ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
}

export function assertBrowserSafeSupabaseKey(key) {
  const value = String(key || "").trim();
  if (!value) {
    throw new PlatformError(PLATFORM_ERROR_CODES.NOT_CONFIGURED, "Supabase publishable key is missing.");
  }
  const payload = decodeJwtPayload(value);
  const role = String(payload?.role || "").toLowerCase();
  if (role === "service_role" || role === "supabase_admin") {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.FORBIDDEN,
      "Privileged Supabase credentials are forbidden in browser configuration.",
    );
  }
  return value;
}

export function resolvePlatformConfig(env = {}) {
  const requested = String(env.VITE_VOLTFLOW_PROVIDER || "local-demo").trim().toLowerCase();
  const mode = PROVIDER_MODES.includes(requested) ? requested : "local-demo";
  if (mode === "local-demo") {
    return {
      mode,
      cloudEnabled: false,
      authRequired: false,
      evidenceBucket: EVIDENCE_BUCKET,
      localRole: String(env.VITE_VOLTFLOW_LOCAL_ROLE || "engineer").toLowerCase(),
    };
  }

  const url = String(env.VITE_SUPABASE_URL || "").trim();
  const publishableKey = assertBrowserSafeSupabaseKey(
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  );
  if (!/^https:\/\//i.test(url) && !/^http:\/\/127\.0\.0\.1(?::\d+)?/i.test(url)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.NOT_CONFIGURED,
      "Supabase URL must be HTTPS, except for explicit 127.0.0.1 local development.",
    );
  }
  return {
    mode,
    cloudEnabled: true,
    authRequired: true,
    supabaseUrl: url,
    supabasePublishableKey: publishableKey,
    evidenceBucket: EVIDENCE_BUCKET,
  };
}

export function readBrowserPlatformConfig() {
  return resolvePlatformConfig(typeof import.meta !== "undefined" ? (import.meta.env || {}) : {});
}
