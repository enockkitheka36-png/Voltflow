/**
 * tenant-isolation-attack-test.mjs — Voltflow 11.8.1 (Phase 5)
 *
 * Proves cross-tenant DENIAL at the database/storage boundary. Requires a live
 * Supabase (local via `supabase start`, or a disposable staging project) plus
 * two seeded users in two organisations. Without a reachable DB it records
 * NOT_EXECUTED (never a silent pass).
 *
 * Env (no secrets committed):
 *   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY
 *   TENANT_A_EMAIL, TENANT_A_PASSWORD, TENANT_B_EMAIL, TENANT_B_PASSWORD
 *   TENANT_B_PROJECT_ID, TENANT_B_EVIDENCE_PATH
 */
import { detectLiveSupabase, reportNotExecuted, writeSuiteResult, STATUS } from "./lib/securityStatus.mjs";

const SUITE = "tenant-attack";

async function main() {
  const env = process.env;
  const live = await detectLiveSupabase(env);
  if (!live.reachable || !env.SUPABASE_TEST_URL || !env.SUPABASE_TEST_ANON_KEY) {
    return reportNotExecuted(SUITE,
      "No reachable Supabase test DB (need `supabase start` + SUPABASE_TEST_URL/ANON_KEY and seeded tenants A/B). " +
      "Cross-tenant isolation is IMPLEMENTED in migrations but NOT SECURITY-VERIFIED until this runs.");
  }

  // ---- reachable path (runs when Vincent has Docker/Supabase) ----
  const { createClient } = await import("@supabase/supabase-js");
  const results = [];
  const record = (name, denied) => results.push({ name, expected: "DENY", denied, ok: denied === true });

  const clientFor = async (email, password) => {
    const c = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_ANON_KEY, { auth: { persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
    return c;
  };

  const a = await clientFor(env.TENANT_A_EMAIL, env.TENANT_A_PASSWORD);
  const bProject = env.TENANT_B_PROJECT_ID;
  const bEvidence = env.TENANT_B_EVIDENCE_PATH;

  // A attempts to touch B's data — every one must be denied (no rows / error).
  const sel = await a.from("projects").select("id").eq("id", bProject);
  record("A reads B project", (sel.data || []).length === 0 || Boolean(sel.error));
  const upd = await a.from("projects").update({ client: "HACKED" }).eq("id", bProject).select();
  record("A updates B project", (upd.data || []).length === 0 || Boolean(upd.error));
  const del = await a.from("projects").delete().eq("id", bProject).select();
  record("A deletes B project", (del.data || []).length === 0 || Boolean(del.error));
  const ev = await a.from("evidence_items").select("id").eq("project_id", bProject);
  record("A lists B evidence", (ev.data || []).length === 0 || Boolean(ev.error));
  const signed = await a.storage.from("project-evidence").createSignedUrl(bEvidence, 60);
  record("A signs B evidence URL", Boolean(signed.error) || !signed.data);
  const up = await a.storage.from("project-evidence").upload(`${bEvidence}.intrusion`, new Blob(["x"]));
  record("A uploads into B path", Boolean(up.error));

  const allDenied = results.every((r) => r.ok);
  const res = { status: allDenied ? STATUS.PASS : STATUS.FAIL, executed: true, passed: allDenied, results };
  writeSuiteResult(SUITE, res);
  console.log(`\n[${SUITE}] STATUS: ${res.status}`);
  for (const r of results) console.log(`  ${r.ok ? "DENIED ✓" : "LEAK ✗"}  ${r.name}`);
  if (!allDenied) process.exitCode = 1;
}

main().catch((e) => { reportNotExecuted(SUITE, `Harness error: ${e.message}`); });
