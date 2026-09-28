import { PlatformError, PLATFORM_ERROR_CODES } from "./errors.js";

export const REVIEW_STATES = Object.freeze([
  "draft",
  "review_ready",
  "submitted",
  "in_review",
  "approved",
  "rejected",
]);

const TRANSITIONS = Object.freeze({
  draft: new Set(["review_ready"]),
  review_ready: new Set(["draft", "submitted"]),
  submitted: new Set(["in_review"]),
  in_review: new Set(["approved", "rejected"]),
  approved: new Set(),
  rejected: new Set(["draft"]),
});

export function canTransitionReview(from, to) {
  return !!TRANSITIONS[from]?.has(to);
}

export function transitionReview(submission, to, context = {}) {
  const from = submission?.status || "draft";
  if (!REVIEW_STATES.includes(to) || !canTransitionReview(from, to)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      `Review transition ${from} -> ${to} is not allowed.`,
    );
  }
  if (["submitted", "in_review", "approved", "rejected"].includes(to) && !submission?.projectVersionId) {
    throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "A locked project version is required for submission.");
  }
  if (["approved", "rejected"].includes(to) && !String(context.reason || "").trim()) {
    throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "Approval or rejection requires a reason.");
  }
  const at = context.at || new Date().toISOString();
  return {
    ...submission,
    status: to,
    updatedAt: at,
    submittedAt: to === "submitted" ? at : submission.submittedAt || null,
    reviewedAt: ["approved", "rejected"].includes(to) ? at : submission.reviewedAt || null,
    lastReason: context.reason || null,
    history: [
      ...(Array.isArray(submission.history) ? submission.history : []),
      { from, to, at, actorUserId: context.actorUserId || null, reason: context.reason || null },
    ],
  };
}

export function createLocalReviewSubmission(input = {}) {
  return {
    id: input.id || `local_review_${Date.now()}`,
    projectId: input.projectId || null,
    projectVersionId: input.projectVersionId || null,
    status: "draft",
    cloudSubmitted: false,
    message: "Saved locally only. No cloud or external review submission occurred.",
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.createdAt || new Date().toISOString(),
    history: [],
  };
}
