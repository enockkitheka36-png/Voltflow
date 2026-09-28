import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${error.message}`);
    failed += 1;
  }
}

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = readFileSync(new URL("../package-lock.json", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const pdfSource = [
  readFileSync(new URL("../src/utils/pdfGenerator.js", import.meta.url), "utf8"),
  readFileSync(new URL("../src/utils/reportPdf.js", import.meta.url), "utf8"),
].join("\n");
const trustRls = readFileSync(new URL("../supabase/tests/trust_foundation_rls.sql", import.meta.url), "utf8");
const commercialRls = readFileSync(new URL("../supabase/tests/commercial_correctness_rls.sql", import.meta.url), "utf8");
const releaseGateSource = readFileSync(new URL("./release-security-gate.mjs", import.meta.url), "utf8");
const revocationMigration = readFileSync(new URL("../supabase/migrations/202609230001_access_revocation.sql", import.meta.url), "utf8");

console.log("\nVoltflow 11.8 - Release Gate Regression\n");

await test("1. Security-patched direct dependency floors are locked", () => {
  assert.equal(packageJson.dependencies.jspdf, "^4.2.1");
  assert.match(packageJson.dependencies.xlsx, /xlsx-0\.20\.3\.tgz$/);
  assert.equal(packageJson.devDependencies.vite, "^8.2.1");
  assert.equal(packageJson.devDependencies["@vitejs/plugin-react"], "^6.0.5");
  assert.match(packageLock, /jspdf-4\.2\.1\.tgz/);
  assert.match(packageLock, /xlsx-0\.20\.3\.tgz/);
});

await test("2. jsPDF 4 produces a valid PDF without vulnerable optional APIs", () => {
  const document = new jsPDF();
  document.text("Voltflow release gate", 10, 10);
  const bytes = new Uint8Array(document.output("arraybuffer"));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.ok(bytes.byteLength > 500);
  assert.doesNotMatch(pdfSource, /\.addJS\s*\(|AcroForm|\.loadFile\s*\(/);
});

await test("3. SheetJS 0.20.3 writes and reads a bounded workbook", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["timestamp", "kW"], ["2026-08-10T10:00:00Z", 5.5]]), "Energy");
  const serialized = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const restored = XLSX.read(serialized, { type: "buffer", sheetRows: 100002 });
  const rows = XLSX.utils.sheet_to_json(restored.Sheets.Energy, { header: 1 });
  assert.deepEqual(rows, [["timestamp", "kW"], ["2026-08-10T10:00:00Z", 5.5]]);
});

await test("4. PDF and spreadsheet code stay outside the initial application path", () => {
  assert.doesNotMatch(appSource, /^import .*pdfGenerator\.js/m);
  assert.doesNotMatch(appSource, /^import .*reportPdf\.js/m);
  assert.match(appSource, /await import\("\.\/utils\/pdfGenerator\.js"\)/);
  assert.match(appSource, /await import\("\.\/utils\/reportPdf\.js"\)/);
  assert.match(appSource, /await import\("xlsx"\)/);
});

await test("5. Energy imports are bounded before workbook parsing", () => {
  assert.match(appSource, /MAX_ENERGY_IMPORT_BYTES = 10 \* 1024 \* 1024/);
  assert.match(appSource, /MAX_ENERGY_IMPORT_ROWS = 100000/);
  assert.match(appSource, /file\.size > MAX_ENERGY_IMPORT_BYTES/);
  assert.match(appSource, /sheetRows: MAX_ENERGY_IMPORT_ROWS \+ 2/);
});

await test("6. Both tenant-security suites remain present for executable staging", () => {
  assert.match(trustRls, /select plan\(19\)/i);
  assert.match(commercialRls, /select plan\(25\)/i);
  assert.match(`${trustRls}\n${commercialRls}`, /cross[-_ ]tenant/i);
});

await test("7. Release class cannot exceed controlled pilot without fresh connected security proof", () => {
  assert.match(releaseGateSource, /releaseGateStatus/);
  assert.match(releaseGateSource, /"INTERNAL_DEMO"/);
  assert.match(releaseGateSource, /"CONNECTED_STAGING"/);
  assert.match(releaseGateSource, /"CONTROLLED_PILOT"/);
  assert.match(releaseGateSource, /rls\.reachable && allExecuted && allPassed && allFresh/);
  assert.doesNotMatch(releaseGateSource, /releaseGateStatus\s*=\s*"PRODUCTION"/);
});

await test("8. Manager-only membership revocation removes project assignments and shares", () => {
  assert.match(revocationMigration, /vf_assert_role[\s\S]*'manager'/);
  assert.match(revocationMigration, /status = 'revoked'/);
  assert.match(revocationMigration, /update public\.project_members/);
  assert.match(revocationMigration, /update public\.project_shares/);
  assert.match(revocationMigration, /membership\.revoked/);
  assert.match(revocationMigration, /grant execute[\s\S]*to authenticated/);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
