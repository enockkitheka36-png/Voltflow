import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAPABILITIES,
  canAccessEvidencePath,
  canAccessProject,
  isTabAllowedForRole,
  roleHasCapability,
} from "../src/platform/accessControl.js";
import { canonicalStringify, hashCanonicalJson } from "../src/platform/canonicalJson.js";
import { createLocalDemoPlatform } from "../src/platform/localDemoAdapter.js";
import { createProjectVersionEnvelope } from "../src/platform/projectSnapshot.js";
import { containsCommercialInternals } from "../src/platform/audienceProjection.js";
import { prepareLegacyProjectMigration } from "../src/platform/legacyMigration.js";
import { buildEvidenceObjectPath, checksumEvidenceFile, safeEvidenceFilename } from "../src/platform/evidenceAuthorization.js";
import { createLocalReviewSubmission, transitionReview } from "../src/platform/reviewWorkflow.js";
import { assertBrowserSafeSupabaseKey, resolvePlatformConfig } from "../src/platform/config.js";
import { reconcileBillAndLoads, BILL_LOAD_STATUS } from "../src/utils/billLoadReconciliation.js";
import { assistantAuthRequired, extractBearerToken, verifyAssistantAccess } from "../api/assistantAuth.js";

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${error.message}`);
    failed += 1;
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function jwtWithRole(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ role })}.fixture`;
}

console.log("\nVoltflow 11.8 - Secure Trust Foundation Regression\n");

await test("1. Tenant and project access fail closed across organisations", () => {
  const actor = { userId: "u-a", organisationId: "org-a", status: "active", role: "engineer" };
  assert.equal(canAccessProject(actor, { organisationId: "org-b" }), false);
  assert.equal(canAccessProject(actor, { organisationId: "org-a" }), true);
  assert.equal(canAccessProject({ ...actor, status: "suspended" }, { organisationId: "org-a" }), false);
});

await test("2. Role authorization and navigation use explicit allow-lists", () => {
  assert.equal(roleHasCapability("manager", CAPABILITIES.MANAGE_ORGANISATION), true);
  assert.equal(roleHasCapability("technician", CAPABILITIES.VIEW_COMMERCIAL), false);
  assert.equal(roleHasCapability("client", CAPABILITIES.VIEW_SHARED_VERSION), true);
  assert.equal(isTabAllowedForRole("finance", "sales"), true);
  assert.equal(isTabAllowedForRole("eng-compliance", "sales"), false);
  assert.equal(isTabAllowedForRole("boq", "client"), false);
});

await test("3. LocalDemo project repository enforces optimistic concurrency", async () => {
  const platform = createLocalDemoPlatform({ storage: memoryStorage() });
  const created = await platform.projects.createProject({ record: { name: "Clinic", project: { client: "Clinic" } } });
  const updated = await platform.projects.updateProject({
    projectId: created.id,
    expectedRevisionNo: created.revisionNo,
    record: { ...created, project: { client: "Clinic updated" } },
  });
  assert.equal(updated.revisionNo, 2);
  await assert.rejects(
    platform.projects.updateProject({ projectId: created.id, expectedRevisionNo: 1, record: created }),
    (error) => error.code === "CONFLICT",
  );
});

await test("4. Canonical version snapshots hash deterministically and remain stored immutably", async () => {
  assert.equal(canonicalStringify({ b: 2, a: 1 }), canonicalStringify({ a: 1, b: 2 }));
  assert.equal(await hashCanonicalJson({ b: 2, a: 1 }), await hashCanonicalJson({ a: 1, b: 2 }));
  const storage = memoryStorage();
  const platform = createLocalDemoPlatform({ storage });
  const project = await platform.projects.createProject({ record: { name: "Workshop", project: { client: "Workshop" } } });
  const envelope = await createProjectVersionEnvelope({
    record: { schemaVersion: "11.7", appVersion: "Voltflow 11.7.2b", project: { client: "Workshop" } },
    sizing: { actualKwp: 10, totalCost: 1000000 },
  });
  const version = await platform.projects.createVersion({ projectId: project.id, envelope });
  version.snapshot.sizing.actualKwp = 999;
  const [stored] = await platform.projects.listVersions({ projectId: project.id });
  assert.equal(stored.snapshot.sizing.actualKwp, 10);
  assert.match(stored.snapshotHash, /^[0-9a-f]{64}$/);
});

await test("5. Client, bank and technician snapshots exclude commercial internals", async () => {
  const envelope = await createProjectVersionEnvelope({
    record: {
      project: { client: "Client", monthlyBill: 120000 },
      survey: { roofAreaM2: 80, mainBreakerA: 100, earthingAvailable: true },
    },
    sizing: { actualKwp: 16, totalCost: 2200000 },
    boq: { headline: { totalInvestment: 2200000 }, supplierCost: 1300000, marginPct: 18 },
  });
  assert.equal(containsCommercialInternals(envelope.snapshot), true);
  assert.equal(containsCommercialInternals(envelope.publicSnapshot), false);
  assert.equal(containsCommercialInternals(envelope.bankSnapshot), false);
  assert.equal(containsCommercialInternals(envelope.fieldSnapshot), false);
  assert.equal(envelope.publicSnapshot.survey.facts.roofAreaM2.status, "assumption");
  assert.match(envelope.publicSnapshot.survey.facts.mainBreakerA.label, /confirm during site survey/i);
});

await test("6. Legacy exports preserve a deterministic fingerprint and untrusted provenance", async () => {
  const legacy = { id: 7, schemaVersion: "11.7", appVersion: "Voltflow 11.7.2b", savedAt: "2026-08-01T00:00:00.000Z", project: { client: "Legacy" }, evidence: { approval: "approved" } };
  const first = await prepareLegacyProjectMigration(legacy);
  const second = await prepareLegacyProjectMigration({ ...legacy });
  assert.equal(first.sourceFingerprint, second.sourceFingerprint);
  assert.equal(first.provenance.legacyApprovalsTrusted, false);
  assert.equal(first.provenance.legacyEvidenceTrusted, false);
  assert.deepEqual(first.currentRecord, legacy);
});

await test("7. Bill-load reconciliation separates coverage from savings claims", () => {
  const matched = reconcileBillAndLoads({ monthlyBillKes: 30000, tariffKesPerKwh: 30, itemizedDailyKwh: 33.33, monthlySavingsKes: 15000, nonEnergyChargesKnown: true });
  assert.equal(matched.status, BILL_LOAD_STATUS.MATCHED);
  assert.ok(Math.abs(matched.capturedLoadCoveragePct - 1) < 0.01);
  assert.ok(Math.abs(matched.savingsPctOfBill - 0.5) < 0.001);
  const mismatch = reconcileBillAndLoads({ monthlyBillKes: 30000, tariffKesPerKwh: 30, itemizedDailyKwh: 10, monthlySavingsKes: 15000, nonEnergyChargesKnown: true });
  assert.equal(mismatch.status, BILL_LOAD_STATUS.UNDER_CAPTURED);
  assert.equal(mismatch.clientClaimsBlocked, true);
  const unknownCharges = reconcileBillAndLoads({ monthlyBillKes: 30000, tariffKesPerKwh: 30, itemizedDailyKwh: 33.33, nonEnergyChargesKnown: false });
  assert.equal(unknownCharges.status, BILL_LOAD_STATUS.NON_ENERGY_CHARGES_UNRESOLVED);
});

await test("8. Evidence paths are private tenant/project paths with role checks", () => {
  const organisationId = "10000000-0000-4000-8000-000000000001";
  const projectId = "10000000-1000-4000-8000-000000000001";
  const evidenceId = "10000000-6000-4000-8000-000000000001";
  const path = buildEvidenceObjectPath({ organisationId, projectId, evidenceId, filename: "../roof photo.jpg" });
  assert.equal(path, `${organisationId}/${projectId}/${evidenceId}/roof_photo.jpg`);
  assert.equal(safeEvidenceFilename("../../secret.pdf"), "secret.pdf");
  const technician = { userId: "tech", organisationId, status: "active", role: "technician" };
  assert.equal(canAccessEvidencePath(technician, path, { assignedProjectIds: [projectId], operation: "upload" }), true);
  assert.equal(canAccessEvidencePath(technician, path, { assignedProjectIds: [], operation: "upload" }), false);
  const client = { userId: "client", organisationId, status: "active", role: "client" };
  assert.equal(canAccessEvidencePath(client, path, { sharedProjectIds: [projectId], operation: "download", reviewStatus: "verified" }), true);
  assert.equal(canAccessEvidencePath(client, path, { sharedProjectIds: [projectId], operation: "download", reviewStatus: "submitted" }), false);
});

await test("8b. Evidence checksum uses file bytes rather than metadata", async () => {
  const first = await checksumEvidenceFile({ arrayBuffer: async () => new TextEncoder().encode("evidence-a").buffer });
  const second = await checksumEvidenceFile({ arrayBuffer: async () => new TextEncoder().encode("evidence-b").buffer });
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, second);
});

await test("9. Review workflow locks to a version and local mode is honest", () => {
  let submission = createLocalReviewSubmission({ projectId: "p1", projectVersionId: "v1" });
  assert.equal(submission.cloudSubmitted, false);
  assert.match(submission.message, /No cloud or external review submission occurred/i);
  submission = transitionReview(submission, "review_ready");
  submission = transitionReview(submission, "submitted");
  submission = transitionReview(submission, "in_review");
  assert.throws(() => transitionReview(submission, "approved"), /requires a reason/i);
  submission = transitionReview(submission, "approved", { reason: "Engineering checks complete" });
  assert.equal(submission.status, "approved");
});

await test("10. Browser configuration rejects privileged Supabase keys", () => {
  assert.throws(() => assertBrowserSafeSupabaseKey(jwtWithRole("service_role")), /forbidden/i);
  assert.equal(resolvePlatformConfig({}).mode, "local-demo");
  const config = resolvePlatformConfig({
    VITE_VOLTFLOW_PROVIDER: "supabase",
    VITE_SUPABASE_URL: "http://127.0.0.1:54321",
    VITE_SUPABASE_PUBLISHABLE_KEY: jwtWithRole("anon"),
  });
  assert.equal(config.authRequired, true);
});

await test("11. Assistant cloud gate validates bearer membership and internal role", async () => {
  const env = { VOLTFLOW_REQUIRE_AUTH: "true", SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_PUBLISHABLE_KEY: jwtWithRole("anon") };
  assert.equal(assistantAuthRequired(env), true);
  assert.equal(extractBearerToken({ authorization: "Bearer fixture-token" }), "fixture-token");
  await assert.rejects(
    verifyAssistantAccess({ headers: {} }, { organisationId: "10000000-0000-4000-8000-000000000001" }, { env }),
    (error) => error.status === 401,
  );
  const mockClient = (role) => ({
    auth: { getUser: async () => ({ data: { user: { id: "11000000-0000-4000-8000-000000000101" } }, error: null }) },
    from: () => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { role, status: "active" }, error: null }) };
      return query;
    },
  });
  const accepted = await verifyAssistantAccess(
    { headers: { authorization: "Bearer fixture-token" } },
    { organisationId: "10000000-0000-4000-8000-000000000001" },
    { env, createClient: () => mockClient("engineer") },
  );
  assert.equal(accepted.role, "engineer");
  await assert.rejects(
    verifyAssistantAccess(
      { headers: { authorization: "Bearer fixture-token" } },
      { organisationId: "10000000-0000-4000-8000-000000000001" },
      { env, createClient: () => mockClient("bank") },
    ),
    (error) => error.status === 403,
  );
});

await test("12. SQL migrations define required tenant tables, forced RLS and immutable ledgers", () => {
  const core = readFileSync(new URL("../supabase/migrations/202608070001_core_schema.sql", import.meta.url), "utf8");
  const rls = readFileSync(new URL("../supabase/migrations/202608070002_rls_and_storage.sql", import.meta.url), "utf8");
  const rpc = readFileSync(new URL("../supabase/migrations/202608070003_trust_rpcs_and_immutability.sql", import.meta.url), "utf8");
  const seed = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
  const tables = ["organisations", "organisation_memberships", "profiles", "projects", "project_members", "project_versions", "audit_events", "evidence_items", "review_submissions", "approvals", "boq_revisions", "project_shares"];
  tables.forEach((table) => assert.match(core, new RegExp(`create table public\\.${table}\\s*\\(`, "i"), `${table} table missing`));
  ["organisation_memberships", "projects", "project_members", "project_versions", "audit_events", "evidence_items", "review_submissions", "approvals", "boq_revisions", "project_shares"].forEach((table) => {
    const definition = core.match(new RegExp(`create table public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i"))?.[1] || "";
    assert.match(definition, /organisation_id uuid not null/i, `${table}.organisation_id missing`);
    assert.match(rls, new RegExp(`alter table public\\.${table} force row level security`, "i"), `${table} forced RLS missing`);
  });
  assert.match(rls, /project-evidence'[\s\S]*false/i);
  assert.doesNotMatch(rls, /create policy[\s\S]{0,80}storage\.objects for (update|delete)/i);
  assert.match(rpc, /project_versions_append_only/i);
  assert.match(rpc, /audit_events_append_only/i);
  assert.match(rpc, /approvals_append_only/i);
  assert.match(rpc, /vf_json_has_secret_keys/i);
  assert.match(rpc, /vf_audience_snapshot_is_safe/i);
  assert.match(rpc, /review_evidence/i);
  assert.match(rpc, /Project changed since it was loaded/i);
  assert.match(seed, /Fixture EPC A/);
  assert.match(seed, /Fixture EPC B/);
  ["manager", "engineer", "sales", "technician", "client", "bank"].forEach((role) => assert.match(seed, new RegExp(`'${role}'`, "i")));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
