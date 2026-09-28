/**
 * security-pilot-regression.mjs — Voltflow 11.7.1 (bank pilot security posture)
 * Run: node scripts/security-pilot-regression.mjs   (npm run test:security)
 *
 * Guards the pilot-safety promises: data warning visible, no env-var name in the
 * client-facing assistant fallback, no secrets in the export bundle, env hygiene.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { exportProjectJson } from "../src/utils/projectStorage.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log("  PASS: " + name); passed++; } catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; } }
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const app = read("../src/App.jsx");

console.log(`\n${APP_VERSION} — Security Pilot Regression\n`);

test("7. Data / storage warning is visible (banner + bank flow)", () => {
  assert.ok(/Controlled Bank Pilot Build/i.test(app), "classification banner present");
  assert.ok(/stored locally in this browser/i.test(app), "browser-only storage warning present");
  assert.ok(/Controlled pilot — please read|controlled bank-pilot build/i.test(app), "bank-flow data notice present");
});

test("8. Assistant fallback does NOT expose an env-var name to users", () => {
  assert.ok(/not enabled in this environment/i.test(app), "safe generic fallback wording");
  // the client-facing UI must not instruct users to add the env var
  assert.ok(!/add <code>ANTHROPIC_API_KEY<\/code> in Vercel/i.test(app), "no env-var setup text in client UI");
});

test("9. Export bundle contains NO secrets / keys / env", () => {
  const record = { schemaVersion: "11.7", appVersion: APP_VERSION, project: { client: "Test", preparedBy: "Me", location: "Nairobi" }, loadItemsV2: [], survey: {}, simulation: {} };
  const out = exportProjectJson(record);
  const json = (out && out.jsonString) || JSON.stringify(out);
  assert.ok(!/ANTHROPIC|api[_-]?key|secret|process\.env|BEGIN [A-Z ]*PRIVATE KEY/i.test(json), "no secret markers in export");
  assert.ok(/"client"\s*:\s*"Test"/.test(json), "export still carries project data");
});

test("Server keeps the key server-side (api/assistant.js), never bundled", () => {
  const api = read("../api/assistant.js");
  assert.ok(/process\.env\.ANTHROPIC_API_KEY/.test(api), "key read from server env");
  assert.ok(/never (returned|logged)|never sent to the browser/i.test(api) || /ONLY here/i.test(api), "documented server-only");
  // frontend must not read the key or use a VITE_ secret
  assert.ok(!/import\.meta\.env\.VITE_[A-Z_]*KEY/i.test(app), "no VITE_ key in the client");
});

test("Env hygiene: .env* ignored, example is placeholder-only", () => {
  const gitignore = read("../.gitignore");
  assert.ok(/\.env\*/.test(gitignore), ".env* is git-ignored");
  const ex = read("../.env.local.example");
  assert.ok(/your_key_here/.test(ex), "example uses a placeholder, not a real key");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
