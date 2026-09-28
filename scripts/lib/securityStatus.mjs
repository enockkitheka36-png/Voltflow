/**
 * securityStatus.mjs — Voltflow 11.8.1 (Runtime Trust Wiring & Proof)
 *
 * Shared helpers for the DB-backed security test scripts and the release gate.
 * The golden rule: a security test that could NOT run must record NOT_EXECUTED,
 * never a silent pass. The release gate treats NOT_EXECUTED as "not proven".
 */
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STATUS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  NOT_EXECUTED: "NOT_EXECUTED",
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const GENERATED_DIR = path.resolve(HERE, "../../docs/generated");

/** Probe a TCP port (default local Supabase Postgres 54322) to see if a DB is up. */
export function probeTcp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => { if (done) return; done = true; try { sock.destroy(); } catch {} resolve(ok); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    sock.connect(port, host);
  });
}

/**
 * Decide whether a live Supabase/Postgres is reachable for DB-backed tests.
 * Honest by default: if nothing is reachable, tests are NOT_EXECUTED.
 */
export async function detectLiveSupabase(env = process.env) {
  const url = env.SUPABASE_TEST_URL || env.VITE_SUPABASE_URL || "";
  // Supabase local default Postgres port
  const pgUp = await probeTcp("127.0.0.1", 54322, 1200);
  const configuredHttpUrl = Boolean(url && /^https?:\/\//i.test(url));
  return {
    reachable: pgUp || configuredHttpUrl,
    localPostgres: pgUp,
    configuredUrlPresent: configuredHttpUrl,
  };
}

/** Write a per-suite result file the release gate will aggregate. */
export function writeSuiteResult(suite, result) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const file = path.join(GENERATED_DIR, `security-${suite}.json`);
  const payload = { suite, ...result, writtenAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

/** Read a suite result if present. */
export function readSuiteResult(suite) {
  const file = path.join(GENERATED_DIR, `security-${suite}.json`);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

/** Standard console + exit for a DB-backed suite that could not run. */
export function reportNotExecuted(suite, reason) {
  const res = { status: STATUS.NOT_EXECUTED, executed: false, passed: false, reason };
  writeSuiteResult(suite, res);
  console.log(`\n[${suite}] STATUS: NOT_EXECUTED`);
  console.log(`  Reason: ${reason}`);
  console.log(`  This is NOT a pass. The release gate will block staging/production.\n`);
  // Exit 0 so it doesn't break `test:all`; the GATE is the enforcement point.
  return res;
}
