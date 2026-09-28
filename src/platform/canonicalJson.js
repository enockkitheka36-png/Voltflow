import { PlatformError, PLATFORM_ERROR_CODES } from "./errors.js";

export function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined && typeof value[key] !== "function") {
        out[key] = canonicalize(value[key]);
      }
      return out;
    }, {});
  }
  return null;
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(value) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.STORAGE_UNAVAILABLE,
      "Web Crypto SHA-256 is unavailable in this runtime.",
    );
  }
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : canonicalStringify(value));
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashCanonicalJson(value) {
  return sha256Hex(canonicalStringify(value));
}
