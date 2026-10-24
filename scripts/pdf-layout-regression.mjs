import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { openSizingAuditRuntime } from "./lib/sizingAuditRuntime.mjs";
import { buildQuotationPDF } from "../src/utils/pdfGenerator.js";
import { buildReport } from "../src/utils/reportBuilder.js";
import { renderReportPdf } from "../src/utils/reportPdf.js";

const runtime = await openSizingAuditRuntime();
let passed = 0;
const results = [];
const check = async (name, run) => { await run(); passed++; results.push({ name, status: "PASS" }); console.log(`PASS: ${name}`); };
const pageCommands = (document) => document.internal.pages.slice(1).map((page) => page.join("\n"));
const textCommands = (document) => document.internal.pages.slice(1).flatMap((page) => page.filter((command) => /\bBT\b/.test(command)));
const textPosition = (command) => {
  const match = command.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Td/);
  return match ? { horizontal: Number(match[1]), vertical: Number(match[2]) } : null;
};
const withinPage = (document) => {
  const width = document.internal.pageSize.getWidth() * document.internal.scaleFactor;
  const height = document.internal.pageSize.getHeight() * document.internal.scaleFactor;
  for (const command of textCommands(document)) {
    const position = textPosition(command);
    if (!position) continue;
    assert.ok(position.horizontal >= 0 && position.horizontal <= width, `Text horizontal origin stays on page: ${JSON.stringify(position)}`);
    assert.ok(position.vertical >= 20 && position.vertical <= height - 20, `Text vertical origin stays inside page margins: ${JSON.stringify(position)}`);
  }
};

try {
  const project = { ...runtime.defaults, systemType: "Solar PV – Hybrid", phase: "Single phase", monthlyBill: 5280, client: "SYNTHETIC PDF layout QA", location: "Synthetic test location - not surveyed", projectRef: { reference: "SYNTHETIC-LAUNCH-PDF" } };
  const loads = [{ id: "synthetic-layout", name: "Synthetic load", qty: 1, watts: 1000, dayHours: 6, nightHours: 2, critical: true, surge: 1 }];
  const sizing = runtime.size(project, loads);
  const directory = new URL("../qa/pdf-layout/", import.meta.url);
  await mkdir(directory, { recursive: true });
  let ordinary;
  let stress;

  await check("Quotation generation retains finite values and actual sizing total", () => {
    ordinary = buildQuotationPDF(project, sizing, loads);
    assert.equal(/NaN|Infinity/.test(ordinary.output()), false, "Quotation contains no invalid numeric strings");
    const total = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(sizing.totalCost);
    assert.ok(ordinary.output().includes(total));
    withinPage(ordinary);
  });

  await check("Unrecovered investment is labelled honestly, not Infinity years", () => {
    const document = buildQuotationPDF(project, { ...sizing, payback: Infinity }, loads);
    assert.ok(document.output().includes("Not reached"));
    assert.equal(document.output().includes("Infinity"), false);
  });

  await check("Long project metadata and wrapped warnings paginate without off-page text", () => {
    const longProject = { ...project, client: "SYNTHETIC regional solar delivery customer ".repeat(4), location: "SYNTHETIC site location with several buildings and an unverified survey address ".repeat(3), preparedBy: "SYNTHETIC multidisciplinary review team ".repeat(3) };
    const longSizing = { ...sizing, warnings: Array.from({ length: 40 }, (unused, index) => `Synthetic review item ${index + 1}: confirm hardware, protection coordination, site facts and installation constraints before any final issue. ${"This is a synthetic wrapping test. ".repeat(3)}`) };
    stress = buildQuotationPDF(longProject, longSizing, loads);
    assert.ok(stress.getNumberOfPages() >= 3);
    assert.ok(stress.output().includes("Synthetic review item 40"));
    withinPage(stress);
  });

  await check("Every continuation page repeats one stable quotation reference", () => {
    for (const page of pageCommands(stress)) assert.ok(page.includes("Ref: SYNTHETIC-LAUNCH-PDF"));
  });

  await check("Every continuation page places its title at the same safe height", () => {
    const headers = textCommands(stress).filter((command) => command.includes("(SOLARISE PRO)"));
    assert.equal(headers.length, stress.getNumberOfPages());
    const positions = headers.map(textPosition);
    assert.ok(positions.every((position) => Math.abs(position.vertical - positions[0].vertical) < 0.01));
  });

  await check("Long prepared-by signatures wrap before the client acceptance column", () => {
    const signatureLines = textCommands(stress).filter((command) => command.includes("SYNTHETIC multidisciplinary") && Math.abs(textPosition(command)?.horizontal / stress.internal.scaleFactor - 15) < 0.01);
    assert.ok(signatureLines.length >= 2);
    stress.setFont("Helvetica", "normal");
    stress.setFontSize(8);
    for (const command of signatureLines) {
      const value = command.match(/\(([^()]*)\)\s*Tj/)[1];
      assert.ok(stress.getTextWidth(value) <= 90, "Prepared-by text stays inside its signature column");
    }
    withinPage(stress);
  });

  await check("Warning headings use supported text instead of an emoji glyph", () => {
    const output = stress.output();
    assert.ok(output.includes("ENGINEERING COMPLIANCE & SAFETY WARNINGS:"));
    assert.doesNotMatch(output, /⚠|\uFE0F/);
  });

  await check("Long equipment descriptions do not force quantity or pricing columns off page", () => {
    const longSizing = { ...sizing, equipment: { models: { panel: "SYNTHETIC documented module description ".repeat(5) } } };
    const document = buildQuotationPDF(project, longSizing, loads);
    withinPage(document);
    assert.ok(document.output().includes("SYNTHETIC documented"));
  });

  for (const systemType of ["EV charging", "Mini-grid", "Genset hybrid", "Off-grid"]) {
    await check(`${systemType}: supported quotation branch generates without a runtime error`, () => {
      const systemProject = { ...project, systemType };
      const systemSizing = runtime.size(systemProject, loads);
      const document = buildQuotationPDF(systemProject, systemSizing, loads);
      assert.equal(/NaN|Infinity/.test(document.output()), false, "Quotation contains no invalid numeric strings");
      withinPage(document);
    });
  }

  for (const mode of ["client", "engineer", "technician", "lender"]) {
    await check(`${mode}: long customer metadata renders within page bounds`, async () => {
      const report = buildReport(mode, { project: { ...project, client: "SYNTHETIC long customer name ".repeat(6), borehole: { enabled: false } }, sizing, readiness: {} });
      const document = renderReportPdf(report);
      withinPage(document);
      await writeFile(new URL(`synthetic-${mode}.pdf`, directory), Buffer.from(document.output("arraybuffer")));
    });
  }

  await writeFile(new URL("synthetic-quotation.pdf", directory), Buffer.from(ordinary.output("arraybuffer")));
  await writeFile(new URL("synthetic-stress-quotation.pdf", directory), Buffer.from(stress.output("arraybuffer")));
  await writeFile(new URL("../qa/pdf-layout-results.json", import.meta.url), JSON.stringify(results, null, 2));
  console.log(`\n${passed} PDF layout checks; 0 failing. Page-origin checks complement, not replace, rendered-page inspection.`);
} finally {
  await runtime.close();
}
