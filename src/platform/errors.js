export const PLATFORM_ERROR_CODES = Object.freeze({
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

export class PlatformError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "PlatformError";
    this.code = code || PLATFORM_ERROR_CODES.INTERNAL_ERROR;
    this.requestId = options.requestId || null;
    this.details = options.details || null;
  }
}

export function mapProviderError(error, fallbackMessage = "The platform request failed.") {
  if (error instanceof PlatformError) return error;
  const providerCode = String(error?.code || "").toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);
  let code = PLATFORM_ERROR_CODES.INTERNAL_ERROR;
  if (status === 401) code = PLATFORM_ERROR_CODES.UNAUTHENTICATED;
  else if (status === 403 || providerCode.includes("42501")) code = PLATFORM_ERROR_CODES.FORBIDDEN;
  else if (status === 404 || providerCode.includes("pgrst116")) code = PLATFORM_ERROR_CODES.NOT_FOUND;
  else if (status === 409 || providerCode.includes("23505") || providerCode.includes("vf409")) code = PLATFORM_ERROR_CODES.CONFLICT;
  else if (status === 422 || providerCode.includes("22023") || providerCode.includes("vf422")) code = PLATFORM_ERROR_CODES.VALIDATION_FAILED;
  else if (status === 429) code = PLATFORM_ERROR_CODES.RATE_LIMITED;
  return new PlatformError(code, error?.message || fallbackMessage, { cause: error });
}
