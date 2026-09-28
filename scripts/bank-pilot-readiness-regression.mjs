/**
 * bank-pilot-readiness-regression.mjs — Voltflow 11.7.1 (Bank Pilot Mode)
 * Run: node scripts/bank-pilot-readiness-regression.mjs   (npm run test:bank)
 *
 * Bank Pilot Mode is JSX (browser-verified), so here we assert the wiring +
 * the pure routing rules that make the mode simple and safe.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { isTabAllowedInView, BANK_SAFE_TABS, VALID_TABS } from "../src/utils/navigation.js";
import { VIEW_MODES, normalizeViewMode } from "../src/utils/schemaMigration.js";
import { SCENARIOS, buildScenarioProject } from "../src/utils/scenarios.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log("  PASS: " + name); passed++; } catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; } }
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

console.log(`\n${APP_VERSION} — Bank Pilot Readiness Regression\n`);

test("1. Bank Pilot Mode is a real view mode + component + route", () => {
  assert.ok(VIEW_MODES.includes("bank"), "bank view mode registered");
  assert.strictEqual(normalizeViewMode("bank"), "bank");
  assert.ok(/function BankPilotFlow/.test(app), "BankPilotFlow component");
  assert.ok(/active === "bank-flow"/.test(app), "bank-flow route");
  assert.ok(/btn\("bank-flow"/.test(app), "bank nav entry");
});

test("2. Bank flow shows only the simplified steps (guided)", () => {
  assert.ok(/Start bank lead/i.test(app), "step 1");
  assert.ok(/Choose a standard package/i.test(app), "package step");
  assert.ok(/Mark ready locally/i.test(app), "local ready step");
  assert.ok(/Solarise has not received this automatically/i.test(app), "local-only status is explicit");
  assert.ok(/Quote summary/i.test(app), "quote summary");
});

test("3. Standard package selector + quote variants render (Good/Better/Best)", () => {
  assert.ok(/SCENARIOS\.filter\(\(s\) => s\.id !== "custom"\)/.test(app), "bank uses Good/Better/Best (no custom)");
  const ids = SCENARIOS.filter((s) => s.id !== "custom").map((s) => s.id);
  assert.deepStrictEqual(ids, ["good", "better", "best"]);
  const opt = buildScenarioProject({ solarCoverage: 0.8, backupHours: 8 }, "good");
  assert.ok(opt.solarCoverage < 0.8, "variant adjusts sizing inputs");
});

test("4. Bank view HIDES the engineering workspace", () => {
  ["inverter", "eng-compliance", "generation", "battery", "loads", "studio", "assets-lib"].forEach((t) =>
    assert.strictEqual(isTabAllowedInView(t, "bank"), false, `${t} hidden in bank view`));
});

test("5. Bank view HIDES procurement / margins (BoQ, accessories)", () => {
  ["boq", "accessories", "finance", "carbon"].forEach((t) =>
    assert.strictEqual(isTabAllowedInView(t, "bank"), false, `${t} hidden in bank view`));
});

test("6. Bank view SHOWS only the safe guided surfaces", () => {
  ["bank-flow", "field-dashboard", "proposal", "storage"].forEach((t) =>
    assert.strictEqual(isTabAllowedInView(t, "bank"), true, `${t} allowed in bank view`));
  [...BANK_SAFE_TABS].forEach((t) => assert.ok(VALID_TABS.has(t), `${t} is a real tab`));
});

test("10. Engineer / Client / Technician views still route correctly", () => {
  assert.strictEqual(isTabAllowedInView("inverter", "engineer"), true);
  assert.strictEqual(isTabAllowedInView("eng-compliance", "client"), false);
  assert.strictEqual(isTabAllowedInView("loads", "technician"), true);
  assert.strictEqual(isTabAllowedInView("proposal", "client"), true);
});

test("11-14. Studio / Borehole / Proposal / Save-Load still present (not removed)", () => {
  assert.ok(/function VoltflowStudio/.test(app), "Studio present");
  assert.ok(/function SolarBorehole/.test(app), "Borehole present");
  assert.ok(/function Proposal\(/.test(app), "Proposal present");
  assert.ok(/exportProjectJson|importProjectJson/.test(app), "Save/Load export wired");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
