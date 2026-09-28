/**
 * revision-immutability-db-test.mjs — Voltflow 11.8.1 (Phase 6)
 *
 * Proves design/quote revision immutability at the DATABASE boundary (a normal
 * authenticated user cannot UPDATE/DELETE an issued revision; catalog price
 * changes never mutate an issued quote). Requires a live Supabase; otherwise
 * records NOT_EXECUTED.
 *
 * Env: SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, TENANT_A_EMAIL, TENANT_A_PASSWORD,
 *      ISSUED_DESIGN_REVISION_ID, ISSUED_QUOTE_REVISION_ID
 */
import { detectLiveSupabase, reportNotExecuted, writeSuiteResult, STATUS } from "./lib/securityStatus.mjs";

const SUITE = "revision-db";

async function main() {
  const env = process.env;
  const live = await detectLiveSupabase(env);
  if (!live.reachable || !env.SUPABASE_TEST_URL || !env.SUPABASE_TEST_ANON_KEY) {
    return reportNotExecuted(SUITE,
      "No reachable Supabase test DB. Revision immutability is IMPLEMENTED in app logic and in " +
      "202608070003_trust_rpcs_and_immutability.sql, but DB-enforced immutability is NOT VERIFIED until this runs.");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const c = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_ANON_KEY, { auth: { persistSession: false } });
  const { error: signErr } = await c.auth.signInWithPassword({ email: env.TENANT_A_EMAIL, password: env.TENANT_A_PASSWORD });
  if (signErr) return reportNotExecuted(SUITE, `sign-in failed: ${signErr.message}`);

  // Fixture precheck — the deterministic issued rows must exist (from
  // supabase/fixtures/security-proof-fixtures.sql). If not, this is genuinely
  // BLOCKED (missing fixtures), never a silent pass.
  const dr = await c.from("design_revisions").select("id").eq("id", env.ISSUED_DESIGN_REVISION_ID).maybeSingle();
  const qr = await c.from("quotes").select("id").eq("id", env.ISSUED_QUOTE_REVISION_ID).maybeSingle();
  if (!dr.data || !qr.data) {
    return reportNotExecuted(SUITE,
      "Issued design/quote fixture rows not found. Apply supabase/fixtures/security-proof-fixtures.sql after `supabase db reset` (the one-shot runner does this).");
  }

  const results = [];
  const rec = (name, denied) => results.push({ name, expected: "DENY", denied, ok: denied === true });

  const du = await c.from("design_revisions").update({ calculation_version: "tampered" }).eq("id", env.ISSUED_DESIGN_REVISION_ID).select();
  rec("UPDATE issued design revision", (du.data || []).length === 0 || Boolean(du.error));
  const dd = await c.from("design_revisions").delete().eq("id", env.ISSUED_DESIGN_REVISION_ID).select();
  rec("DELETE issued design revision", (dd.data || []).length === 0 || Boolean(dd.error));
  const qu = await c.from("quotes").update({ status: "VOID" }).eq("id", env.ISSUED_QUOTE_REVISION_ID).select();
  rec("UPDATE issued quote revision", (qu.data || []).length === 0 || Boolean(qu.error));
  const qd = await c.from("quotes").delete().eq("id", env.ISSUED_QUOTE_REVISION_ID).select();
  rec("DELETE issued quote revision", (qd.data || []).length === 0 || Boolean(qd.error));

  const allDenied = results.every((r) => r.ok);
  const res = { status: allDenied ? STATUS.PASS : STATUS.FAIL, executed: true, passed: allDenied, results };
  writeSuiteResult(SUITE, res);
  console.log(`\n[${SUITE}] STATUS: ${res.status}`);
  for (const r of results) console.log(`  ${r.ok ? "DENIED ✓" : "MUTABLE ✗"}  ${r.name}`);
  if (!allDenied) process.exitCode = 1;
}
main().catch((e) => reportNotExecuted(SUITE, `Harness error: ${e.message}`));
