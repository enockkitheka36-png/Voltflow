import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CATALYST_PROOFS, CATALYST_PROOF_MAX_AGE_MS, buildCatalystReleaseStatus, catalystGateExitCode, hashCatalystBuild, resolveCatalystProofContext, validateCatalystProof } from "./lib/catalystReleaseStatus.mjs";

const now = Date.parse("2026-10-16T12:00:00.000Z");
const context = { appOrigin: "https://fixture.development.catalystserverless.com", projectId: "12345", environment: "Development", buildHash: "a".repeat(64) };
const suite = "project-isolation";
const validProof = (proofSuite = suite) => ({
  schemaVersion: 1, suite: proofSuite, executed: true, passed: true, status: "PASS",
  writtenAt: new Date(now).toISOString(), context: { ...context },
  testUsers: [{ id: "fixture-user-a", role: "App User" }, { id: "fixture-user-b", role: "App User" }],
  evidence: "Synthetic regression fixture; not live runtime evidence.",
});
let passed = 0;
const check = (name, callback) => { callback(); passed += 1; console.log(`PASS: ${name}`); };

check("Fresh, well-formed proof passes validation", () => assert.equal(validateCatalystProof(suite, validProof(), context, now).status, "PASS"));
check("Missing proof remains pending", () => assert.equal(validateCatalystProof(suite, null, context, now).status, "PENDING"));
check("Honest NOT_EXECUTED remains pending", () => assert.equal(validateCatalystProof(suite, { ...validProof(), executed: false, passed: false, status: "NOT_EXECUTED" }, context, now).status, "PENDING"));
for (const [name, patch] of [
  ["String false flags", { executed: "false", passed: "false" }],
  ["Numeric true flags", { executed: 1, passed: 1 }],
  ["Contradictory NOT_EXECUTED", { status: "NOT_EXECUTED" }],
  ["Contradictory FAIL", { status: "FAIL" }],
  ["Contradictory PASS", { passed: false }],
  ["Unknown status", { status: "PENDING" }],
  ["Wrong suite", { suite: "auth-invite-only" }],
  ["Missing schema", { schemaVersion: undefined }],
  ["Future timestamp", { writtenAt: new Date(now + 1).toISOString() }],
  ["Invalid timestamp", { writtenAt: "not-a-date" }],
  ["Non-ISO timestamp", { writtenAt: "2026-10-16" }],
  ["Wrong project", { context: { ...context, projectId: "999" } }],
  ["Wrong environment", { context: { ...context, environment: "Production" } }],
  ["Wrong origin", { context: { ...context, appOrigin: "https://another.development.catalystserverless.com" } }],
  ["Old build", { context: { ...context, buildHash: "b".repeat(64) } }],
  ["Missing evidence", { evidence: "" }],
  ["Admin test user", { testUsers: [{ id: "admin", role: "App Administrator" }] }],
  ["Duplicate test users", { testUsers: [{ id: "same", role: "App User" }, { id: "same", role: "App User" }] }],
  ["Only one user for ownership proof", { testUsers: [{ id: "one", role: "App User" }] }],
]) check(`${name} cannot pass`, () => assert.equal(validateCatalystProof(suite, { ...validProof(), ...patch }, context, now).status, "INVALID"));
check("Old proof is stale", () => assert.equal(validateCatalystProof(suite, { ...validProof(), writtenAt: new Date(now - CATALYST_PROOF_MAX_AGE_MS - 1).toISOString() }, context, now).status, "STALE"));
check("Explicit failure blocks release", () => {
  const markers = { [suite]: { ...validProof(), status: "FAIL", passed: false } };
  const status = buildCatalystReleaseStatus(markers, context, now);
  assert.equal(status.allowedUse, "blocked");
  assert.equal(catalystGateExitCode(status, "internal-demo"), 1);
});
check("Connected app with missing proofs is still internal-demo only", () => {
  const status = buildCatalystReleaseStatus({}, context, now);
  assert.equal(status.pendingProofs.length, 8);
  assert.equal(status.allowedUse, "internal-demo");
  assert.equal(catalystGateExitCode(status, "controlled-pilot"), 1);
  assert.equal(catalystGateExitCode(status, "connected-development"), 1);
  assert.equal(catalystGateExitCode(status, "internal-demo"), 0);
});
check("All validated fixtures allow only controlled pilot, never production", () => {
  const markers = Object.fromEntries(CATALYST_PROOFS.map(([proofSuite]) => [proofSuite, validProof(proofSuite)]));
  const status = buildCatalystReleaseStatus(markers, context, now);
  assert.equal(status.allowedUse, "controlled-pilot");
  assert.equal(catalystGateExitCode(status, "controlled-pilot"), 0);
  assert.equal(catalystGateExitCode(status, "production"), 1);
  assert.equal(catalystGateExitCode(status, "real-client-data"), 1);
  assert.equal(catalystGateExitCode(status, "typo"), 2);
  assert.equal(buildCatalystReleaseStatus(markers, null, now).releaseAllowed, false);
});
check("Configured context must use the real service domain and correct environment", () => {
  const env = { CATALYST_APP_URL: context.appOrigin, CATALYST_PROJECT_ID: context.projectId, CATALYST_ENVIRONMENT: "Development" };
  assert.deepEqual(resolveCatalystProofContext(env, context.buildHash), context);
  assert.equal(resolveCatalystProofContext({ ...env, CATALYST_APP_URL: `${context.appOrigin}.evil.example` }, context.buildHash), null);
  assert.equal(resolveCatalystProofContext({ ...env, CATALYST_ENVIRONMENT: "Production" }, context.buildHash), null);
  assert.equal(resolveCatalystProofContext(env, null), null);
});
check("Build fingerprint changes when artifact contents change", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "voltflow-gate-regression-"));
  try {
    assert.equal(hashCatalystBuild(directory), null);
    fs.writeFileSync(path.join(directory, "index.html"), "synthetic fixture");
    const first = hashCatalystBuild(directory);
    assert.equal(hashCatalystBuild(directory), first);
    fs.writeFileSync(path.join(directory, "index.html"), "changed synthetic fixture");
    assert.notEqual(hashCatalystBuild(directory), first);
  } finally {
    const fixture = path.join(directory, "index.html");
    if (fs.existsSync(fixture)) fs.unlinkSync(fixture);
    fs.rmdirSync(directory);
  }
});
console.log(`\n${passed} Catalyst gate checks passed. No live proofs executed or recorded.`);
