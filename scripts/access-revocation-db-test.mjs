/**
 * Live-only proof that an existing authenticated session loses organisation,
 * project and storage access immediately after a manager revokes membership.
 * Uses dummy users created by supabase/seed.sql on a reset test stack.
 */
import { detectLiveSupabase, reportNotExecuted, writeSuiteResult, STATUS } from "./lib/securityStatus.mjs";

const ACCESS_SUITE = "access-revocation";
const AUTH_SUITE = "auth-flow";

async function signIn(createClient, url, anonKey, email, password) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.session) throw new Error(`Sign-in failed for ${email}: ${error?.message || "no session"}`);
  return client;
}

async function main() {
  const env = process.env;
  const live = await detectLiveSupabase(env);
  const required = [
    "SUPABASE_TEST_URL", "SUPABASE_TEST_ANON_KEY", "MANAGER_A_EMAIL", "MANAGER_A_PASSWORD",
    "REVOKEE_A_EMAIL", "REVOKEE_A_PASSWORD", "REVOKEE_A_MEMBERSHIP_ID", "TENANT_A_PROJECT_ID",
    "TENANT_A_EVIDENCE_PATH",
  ];
  const missing = required.filter((name) => !env[name]);
  if (!live.reachable || missing.length > 0) {
    const reason = `No reset Supabase test stack or fixture variables (${missing.join(", ") || "database unreachable"}).`;
    reportNotExecuted(AUTH_SUITE, reason);
    return reportNotExecuted(ACCESS_SUITE, `${reason} Revocation is implemented but not security-verified.`);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const manager = await signIn(createClient, env.SUPABASE_TEST_URL, env.SUPABASE_TEST_ANON_KEY, env.MANAGER_A_EMAIL, env.MANAGER_A_PASSWORD);
  const revokee = await signIn(createClient, env.SUPABASE_TEST_URL, env.SUPABASE_TEST_ANON_KEY, env.REVOKEE_A_EMAIL, env.REVOKEE_A_PASSWORD);
  writeSuiteResult(AUTH_SUITE, { status: STATUS.PASS, executed: true, passed: true, results: ["manager password session", "revokee password session"] });

  const before = await revokee.from("projects").select("id").eq("id", env.TENANT_A_PROJECT_ID);
  const accessBefore = !before.error && (before.data || []).length === 1;
  if (!accessBefore) throw new Error("Revocation fixture did not have project access before revocation; reset the local stack before rerunning.");

  const revoked = await manager.rpc("revoke_organisation_membership", {
    p_organisation_id: "10000000-0000-4000-8000-000000000001",
    p_membership_id: env.REVOKEE_A_MEMBERSHIP_ID,
    p_reason: "Automated dummy-data access revocation proof",
    p_request_id: crypto.randomUUID(),
  });
  if (revoked.error) throw new Error(`Manager revocation RPC failed: ${revoked.error.message}`);

  const projectRead = await revokee.from("projects").select("id").eq("id", env.TENANT_A_PROJECT_ID);
  const projectWrite = await revokee.from("projects").update({ location: "SHOULD-NOT-WRITE" }).eq("id", env.TENANT_A_PROJECT_ID).select("id");
  const evidenceRead = await revokee.from("evidence_items").select("id").eq("project_id", env.TENANT_A_PROJECT_ID);
  const signedUrl = await revokee.storage.from("project-evidence").createSignedUrl(env.TENANT_A_EVIDENCE_PATH, 60);
  const activeMembership = await revokee.from("organisation_memberships").select("id,status").eq("id", env.REVOKEE_A_MEMBERSHIP_ID).eq("status", "active");

  const results = [
    { name: "project read denied after revocation", ok: Boolean(projectRead.error) || (projectRead.data || []).length === 0 },
    { name: "project write denied after revocation", ok: Boolean(projectWrite.error) || (projectWrite.data || []).length === 0 },
    { name: "evidence list denied after revocation", ok: Boolean(evidenceRead.error) || (evidenceRead.data || []).length === 0 },
    { name: "signed evidence URL denied after revocation", ok: Boolean(signedUrl.error) || !signedUrl.data?.signedUrl },
    { name: "active membership absent after revocation", ok: Boolean(activeMembership.error) || (activeMembership.data || []).length === 0 },
  ];
  const passed = results.every((result) => result.ok);
  writeSuiteResult(ACCESS_SUITE, { status: passed ? STATUS.PASS : STATUS.FAIL, executed: true, passed, results });
  console.log(`\n[${ACCESS_SUITE}] STATUS: ${passed ? STATUS.PASS : STATUS.FAIL}`);
  for (const result of results) console.log(`  ${result.ok ? "PASS" : "FAIL"}: ${result.name}`);
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  writeSuiteResult(ACCESS_SUITE, { status: STATUS.FAIL, executed: true, passed: false, reason: error.message });
  console.error(`\n[${ACCESS_SUITE}] STATUS: FAIL\n  ${error.message}\n`);
  process.exitCode = 1;
});
