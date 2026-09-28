/**
 * audit-trail-db-test.mjs — Voltflow 11.8.1 (Phase 8)
 *
 * Proves the audit ledger is append-only at the DB level (a normal authenticated
 * user cannot UPDATE/DELETE/rewrite audit events). Requires a live Supabase;
 * otherwise records NOT_EXECUTED.
 *
 * Env: SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, TENANT_A_EMAIL/PASSWORD, AUDIT_EVENT_ID
 */
import { detectLiveSupabase, reportNotExecuted, writeSuiteResult, STATUS } from "./lib/securityStatus.mjs";

const SUITE = "audit-db";

async function main() {
  const env = process.env;
  const live = await detectLiveSupabase(env);
  if (!live.reachable || !env.SUPABASE_TEST_URL || !env.SUPABASE_TEST_ANON_KEY) {
    return reportNotExecuted(SUITE,
      "No reachable Supabase DB. Audit ledgers are defined immutable in migrations, but DB-enforced " +
      "append-only behaviour is NOT VERIFIED until this runs.");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const c = createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_ANON_KEY, { auth: { persistSession: false } });
  const { error: e0 } = await c.auth.signInWithPassword({ email: env.TENANT_A_EMAIL, password: env.TENANT_A_PASSWORD });
  if (e0) return reportNotExecuted(SUITE, `sign-in failed: ${e0.message}`);

  // Fixture precheck — the deterministic audit event must exist (from
  // supabase/fixtures/security-proof-fixtures.sql). If not, BLOCKED, never a pass.
  const ev = await c.from("audit_events").select("id").eq("id", env.AUDIT_EVENT_ID).maybeSingle();
  if (!ev.data) {
    return reportNotExecuted(SUITE,
      "Audit event fixture row not found. Apply supabase/fixtures/security-proof-fixtures.sql after `supabase db reset` (the one-shot runner does this).");
  }

  const results = [];
  const rec = (name, denied) => results.push({ name, expected: "DENY", ok: denied === true });

  const u = await c.from("audit_events").update({ actor_user_id: "22000000-0000-4000-8000-000000000202" }).eq("id", env.AUDIT_EVENT_ID).select();
  rec("UPDATE audit event actor", (u.data || []).length === 0 || Boolean(u.error));
  const d = await c.from("audit_events").delete().eq("id", env.AUDIT_EVENT_ID).select();
  rec("DELETE audit event", (d.data || []).length === 0 || Boolean(d.error));
  const t = await c.from("audit_events").update({ occurred_at: "2000-01-01T00:00:00Z" }).eq("id", env.AUDIT_EVENT_ID).select();
  rec("rewrite audit timestamp", (t.data || []).length === 0 || Boolean(t.error));

  const allDenied = results.every((r) => r.ok);
  const res = { status: allDenied ? STATUS.PASS : STATUS.FAIL, executed: true, passed: allDenied, results };
  writeSuiteResult(SUITE, res);
  console.log(`\n[${SUITE}] STATUS: ${res.status}`);
  for (const r of results) console.log(`  ${r.ok ? "DENIED ✓" : "MUTABLE ✗"}  ${r.name}`);
  if (!allDenied) process.exitCode = 1;
}
main().catch((e) => reportNotExecuted(SUITE, `Harness error: ${e.message}`));
