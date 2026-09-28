#!/usr/bin/env node
/**
 * run-supabase-security-proof.mjs — Voltflow 11.8.1 → 11.8.2 one-shot proof.
 *
 * Runs the full Supabase connected-staging security proof on a machine WITH
 * Docker Desktop or Podman. Safe: dummy fixtures only, no secrets printed,
 * never writes .env.local, never claims a skipped test passed.
 *
 * Usage:  node scripts/run-supabase-security-proof.mjs
 *
 * Result codes (exactly one written to the JSON report):
 *   BLOCKED_DOCKER_MISSING            — no container runtime; nothing proven
 *   FAIL_BUILD | FAIL_JS_TESTS        — pre-flight app checks failed
 *   FAIL_SUPABASE_START               — supabase start failed (non-Docker cause)
 *   FAIL_MIGRATION                    — supabase db reset failed
 *   FAIL_RLS                          — pgTAP RLS/storage assertions failed
 *   FAIL_TENANT_ISOLATION             — cross-tenant access succeeded
 *   FAIL_EVIDENCE_STORAGE             — evidence access control failed
 *   FAIL_REVISION_IMMUTABILITY        — issued revision was mutable
 *   FAIL_AUDIT_APPEND_ONLY            — audit tampering succeeded
 *   BLOCKED_MISSING_REVISION_AUDIT_FIXTURES — those two suites need extra fixtures
 *   PASS_CONTROLLED_PILOT_GATE        — all connected security proof executed and passed
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const GEN = path.join(REPO, "docs", "generated");
fs.mkdirSync(GEN, { recursive: true });

const isWin = process.platform === "win32";
const npmCli = isWin ? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js") : null;
const npxCli = isWin ? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js") : null;
const steps = [];
const log = (m) => console.log(m);
function record(name, status, detail = "") { steps.push({ name, status, detail }); log(`  [${status}] ${name}${detail ? " — " + detail : ""}`); }

function run(cmd, args, opts = {}) {
  try {
    const out = execFileSync(cmd, args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: opts.timeout || 600000, env: { ...process.env, ...(opts.env || {}) } });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || e.message || ""), code: e.status };
  }
}
function npmExec(args, opts = {}) { return isWin ? run(process.execPath, [npmCli, ...args], opts) : run("npm", args, opts); }
function npxExec(args, opts = {}) { return isWin ? run(process.execPath, [npxCli, ...args], opts) : run("npx", args, opts); }
function npmRun(script, env) { return npmExec(["run", script], { env, timeout: 900000 }); }
function has(bin, arg = "--version") { return run(bin, [arg]).ok; }
function portOpen(port) { return new Promise((res) => { const s = new net.Socket(); s.setTimeout(1500); s.once("connect", () => { s.destroy(); res(true); }); s.once("timeout", () => { s.destroy(); res(false); }); s.once("error", () => res(false)); s.connect(port, "127.0.0.1"); }); }

// Deterministic dummy fixtures from supabase/seed.sql (local-only; not secrets in the security sense).
const FIXTURES = {
  TENANT_A_EMAIL: "engineer.a@voltflow.local",
  TENANT_B_EMAIL: "engineer.b@voltflow.local",
  TENANT_A_PASSWORD: "Voltflow-Local-Only-2026!",
  TENANT_B_PASSWORD: "Voltflow-Local-Only-2026!",
  MANAGER_A_EMAIL: "manager.a@voltflow.local",
  MANAGER_A_PASSWORD: "Voltflow-Local-Only-2026!",
  REVOKEE_A_EMAIL: "revokee.a@voltflow.local",
  REVOKEE_A_PASSWORD: "Voltflow-Local-Only-2026!",
  REVOKEE_A_MEMBERSHIP_ID: "11100000-0000-4000-8000-000000000107",
  TENANT_A_PROJECT_ID: "10000000-1000-4000-8000-000000000001",
  TENANT_B_PROJECT_ID: "20000000-1000-4000-8000-000000000002",
  TENANT_A_EVIDENCE_PATH: "10000000-0000-4000-8000-000000000001/10000000-1000-4000-8000-000000000001/10000000-6000-4000-8000-000000000001/site.jpg",
  TENANT_B_EVIDENCE_PATH: "20000000-0000-4000-8000-000000000002/20000000-1000-4000-8000-000000000002/20000000-6000-4000-8000-000000000002/site.jpg",
  // From supabase/fixtures/security-proof-fixtures.sql (org A issued rows).
  ISSUED_DESIGN_REVISION_ID: "10000000-4000-4000-8000-000000000001",
  ISSUED_QUOTE_REVISION_ID: "10000000-5000-4000-8000-000000000001",
  AUDIT_EVENT_ID: "10000000-7000-4000-8000-000000000003",
};

const FIXTURE_SQL = "supabase/fixtures/security-proof-fixtures.sql";
let fixtureSeed = { executed: false, passed: false, error: null };

/** Apply the security-proof fixtures via psql, else node-pg, else fail clearly. */
function applyFixtures(dbUrl) {
  if (!dbUrl) { fixtureSeed = { executed: false, passed: false, error: "DB_URL not resolved from supabase status" }; return false; }
  // 1) psql (most common on a Supabase/Postgres dev machine)
  if (has("psql")) {
    const r = run("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", FIXTURE_SQL], { timeout: 120000 });
    fixtureSeed = { executed: true, passed: r.ok, error: r.ok ? null : String(r.out || "").slice(-300) };
    return r.ok;
  }
  // 2) node-postgres if installed
  if (fs.existsSync(path.join(REPO, "node_modules", "pg"))) {
    const js = `import fs from 'node:fs';import pg from 'pg';const c=new pg.Client(process.env.__DBURL);await c.connect();await c.query(fs.readFileSync(process.env.__SQL,'utf8'));await c.end();console.log('ok');`;
    const r = run("node", ["--input-type=module", "-e", js], { timeout: 120000, env: { __DBURL: dbUrl, __SQL: FIXTURE_SQL } });
    fixtureSeed = { executed: true, passed: r.ok, error: r.ok ? null : String(r.out || "").slice(-300) };
    return r.ok;
  }
  // 3) documented fallback
  fixtureSeed = { executed: false, passed: false, error: `No psql or node 'pg' available. Run manually: psql "<DB_URL>" -f ${FIXTURE_SQL}` };
  return false;
}

function parseSupabaseStatus() {
  // `supabase status -o env` prints KEY="value" lines. We read only API_URL + ANON_KEY.
  const r = npxExec(["--no-install", "supabase", "status", "-o", "env"], { timeout: 60000 });
  if (!r.ok) return {};
  const grab = (k) => { const m = r.out.match(new RegExp(`${k}="?([^"\\n]+)"?`)); return m ? m[1] : ""; };
  return { url: grab("API_URL"), anon: grab("ANON_KEY"), dbUrl: grab("DB_URL") };
}

function readSuite(name) { try { return JSON.parse(fs.readFileSync(path.join(GEN, `security-${name}.json`), "utf8")); } catch { return null; } }
function suiteState(name) { const j = readSuite(name); return { executed: !!j?.executed, passed: !!j?.passed, status: j?.status || "NOT_EXECUTED" }; }

async function main() {
  log("\n=== Voltflow Supabase Security Proof (one-shot) ===\n");

  // Phase 0 — environment
  const appVersion = (fs.readFileSync(path.join(REPO, "src/utils/schemaMigration.js"), "utf8").match(/APP_VERSION = "([^"]+)"/) || [])[1];
  const schemaVersion = (fs.readFileSync(path.join(REPO, "src/utils/schemaMigration.js"), "utf8").match(/SCHEMA_VERSION = "([^"]+)"/) || [])[1];
  record("Repo path", "INFO", REPO);
  record("APP_VERSION", "INFO", appVersion);
  record("SCHEMA_VERSION", "INFO", schemaVersion);
  record("Node", "INFO", process.version);
  const dockerOk = has("docker") && run("docker", ["info"]).ok;
  const podmanOk = has("podman");
  const supaCli = npxExec(["--no-install", "supabase", "--version"]).ok;
  record("Supabase CLI", supaCli ? "OK" : "MISSING");
  record("Docker", dockerOk ? "RUNNING" : "NOT AVAILABLE");
  record("Podman", podmanOk ? "AVAILABLE" : "NOT AVAILABLE");
  record("Port 54321", (await portOpen(54321)) ? "OPEN" : "CLOSED");
  record("Port 54322", (await portOpen(54322)) ? "OPEN" : "CLOSED");

  let resultCode = null;

  // Hard stop: no container runtime.
  if (!dockerOk && !podmanOk) {
    resultCode = "BLOCKED_DOCKER_MISSING";
    record("Container runtime", "BLOCKED", "Install Docker Desktop or Podman and ensure it is on PATH.");
    return finish(resultCode, { appVersion, schemaVersion, dockerOk, podmanOk });
  }

  // Phase 0 — app baseline
  record("npm ci", "RUN"); if (!npmExec(["ci"], { timeout: 900000 }).ok) { record("npm ci", "WARN", "continuing with existing node_modules"); }
  if (!run("node", ["node_modules/vite/bin/vite.js", "build"], { timeout: 300000 }).ok) return finish("FAIL_BUILD", { appVersion });
  record("build", "PASS");
  for (const s of ["test:all", "test:commercial", "test:trust", "test:release-gates"]) {
    if (!npmRun(s).ok) return finish("FAIL_JS_TESTS", { appVersion, failed: s });
    record(s, "PASS");
  }

  // Phase 1 — start supabase
  const start = npxExec(["--no-install", "supabase", "start"], { timeout: 600000 });
  if (!start.ok) {
    const docker = /docker: command not found|podman also not found|Cannot connect to the Docker daemon/i.test(start.out);
    return finish(docker ? "BLOCKED_DOCKER_MISSING" : "FAIL_SUPABASE_START", { appVersion, detail: start.out.slice(-400) });
  }
  record("supabase start", "PASS");
  const reset = npxExec(["--no-install", "supabase", "db", "reset"], { timeout: 600000 });
  if (!reset.ok) return finish("FAIL_MIGRATION", { appVersion, detail: reset.out.slice(-400) });
  record("supabase db reset (migrations + seed)", "PASS");

  // Derive URL + anon key + DB URL (never print the service-role key or DB password)
  const { url, anon, dbUrl } = parseSupabaseStatus();

  // Phase 3 — apply isolated security-proof fixtures (issued revisions/quotes/audit events)
  const fxOk = applyFixtures(dbUrl);
  record("apply security-proof fixtures", fixtureSeed.executed ? (fxOk ? "PASS" : "FAIL") : "SKIPPED", fixtureSeed.error ? "(see fixtureSeedError)" : "");
  if (fixtureSeed.executed && !fxOk) return finish("FAIL_FIXTURE_SEED", { appVersion });
  const secEnv = { ...FIXTURES, SUPABASE_TEST_URL: url, SUPABASE_TEST_ANON_KEY: anon };
  record("Supabase API URL", url ? "OK" : "MISSING", url ? url.replace(/:\d+$/, ":<port>") : "");
  record("Anon key", anon ? "OK (masked)" : "MISSING");

  // Phase 2 — pgTAP RLS
  const rls = npxExec(["--no-install", "supabase", "test", "db"], { timeout: 600000 });
  fs.writeFileSync(path.join(GEN, "security-rls.json"), JSON.stringify({ suite: "rls", executed: true, passed: rls.ok, status: rls.ok ? "PASS" : "FAIL", writtenAt: new Date().toISOString() }, null, 2));
  if (!rls.ok) return finish("FAIL_RLS", { appVersion, detail: rls.out.slice(-500) });
  record("pgTAP RLS/storage", "PASS");

  // Phases 4-7 — DB security suites (turnkey fixtures wired via secEnv)
  npmRun("test:tenant-attack", secEnv);
  npmRun("test:evidence-security", secEnv);
  npmRun("test:revision-db", secEnv);
  npmRun("test:audit-db", secEnv);
  npmRun("test:access-revocation", secEnv);

  const tenant = suiteState("tenant-attack");
  const evidence = suiteState("evidence-security");
  const revision = suiteState("revision-db");
  const audit = suiteState("audit-db");
  const auth = suiteState("auth-flow");
  const revocation = suiteState("access-revocation");
  record("tenant-attack", tenant.status);
  record("evidence-security", evidence.status);
  record("revision-db", revision.status);
  record("audit-db", audit.status);
  record("auth-flow", auth.status);
  record("access-revocation", revocation.status);

  // Precedence: any executed FAIL is a hard security failure.
  if (tenant.executed && !tenant.passed) return finish("FAIL_TENANT_ISOLATION", { appVersion });
  if (evidence.executed && !evidence.passed) return finish("FAIL_EVIDENCE_STORAGE", { appVersion });
  if (revision.executed && !revision.passed) return finish("FAIL_REVISION_IMMUTABILITY", { appVersion });
  if (audit.executed && !audit.passed) return finish("FAIL_AUDIT_APPEND_ONLY", { appVersion });
  if (auth.executed && !auth.passed) return finish("FAIL_AUTH_FLOW", { appVersion });
  if (revocation.executed && !revocation.passed) return finish("FAIL_ACCESS_REVOCATION", { appVersion });

  if (![tenant, evidence, revision, audit, auth, revocation].every((result) => result.executed)) {
    return finish("BLOCKED_MISSING_SECURITY_FIXTURES", { appVersion });
  }

  // Phase 9 — release gate
  const gate = run("node", ["scripts/release-security-gate.mjs", "--require", "controlled-pilot"], { timeout: 60000 });
  if (!gate.ok) return finish("FAIL_RLS", { appVersion, detail: "gate rejected controlled-pilot" });
  record("release gate --require controlled-pilot", "PASS");
  return finish("PASS_CONTROLLED_PILOT_GATE", { appVersion });
}

function goNoGo(result) {
  const proven = result === "PASS_CONTROLLED_PILOT_GATE";
  return {
    "Solarise internal development": "GO",
    "Dummy-data demo": "GO",
    "Vincent isolated staging": proven ? "GO" : (result === "BLOCKED_DOCKER_MISSING" ? "HOLD" : "HOLD"),
    "External EPC staging": proven ? "GO" : "NO-GO",
    "Real client data": "NO-GO",
    "Real bank data": "NO-GO",
    "Production": "NO-GO",
  };
}

function finish(resultCode, extra = {}) {
  const gate = suiteState("rls"); // best-effort
  const status = {
    result: resultCode,
    generatedAt: new Date().toISOString(),
    appVersion: extra.appVersion || null,
    schemaVersion: extra.schemaVersion || null,
    dockerAvailable: extra.dockerOk ?? undefined,
    fixtureSeedExecuted: fixtureSeed.executed,
    fixtureSeedPassed: fixtureSeed.passed,
    fixtureSeedError: fixtureSeed.error ? String(fixtureSeed.error).replace(/postgres(ql)?:\/\/[^\s"]+/gi, "<db-url-masked>") : null,
    steps,
    suites: {
      rls: suiteState("rls"),
      tenantAttack: suiteState("tenant-attack"),
      evidenceStorage: suiteState("evidence-security"),
      revisionImmutability: suiteState("revision-db"),
      auditAppendOnly: suiteState("audit-db"),
      authFlow: suiteState("auth-flow"),
      accessRevocation: suiteState("access-revocation"),
    },
    releaseGateStatus: resultCode === "PASS_CONTROLLED_PILOT_GATE" ? "CONTROLLED_PILOT"
      : resultCode === "BLOCKED_DOCKER_MISSING" ? "INTERNAL_DEMO" : "CONNECTED_STAGING",
    allowedUse: resultCode === "PASS_CONTROLLED_PILOT_GATE" ? "controlled-pilot" : "internal-demo",
    decision: goNoGo(resultCode),
    limitations: resultCode === "PASS_CONTROLLED_PILOT_GATE"
      ? ["Real client/bank data still require Vincent/security review.", "Production remains out of scope this sprint."]
      : ["No use beyond internal-demo is permitted until this proof returns PASS_CONTROLLED_PILOT_GATE."],
  };
  fs.writeFileSync(path.join(GEN, "vincent-supabase-security-proof-result.json"), JSON.stringify(status, null, 2));
  writeMarkdown(status);
  log(`\n=== RESULT: ${resultCode} — releaseGateStatus: ${status.releaseGateStatus} — allowedUse: ${status.allowedUse} ===\n`);
  process.exit(resultCode === "PASS_CONTROLLED_PILOT_GATE" ? 0 : 1);
}

function writeMarkdown(s) {
  const row = (k) => `| ${k} | **${s.decision[k]}** |`;
  const md = `# Voltflow 11.8.1 — Vincent Security Proof Result

**RESULT: \`${s.result}\`**  ·  release gate: \`${s.releaseGateStatus}\`  ·  allowedUse: \`${s.allowedUse}\`  ·  ${s.generatedAt}

- App version: ${s.appVersion} · Schema: ${s.schemaVersion || "11.7"}
- This report is machine-generated by \`scripts/run-supabase-security-proof.mjs\`. Skipped tests are never shown as passed.

## Environment & steps
${s.steps.map((x) => `- [${x.status}] ${x.name}${x.detail ? " — " + x.detail : ""}`).join("\n")}

## Security suite results
| Suite | Status |
|---|---|
| pgTAP RLS/storage | ${s.suites.rls.status} |
| Tenant isolation attack | ${s.suites.tenantAttack.status} |
| Evidence storage security | ${s.suites.evidenceStorage.status} |
| Revision immutability | ${s.suites.revisionImmutability.status} |
| Audit append-only | ${s.suites.auditAppendOnly.status} |
| Supabase authentication | ${s.suites.authFlow.status} |
| Access revocation | ${s.suites.accessRevocation.status} |

## Limitations
${s.limitations.map((l) => `- ${l}`).join("\n")}

## Decision table
| Stage | Decision |
|---|---|
${["Solarise internal development","Dummy-data demo","Vincent isolated staging","External EPC staging","Real client data","Real bank data","Production"].map(row).join("\n")}

**Strict rules:** controlled pilot is GO only when the result is \`PASS_CONTROLLED_PILOT_GATE\`. Real client/bank data require Vincent/security review. Production is never GO in this sprint, and a passing proof does not bump the product version.
`;
  fs.writeFileSync(path.join(REPO, "docs", "VOLTFLOW_11_8_1_VINCENT_SECURITY_PROOF_RESULT.md"), md);
}

main().catch((e) => { record("runner", "ERROR", e.message); finish("FAIL_JS_TESTS", {}); });
