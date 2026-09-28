/**
 * release-security-gate.mjs — Voltflow 11.8.1 (Phase 3 + Phase 11)
 *
 * A strict gate so SKIPPED security tests can never look "green". It aggregates
 * the DB-backed security suite results, probes for a live Supabase, writes a
 * machine-readable status file, and decides the highest allowed use.
 *
 * Usage:
 *   node scripts/release-security-gate.mjs                 # report only, exit 0
 *   node scripts/release-security-gate.mjs --require staging-review   # exit 1 unless allowed
 *
 * A release beyond `internal-demo` requires ALL security suites executed+passed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectLiveSupabase, readSuiteResult, GENERATED_DIR } from "./lib/securityStatus.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// pgTAP RLS is executed by `supabase test db`; we can only mark it executed if a
// live Postgres is reachable AND a marker file exists (written by CI after run).
async function rlsStatus() {
  const live = await detectLiveSupabase(process.env);
  const marker = path.join(GENERATED_DIR, "security-rls.json");
  let executed = false, passed = false;
  try { const j = JSON.parse(fs.readFileSync(marker, "utf8")); executed = !!j.executed; passed = !!j.passed; } catch {}
  return { reachable: live.localPostgres || live.configuredUrlPresent, executed, passed };
}

function suite(name) {
  const r = readSuiteResult(name);
  const writtenAtMs = Date.parse(r?.writtenAt || "");
  const fresh = Number.isFinite(writtenAtMs) && Date.now() - writtenAtMs <= 30 * 60 * 1000;
  return { executed: !!r?.executed, passed: !!r?.passed, fresh, status: r?.status || "NOT_EXECUTED" };
}

async function main() {
  const rls = await rlsStatus();
  const tenant = suite("tenant-attack");
  const revision = suite("revision-db");
  const evidence = suite("evidence-security");
  const audit = suite("audit-db");
  const auth = suite("auth-flow");
  const revocation = suite("access-revocation");
  const storage = suite("evidence-security"); // storage access is proven by the evidence suite

  const suites = [tenant, revision, evidence, audit, auth, revocation];
  const allExecuted = rls.executed && suites.every((result) => result.executed);
  const allPassed = rls.passed && suites.every((result) => result.passed);
  const allFresh = suite("rls").fresh && suites.every((result) => result.fresh);

  const authFlowTested = auth.executed;
  const tenantAttackTested = tenant.executed;
  const evidenceAccessTested = evidence.executed;

  const releaseAllowed = rls.reachable && allExecuted && allPassed && allFresh;
  const allowedUse = releaseAllowed ? "controlled-pilot" : "internal-demo";
  const releaseGateStatus = releaseAllowed
    ? "CONTROLLED_PILOT"
    : rls.reachable ? "CONNECTED_STAGING" : "INTERNAL_DEMO";

  const status = {
    generatedAt: new Date().toISOString(),
    appVersion: "Voltflow 11.8.1",
    runtimeMode: process.env.VITE_VOLTFLOW_PROVIDER || "local-demo",
    liveSupabaseReachable: rls.reachable,
    rlsTestsExecuted: rls.executed,
    rlsTestsPassed: rls.passed,
    storageTestsExecuted: storage.executed,
    storageTestsPassed: storage.passed,
    tenantAttackTested,
    tenantAttackPassed: tenant.passed,
    revisionImmutabilityTested: revision.executed,
    revisionImmutabilityPassed: revision.passed,
    auditAppendOnlyTested: audit.executed,
    auditAppendOnlyPassed: audit.passed,
    authFlowTested,
    authFlowPassed: auth.passed,
    accessRevocationTested: revocation.executed,
    accessRevocationPassed: revocation.passed,
    securityResultsFresh: allFresh,
    evidenceAccessTested,
    releaseAllowed,
    allowedUse,
    releaseGateStatus,
    notes: releaseAllowed
      ? "All DB-backed security suites executed and passed."
      : "One or more security suites NOT_EXECUTED (no live Supabase/Docker). Only internal-demo use is permitted.",
  };

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(path.join(GENERATED_DIR, "security-test-status.json"), JSON.stringify(status, null, 2));

  console.log("\n=== Voltflow 11.8.1 Release Security Gate ===");
  for (const [k, v] of Object.entries(status)) console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);

  // Enforcement
  const req = (() => { const i = process.argv.indexOf("--require"); return i >= 0 ? process.argv[i + 1] : null; })();
  // Levels the app can be released at, lowest→highest. Aliases map the exact
  // --require args a sprint uses onto the same honest ranking.
  const RANK = {
    "internal-demo": 0,
    "staging-review": 1, "vincent-staging": 1,
    "controlled-pilot": 2, "external-staging": 2, "external-epc-staging": 2,
    "real-client-data": 3, "real-bank-data": 3,
    "production": 4, "production-candidate": 4,
  };
  if (req) {
    // Unknown level → treat as the highest bar so we never under-gate by accident.
    const need = RANK[req] ?? 4;
    const have = RANK[allowedUse] ?? 0;
    if (have < need) {
      console.error(`\n❌ GATE FAIL: required "${req}" but only "${allowedUse}" is permitted (security not proven).`);
      process.exit(1);
    }
    console.log(`\n✅ GATE PASS for "${req}".`);
  }
  console.log("");
}
main();
