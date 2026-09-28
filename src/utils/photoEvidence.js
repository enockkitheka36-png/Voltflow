export const PHOTO_TYPES = [
  "SITE_OVERVIEW", "ROOF", "POWER_BOX", "METER", "INVERTER_LOCATION",
  "BATTERY_LOCATION", "EARTHING", "OTHER",
];
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_SIZE_BYTES = 25 * 1024 * 1024;

export function validatePhotoUpload(input = {}) {
  const errors = [];
  if (!PHOTO_TYPES.includes(String(input.type || input.photoType || "").toUpperCase())) errors.push({ field: "type", code: "INVALID_PHOTO_TYPE" });
  if (!PHOTO_MIME_TYPES.includes(String(input.content_type || input.contentType || input.mimeType || "").toLowerCase())) errors.push({ field: "content_type", code: "INVALID_MIME" });
  const size = Number(input.size_bytes ?? input.sizeBytes);
  if (!Number.isFinite(size) || size <= 0) errors.push({ field: "size_bytes", code: "INVALID_SIZE" });
  if (size > MAX_PHOTO_SIZE_BYTES) errors.push({ field: "size_bytes", code: "PHOTO_TOO_LARGE" });
  if (String(input.type || input.photoType || "").toUpperCase() !== "ROOF" && (input.roof_face_id || input.roofFaceId)) {
    errors.push({ field: "roof_face_id", code: "ROOF_FACE_ONLY_FOR_ROOF_PHOTO" });
  }
  return errors;
}

export function safePhotoExtension(filename, mimeType) {
  const byMime = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  return byMime[String(mimeType || "").toLowerCase()] || String(filename || "photo").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

export function buildPrivatePhotoObjectKey({ organisationId, projectId, photoId, filename, mimeType }) {
  const ids = [organisationId, projectId, photoId].map((value) => String(value || "").trim());
  if (ids.some((value) => !/^[0-9a-f-]{16,}$/i.test(value))) throw new TypeError("Tenant, project and photo UUIDs are required.");
  return `${ids[0]}/${ids[1]}/photos/${ids[2]}.${safePhotoExtension(filename, mimeType)}`;
}

export function uploadRetryDelay(attempt, baseMs = 500) {
  return Math.min(8000, Math.max(0, Number(baseMs) || 500) * Math.pow(2, Math.max(0, Number(attempt) || 0)));
}
