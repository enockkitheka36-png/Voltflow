/**
 * proposal-pdf-regression.mjs — Voltflow 11.6 (Proposal + PDF)
 * Run: node scripts/proposal-pdf-regression.mjs   (npm run test:proposal)
 *
 * Source-level guarantees for the proposal + PDF surface: readiness gate, safe
 * disclaimers, borehole section, DC:AC coherence caution and PDF generators.
 * The rendered PDF/preview is browser-verified.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { computeDcAcAnalysis } from "../src/utils/inverterCoherence.js";
import { summarizeBoreholeForProposal, computeBorehole } from "../src/utils/boreholeEngine.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

console.log(`\n${APP_VERSION} — Proposal + PDF Regression\n`);

test("1. Proposal keeps the feasibility disclaimer (not certified engineering)", () => {
  assert.ok(/feasibility quotation and proposal support document/i.test(app));
  assert.ok(/qualified review/i.test(app));
});

test("2. Proposal gate warns on critical blockers before PDF (11.5.2 retained)", () => {
  assert.ok(/ProposalGateModal/.test(app), "gate modal present");
  assert.ok(/Review first|Continue anyway/i.test(app), "gate offers review/continue");
});

test("3. PDF generators are wired (quotation + full report)", () => {
  assert.ok(/generateQuotationPDF/.test(app) && /generateFullPDF/.test(app));
  assert.ok(/runPdf\(/.test(app), "PDF buttons go through the gated runPdf");
});

test("4. Proposal includes the Solar Borehole section when enabled", () => {
  assert.ok(/summarizeBoreholeForProposal/.test(app));
  const prop = summarizeBoreholeForProposal(
    { enabled: true, useCase: "irrigation", dailyWaterDemandLitres: 20000 },
    computeBorehole({ enabled: true, dailyWaterDemandLitres: 20000, boreholeYieldLitresPerHour: 5000 }, {})
  );
  assert.ok(/litres per day/i.test(prop.headline), "headline sells litres/day");
  assert.ok(/confirmed against the actual borehole test report/i.test(prop.headline), "requires test-report confirmation");
});

test("5. Low DC:AC produces a proposal-worthy caution string", () => {
  const dc = computeDcAcAnalysis({ actualKwp: 4.2, inverterKw: 12, panelW: 600 });
  assert.ok(dc.isLow && dc.severity === "high");
  assert.ok(/load\/backup|smaller inverter|increase the PV/i.test(dc.explanation), "explains the low-ratio caution");
});

test("6. Proposal carries the central readiness + warnings block (11.5.2 retained)", () => {
  assert.ok(/Unresolved before final issue|criticalIssues/.test(app), "readiness warnings block present");
});

test("7. Night-load caution flows to the proposal when relevant", () => {
  assert.ok(/nightAutonomyWarning|night-load|Night-load/i.test(app), "night caution wired in proposal/advisor");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
