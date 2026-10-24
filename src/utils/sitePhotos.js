import { checksumEvidenceFile } from "../platform/evidenceAuthorization.js";

export const SITE_PHOTO_SLOTS = ["Roof Front", "Roof Close-up", "Shading Source", "DB Box Open", "KPLC Meter", "Inverter Location", "Battery Location", "Cable Route", "Main Entrance", "Site Overview"];
export const MAX_SITE_PHOTO_BYTES = 48 * 1024;
const types = ["image/jpeg", "image/png", "image/webp"];
const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function isAttachedSitePhoto(value) {
  if (!value || typeof value !== "object" || !validDate(value.attachedAt)) return false;
  if (value.kind === "private_site_photo") return typeof value.evidenceId === "string" && !!value.evidenceId && typeof value.projectId === "string" && !!value.projectId && validDate(value.serverReceivedAt);
  if (value.kind !== "local_site_photo" || value.mimeType !== "image/jpeg" || !Number.isInteger(value.width) || value.width < 1 || value.width > 1280 || !Number.isInteger(value.height) || value.height < 1 || value.height > 1280) return false;
  const encoded = typeof value.dataUrl === "string" ? value.dataUrl.slice(23) : "";
  return typeof value.dataUrl === "string" && value.dataUrl.startsWith("data:image/jpeg;base64,/9j/") && encoded.length <= Math.ceil(MAX_SITE_PHOTO_BYTES / 3) * 4 && /^[A-Za-z0-9+/]+={0,2}$/.test(encoded) && encoded.length >= 100;
}

export function countSitePhotos(photos = {}) {
  return SITE_PHOTO_SLOTS.filter((slot) => isAttachedSitePhoto(photos?.[slot])).length;
}

export function privateSitePhotoLinks(photos, organisationId, projectId) {
  if (!organisationId || !projectId) return [];
  return SITE_PHOTO_SLOTS.flatMap((slot) => {
    const photo = photos?.[slot];
    return isAttachedSitePhoto(photo) && photo.kind === "private_site_photo" && photo.projectId === String(projectId) && photo.organisationId === String(organisationId) ? [[slot, photo.evidenceId]] : [];
  });
}

export function validateSitePhotoFile(file) {
  if (!file || !types.includes(file.type)) return "Choose a JPEG, PNG or WebP image. HEIC, SVG and documents are not supported.";
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 25 * 1024 * 1024) return "Choose an image between 1 byte and 25 MB.";
  return null;
}

export async function prepareSitePhoto(file, { maximumBytes = MAX_SITE_PHOTO_BYTES, maximumDimension = 1280 } = {}) {
  const error = validateSitePhotoFile(file);
  if (error) throw new Error(error);
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 50_000_000) throw new Error("Image dimensions exceed the supported 50-megapixel limit.");
    let maximum = maximumDimension;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot prepare a photo preview.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
      if (blob && blob.size <= maximumBytes) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("The image could not be read."));
          reader.readAsDataURL(blob);
        });
        return { record: { kind: "local_site_photo", mimeType: "image/jpeg", filename: String(file.name || "site-photo").slice(0, 150), width: canvas.width, height: canvas.height, sizeBytes: blob.size, attachedAt: new Date().toISOString(), caption: "", dataUrl }, blob };
      }
      maximum = Math.round(maximum * 0.7);
    }
    throw new Error("The image could not be reduced safely. Choose a smaller image.");
  } finally { bitmap.close(); }
}

export async function uploadPrivateSitePhoto({ platform, organisationId, projectId, slot, prepared }) {
  if (!organisationId || !projectId || !SITE_PHOTO_SLOTS.includes(slot)) throw new Error("Save this cloud project before attaching private photos.");
  const file = new File([prepared.blob], "site-photo.jpg", { type: "image/jpeg" });
  const checksumSha256 = await checksumEvidenceFile(file);
  const photoType = slot.startsWith("Roof") ? "ROOF" : ({ "DB Box Open": "POWER_BOX", "KPLC Meter": "METER", "Inverter Location": "INVERTER_LOCATION", "Battery Location": "BATTERY_LOCATION", "Site Overview": "SITE_OVERVIEW" }[slot] || "OTHER");
  const upload = await platform.evidence.prepareUpload({ organisationId, projectId, kind: "site_photo", photoType, caption: slot, filename: file.name, title: slot, mimeType: file.type, sizeBytes: file.size, checksumSha256, requestId: crypto.randomUUID() });
  if (upload.uploadDisabled) throw new Error("Private photo upload is unavailable in this runtime.");
  await platform.evidence.uploadPreparedFile({ storagePath: upload.storagePath, signedToken: upload.signedToken, file, checksumSha256 });
  const completed = await platform.evidence.completeUpload({ organisationId, evidenceId: upload.evidenceId, checksumSha256, sizeBytes: file.size, requestId: crypto.randomUUID() });
  if (!completed?.id || !validDate(completed.serverReceivedAt)) throw new Error("No canonical server receipt was returned. Check the Evidence workspace before retrying.");
  return { kind: "private_site_photo", evidenceId: String(completed.id), projectId: String(projectId), organisationId: String(organisationId), mimeType: file.type, filename: prepared.record.filename, caption: "", attachedAt: new Date().toISOString(), serverReceivedAt: completed.serverReceivedAt };
}
