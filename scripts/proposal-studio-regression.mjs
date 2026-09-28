/**
 * proposal-studio-regression.mjs — Voltflow 11.7 (Studio: Proposal Studio)
 * Run: node scripts/proposal-studio-regression.mjs   (npm run test:proposal-studio)
 */
import assert from "node:assert";
import { PROPOSAL_SECTIONS, PROPOSAL_STUDIO_MODES, createDefaultProposalStudioConfig, normalizeProposalStudioConfig, reorderSection, toggleSection, setProposalMode, enabledSectionIds } from "../src/utils/proposalStudio.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log("  PASS: " + name); passed++; } catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; } }

console.log(`\n${APP_VERSION} — Proposal Studio Regression\n`);

test("1. Default config exposes the 17 sections + 4 modes", () => {
  assert.strictEqual(PROPOSAL_SECTIONS.length, 17);
  assert.deepStrictEqual(PROPOSAL_STUDIO_MODES.map((m) => m.id), ["client", "engineer", "technician", "lender"]);
  const c = createDefaultProposalStudioConfig();
  assert.strictEqual(c.sections.length, 17);
  assert.strictEqual(c.mode, "client");
  assert.ok(c.sections.find((s) => s.id === "cover").enabled);
});

test("11. Sections can be reordered", () => {
  const c = createDefaultProposalStudioConfig();
  const firstId = c.sections[0].id, secondId = c.sections[1].id;
  const moved = reorderSection(c, secondId, "up");
  assert.strictEqual(moved.sections[0].id, secondId, "second moved to first");
  assert.strictEqual(moved.sections[1].id, firstId);
  // no-op at the boundary
  assert.strictEqual(reorderSection(c, firstId, "up").sections[0].id, firstId);
});

test("11b. Sections can be toggled on/off + mode set", () => {
  let c = createDefaultProposalStudioConfig();
  c = toggleSection(c, "cover");
  assert.strictEqual(c.sections.find((s) => s.id === "cover").enabled, false);
  c = setProposalMode(c, "lender");
  assert.strictEqual(c.mode, "lender");
  assert.strictEqual(setProposalMode(c, "bogus").mode, "lender", "invalid mode ignored");
});

test("12. Config saves/exports/imports safely (normalize repairs + migrates)", () => {
  // round-trip through JSON
  let c = createDefaultProposalStudioConfig();
  c = reorderSection(c, c.sections[3].id, "up");
  c = toggleSection(c, "photos");
  const round = normalizeProposalStudioConfig(JSON.parse(JSON.stringify(c)));
  assert.deepStrictEqual(round.sections.map((s) => s.id), c.sections.map((s) => s.id), "order preserved");
  // bad input → default; missing sections appended
  const repaired = normalizeProposalStudioConfig({ mode: "x", sections: [{ id: "cover", enabled: true }, { id: "ghost" }] });
  assert.strictEqual(repaired.mode, "client");
  assert.strictEqual(repaired.sections.length, 17, "unknown dropped, missing appended");
  assert.strictEqual(repaired.sections[0].id, "cover", "known saved order kept first");
});

test("12b. enabledSectionIds returns the ordered export structure", () => {
  const c = toggleSection(createDefaultProposalStudioConfig(), "cover");
  const ids = enabledSectionIds(c);
  assert.ok(!ids.includes("cover"), "disabled excluded");
  assert.ok(ids.includes("recommendedSolution"));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
