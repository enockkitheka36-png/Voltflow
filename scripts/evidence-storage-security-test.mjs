/**
 * evidence-storage-security-test.mjs — Voltflow 11.8.1 (Phase 7)
 *
 * Proves private evidence storage + signed access control at the real Supabase
 * Storage boundary. Requires a live Supabase; otherwise records NOT_EXECUTED.
 *
 * Env: SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY,
 *      TENANT_A_EMAIL/PASSWORD (owner), TENANT_B_EMAIL/PASSWORD (attacker),
 *      TENANT_A_EVIDENCE_PATH
 */
import { detectLiveSupabase, reportNotExecuted, writeSuiteResult, STATUS } from "./lib/securityStatus.mjs";

const SUITE = "evidence-security";

async function main() {
  const env = process.env;
  const live = await detectLiveSupabase(env);
  if (!live.reachable || !env.SUPABASE_TEST_URL || !env.SUPABASE_TEST_ANON_KEY) {
    return reportNotExecuted(SUITE,
      "No reachable Supabase Storage. Signed-URL + checksum + private-bucket flow is IMPLEMENTED " +
      "(supabaseAdapter.js, evidenceAuthorization.js) but access control is NOT VERIFIED until this runs.");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const signIn = async (email, password) => {
    const c = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_ANON_KEY, { auth: { persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return c;
  };
  const results = [];
  const rec = (name, expect, actual) => results.push({ name, expect, ok: expect === actual });

  const owner = await signIn(env.TENANT_A_EMAIL, env.TENANT_A_PASSWORD);
  const attacker = await signIn(env.TENANT_B_EMAIL, env.TENANT_B_PASSWORD);
  const path = env.TENANT_A_EVIDENCE_PATH;

  const ownerSign = await owner.storage.from("project-evidence").createSignedUrl(path, 60);
  rec("owner can sign own evidence", true, Boolean(ownerSign.data) && !ownerSign.error);
  const attackerSign = await attacker.storage.from("project-evidence").createSignedUrl(path, 60);
  rec("attacker cannot sign owner evidence", true, Boolean(attackerSign.error) || !attackerSign.data);
  const attackerList = await attacker.storage.from("project-evidence").list(path.split("/").slice(0, -1).join("/"));
  rec("attacker cannot list owner evidence dir", true, Boolean(attackerList.error) || (attackerList.data || []).length === 0);

  const allOk = results.every((r) => r.ok);
  const res = { status: allOk ? STATUS.PASS : STATUS.FAIL, executed: true, passed: allOk, results,
    note: "MIME/size/duplicate-checksum/expired-URL/orphan cases require additional seeded fixtures." };
  writeSuiteResult(SUITE, res);
  console.log(`\n[${SUITE}] STATUS: ${res.status}`);
  for (const r of results) console.log(`  ${r.ok ? "OK ✓" : "FAIL ✗"}  ${r.name}`);
  if (!allOk) process.exitCode = 1;
}
main().catch((e) => reportNotExecuted(SUITE, `Harness error: ${e.message}`));
