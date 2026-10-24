import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const CATALYST_PROOF_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const CATALYST_PROOFS = [
  ["auth-invite-only", "Invite-only authentication rejects unknown users and admits invited users."],
  ["project-isolation", "User B cannot read User A's projects."],
  ["revision-immutability", "End users cannot change or delete committed project versions."],
  ["audit-append-only", "End users cannot edit or delete audit events."],
  ["evidence-isolation", "User B cannot read or write User A's draft evidence."],
  ["evidence-immutability", "End users cannot overwrite or delete verified evidence."],
  ["evidence-finalize-server", "Only the server can finalize evidence and write trusted metadata."],
  ["function-auth-required", "The evidence function rejects signed-out and non-POST requests."],
];

export const CATALYST_USE_RANK = Object.freeze({
  blocked: -1,
  "internal-demo": 0,
  "connected-development": 1, "staging-review": 1, "vincent-staging": 1,
  "controlled-pilot": 2, "external-staging": 2, "external-epc-staging": 2,
  "real-client-data": 3, "real-bank-data": 3,
  production: 4, "production-candidate": 4,
});

export function hashCatalystBuild(directory) {
  if (!fs.existsSync(path.join(directory, "index.html"))) return null;
  const files = [];
  const visit = (relative = "") => {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile()) files.push(next);
      else throw new Error("Build proof hashing does not accept symbolic links.");
    }
  };
  visit();
  const digest = createHash("sha256");
  for (const relative of files.sort()) {
    const bytes = fs.readFileSync(path.join(directory, relative));
    digest.update(JSON.stringify([relative.replaceAll("\\", "/"), bytes.length]));
    digest.update(bytes);
  }
  return digest.digest("hex");
}

export function resolveCatalystProofContext(env, buildHash) {
  try {
    const url = new URL(env.CATALYST_APP_URL || env.VITE_CATALYST_APP_URL || "");
    const projectId = String(env.CATALYST_PROJECT_ID || "").trim();
    const environment = String(env.CATALYST_ENVIRONMENT || "").trim();
    const isDevelopment = url.hostname.endsWith(".development.catalystserverless.com");
    if (url.protocol !== "https:" || url.username || url.password || url.port
      || !url.hostname.endsWith(".catalystserverless.com")
      || !/^\d+$/.test(projectId) || !["Development", "Production"].includes(environment)
      || (environment === "Development") !== isDevelopment
      || !/^[a-f0-9]{64}$/.test(buildHash || "")) return null;
    return { appOrigin: url.origin, projectId, environment, buildHash };
  } catch {
    return null;
  }
}

export function validateCatalystProof(suite, marker, context, now = Date.now()) {
  const result = (status, reason, executed = false) => ({ suite, status, reason, executed, passed: status === "PASS" });
  if (marker == null) return result("PENDING", "No runtime proof has been recorded.");
  if (typeof marker !== "object" || Array.isArray(marker)
    || marker.schemaVersion !== 1 || marker.suite !== suite
    || typeof marker.executed !== "boolean" || typeof marker.passed !== "boolean"
    || !["PASS", "FAIL", "NOT_EXECUTED"].includes(marker.status)) {
    return result("INVALID", "Malformed proof record; strict schema and boolean fields are required.");
  }
  if (marker.status === "NOT_EXECUTED") {
    return marker.executed === false && marker.passed === false
      ? result("PENDING", "Runtime proof was explicitly not executed.")
      : result("INVALID", "NOT_EXECUTED contradicts the execution flags.");
  }
  if (marker.executed !== true || marker.passed !== (marker.status === "PASS")) {
    return result("INVALID", "Proof status contradicts the execution flags.");
  }
  if (!context || !marker.context || Object.entries(context).some(([key, value]) => marker.context[key] !== value)) {
    return result("INVALID", "Proof does not match this app, project, environment and build.");
  }
  const writtenAt = typeof marker.writtenAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(marker.writtenAt) ? Date.parse(marker.writtenAt) : NaN;
  if (!Number.isFinite(writtenAt) || writtenAt > now) return result("INVALID", "Proof timestamp is invalid or in the future.");
  if (new Date(writtenAt).toISOString() !== marker.writtenAt) return result("INVALID", "Proof timestamp is not a canonical UTC timestamp.");
  if (now - writtenAt > CATALYST_PROOF_MAX_AGE_MS) return result("STALE", "Runtime proof is older than six hours.", true);
  const users = marker.testUsers;
  const minimumUsers = ["project-isolation", "evidence-isolation"].includes(suite) ? 2 : suite === "function-auth-required" ? 0 : 1;
  const allowedRoles = ["app user", "engineer", "sales", "technician", "client", "bank"];
  if (!Array.isArray(users) || users.length < minimumUsers
    || users.some((user) => !user || typeof user.id !== "string" || !user.id.trim()
      || !allowedRoles.includes(String(user.role || "").trim().toLowerCase()))
    || new Set(users.map((user) => user.id.trim())).size !== users.length
    || typeof marker.evidence !== "string" || !marker.evidence.trim()) {
    return result("INVALID", "Proof requires distinct non-admin test users and an evidence reference.");
  }
  return result(marker.status, marker.status === "PASS" ? "Runtime evidence recorded for this build." : "Runtime proof failed.", true);
}

export function buildCatalystReleaseStatus(markers, context, now = Date.now()) {
  const results = CATALYST_PROOFS.map(([suite, label]) => ({ ...validateCatalystProof(suite, markers[suite], context, now), label }));
  const anyFail = results.some((proof) => proof.status === "FAIL");
  const allProofsExecuted = results.every((proof) => proof.executed === true);
  const allProofsPassed = results.every((proof) => proof.status === "PASS");
  const releaseAllowed = Boolean(context) && allProofsExecuted && allProofsPassed;
  const pendingProofs = results.filter((proof) => ["PENDING", "STALE", "INVALID"].includes(proof.status)).map((proof) => proof.suite);
  return {
    generatedAt: new Date(now).toISOString(),
    appVersion: "Voltflow 11.8.1", platform: "catalyst", context,
    runtimeConfigured: Boolean(context),
    proofs: Object.fromEntries(results.map((proof) => [proof.suite, proof])),
    pendingProofs, allProofsExecuted, allProofsPassed, releaseAllowed,
    allowedUse: anyFail ? "blocked" : releaseAllowed ? "controlled-pilot" : "internal-demo",
    releaseGateStatus: anyFail ? "BLOCKED_FAILURE" : releaseAllowed ? "CONTROLLED_PILOT" : "INTERNAL_DEMO",
    notes: anyFail ? "A runtime proof failed. Release is blocked."
      : releaseAllowed ? "Recorded runtime proofs match this build. Controlled-pilot only; not production approval."
        : "Runtime security is not proven. Only an internal demo with synthetic data is permitted.",
  };
}

export function catalystGateExitCode(status, requiredUse) {
  if (requiredUse == null) return 0;
  if (!Object.hasOwn(CATALYST_USE_RANK, requiredUse) || requiredUse === "blocked") return 2;
  return CATALYST_USE_RANK[status.allowedUse] >= CATALYST_USE_RANK[requiredUse] ? 0 : 1;
}
