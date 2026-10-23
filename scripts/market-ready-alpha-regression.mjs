/**
 * market-ready-alpha-regression.mjs — Voltflow 11.6 (Track A: market-ready alpha)
 * Run: node scripts/market-ready-alpha-regression.mjs   (npm run test:market)
 *
 * Node can't render JSX, so UI polish is verified in the browser. Here we assert
 * the pure routing rules plus source-level guarantees that the P0 market-safety
 * fixes are in place (safe assistant fallback, help dock, view-mode bar, etc.).
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { isTabAllowedInView } from "../src/utils/navigation.js";
import { buildProjectReadiness } from "../src/utils/readinessEngine.js";
import { computeBorehole, createDefaultBorehole } from "../src/utils/boreholeEngine.js";
import { analyzeInverterCoherence } from "../src/utils/inverterCoherence.js";
import { APP_VERSION, SCHEMA_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/components/workspace/WorkspaceHome.jsx", import.meta.url), "utf8");
const uicss = readFileSync(new URL("../src/components/ui.css", import.meta.url), "utf8");
const noBad = (o) => JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;

console.log(`\n${APP_VERSION} — Market-Ready Alpha Regression\n`);

test("0. Version ≥ 11.6 and schema persists borehole (version-agnostic)", () => {
  const appMinor = Number((APP_VERSION.match(/11\.(\d+)/) || [])[1]);
  const schemaMinor = Number((String(SCHEMA_VERSION).match(/11\.(\d+)/) || [])[1]);
  assert.ok(appMinor >= 6, `APP_VERSION ${APP_VERSION} should be ≥ 11.6`);
  assert.ok(schemaMinor >= 6, `SCHEMA_VERSION ${SCHEMA_VERSION} should be ≥ 11.6 (borehole persisted)`);
});

test("1. Clean startup renders the product intro (no auto-loaded demo)", () => {
  assert.ok(/<WorkspaceHome/.test(app), "start screen uses the product home");
  assert.ok(/YOUR SOLAR PROJECT WORKSPACE/.test(home), "start screen intro present");
  assert.ok(/onNewProject/.test(home) && /onDemo/.test(home), "guided setup and labelled demos remain available");
  assert.ok(/const defaultLoads = \[\]/.test(app), "startup loads empty");
});

test("2. No env/API-key name in the client-facing assistant fallback", () => {
  assert.ok(/not enabled in this environment/i.test(app), "safe fallback wording present");
  assert.ok(!/add <code>ANTHROPIC_API_KEY<\/code> in Vercel/.test(app), "env var name removed from client UI");
});

test("3. Floating buttons use the Help dock (no magic offsets that overlap inputs)", () => {
  assert.ok(/vf-help-dock/.test(app), "App uses the help dock");
  assert.ok(/\.vf-help-dock/.test(uicss), "dock CSS exists");
  assert.ok(/max-width:\s*640px/.test(uicss) && /vf-help-label/.test(uicss), "labels collapse on small screens");
});

test("4. View-mode selector has a dedicated readable bar", () => {
  assert.ok(/vf-viewmode-bar/.test(app), "view-mode bar present");
});

test("5. Dashboard is a command centre (readiness ring + Action Center + next actions)", () => {
  assert.ok(/ReadinessDashboard/.test(app) && /ReadinessRing/.test(app), "readiness dashboard + ring");
  assert.ok(/Action Center/.test(app), "action center present");
});

test("6. Client View hides internal technical tabs", () => {
  ["eng-compliance", "inverter", "boq", "generation"].forEach((t) =>
    assert.strictEqual(isTabAllowedInView(t, "client"), false, `${t} hidden in client`));
  assert.strictEqual(isTabAllowedInView("proposal", "client"), true);
});

test("7. Technician View shows practical field tabs incl. Solar Borehole", () => {
  ["loads", "borehole", "delivery", "installer-sim"].forEach((t) =>
    assert.strictEqual(isTabAllowedInView(t, "technician"), true, `${t} technician-safe`));
});

test("8. Engineer View exposes a Technical Basis explanation", () => {
  assert.ok(/Technical basis/i.test(app), "technical basis card present");
});

test("9. Import/export still available (projectStorage)", () => {
  const ps = readFileSync(new URL("../src/utils/projectStorage.js", import.meta.url), "utf8");
  assert.ok(/export function exportProjectJson/.test(ps));
  assert.ok(/export function importProjectJson/.test(ps));
});

test("10. No NaN/Infinity across readiness + borehole + coherence (blank inputs)", () => {
  const r = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false, computeBorehole(createDefaultBorehole(), {}));
  assert.ok(noBad(r), "readiness finite");
  assert.ok(noBad(computeBorehole(createDefaultBorehole(), {})), "borehole finite");
  assert.ok(noBad(analyzeInverterCoherence({})), "coherence finite");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
