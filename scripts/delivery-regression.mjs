/**
 * delivery-regression.mjs — Voltflow Delivery (EPC project management layer)
 * Run: node scripts/delivery-regression.mjs   (npm run test:delivery)
 *
 * Imports the real deliveryEngine + storage modules. UI rendering (tabs,
 * board, checklist screens) is verified in the browser — see the testing guide.
 */
import assert from "node:assert";

import {
  PROJECT_STAGES, STAGE_BOARD_COLUMNS, APPROVAL_GATES, INSTALLATION_CHECKLIST_ITEMS,
  TASK_CATEGORIES, PROCUREMENT_STATUSES,
  createDefaultDelivery, normalizeDelivery, getStageProgress, getChecklistProgress,
  generateDefaultTasks, generateProcurementFromBoq, mergeProcurement, summarizeDelivery,
  getBlockedItems, getNextActions, getStageGateWarnings, getProjectReadinessForStage,
  createTask, createIssue, getBoardColumn, getClientTimeline, getClientVisibleIssues,
  buildProcurementExportRows, procurementRowsToCsv,
} from "../src/utils/deliveryEngine.js";
import { importProjectJson, exportProjectJson } from "../src/utils/projectStorage.js";
import { SCHEMA_VERSION, APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}

const sampleProject = { client: "Acme Ltd", location: "Nairobi", systemType: "Solar PV – Hybrid", preparedBy: "PM" };
const sampleSizing = { totalCost: 1200000, dailyKwh: 21, panels: 9, batteryModules: 2, coldVocOk: true };
const sampleBoq = [
  { code: "1.1", item: "PV panels", qty: 9, unit: "panels", unitCost: 23000, category: "PV" },
  { code: "2.1", item: "Hybrid inverter", qty: 1, unit: "unit", unitCost: 180000, category: "Inverter" },
  { code: "3.1", item: "Battery modules", qty: 2, unit: "units", unitCost: 145000, category: "Battery" },
];

console.log(`\nVoltflow Delivery — Regression (${APP_VERSION})\n`);

test("1. Old project without delivery normalizes safely", () => {
  const d = normalizeDelivery(undefined, sampleProject);
  assert.strictEqual(d.stage, "lead");
  assert.ok(Array.isArray(d.tasks) && Array.isArray(d.procurementItems) && Array.isArray(d.issues));
  assert.strictEqual(d.installationChecklist.length, INSTALLATION_CHECKLIST_ITEMS.length);
  assert.strictEqual(Object.keys(d.approvals).length, APPROVAL_GATES.length);
  // garbage in must not throw either
  assert.doesNotThrow(() => normalizeDelivery({ stage: "not_a_stage", tasks: "nope", approvals: 42 }, sampleProject));
  const junk = normalizeDelivery({ stage: "not_a_stage", tasks: "nope", issues: null }, sampleProject);
  assert.strictEqual(junk.stage, "lead");
  assert.deepStrictEqual(junk.tasks, []);
});

test("2. Default delivery generated with stages, tasks and approvals", () => {
  const d = createDefaultDelivery(sampleProject, sampleSizing, sampleBoq);
  assert.strictEqual(d.stage, "lead");
  assert.strictEqual(d.projectValue, 1200000);
  assert.strictEqual(d.owner, "PM");
  assert.ok(d.tasks.length > 10, `expected a real starter task list, got ${d.tasks.length}`);
  assert.strictEqual(d.procurementItems.length, 3);
  assert.strictEqual(PROJECT_STAGES.length, 15);
  assert.strictEqual(STAGE_BOARD_COLUMNS.length, 7);
});

test("3. Stage progress calculates correctly", () => {
  assert.strictEqual(getStageProgress({ stage: "lead" }).percent, 0);
  const mid = getStageProgress({ stage: "procurement" });
  assert.ok(mid.percent > 0 && mid.percent < 100, `mid-stage percent out of range: ${mid.percent}`);
  assert.strictEqual(getStageProgress({ stage: "om_monitoring" }).percent, 100);
  const lost = getStageProgress({ stage: "lost" });
  assert.strictEqual(lost.terminal, true);
  assert.strictEqual(getStageProgress({ stage: "survey_done" }).group, "Survey");
});

test("4. Default tasks generate and adapt to system type", () => {
  const base = generateDefaultTasks({ systemType: "Solar PV – Hybrid" });
  assert.ok(base.every((t) => TASK_CATEGORIES.includes(t.category)));
  assert.ok(base.some((t) => t.category === "survey") && base.some((t) => t.category === "commissioning"));

  const genset = generateDefaultTasks({ systemType: "Genset hybrid" });
  assert.ok(genset.some((t) => /ATS|genset/i.test(t.title)), "genset projects need genset-specific tasks");
  const ev = generateDefaultTasks({ systemType: "EV charging" });
  assert.ok(ev.some((t) => /OCPP|charger/i.test(t.title)), "EV projects need charger tasks");
  const blueprint = generateDefaultTasks({ systemType: "Solar PV – Hybrid", sizingMode: "blueprint_new_build" });
  assert.ok(blueprint.some((t) => /equipment schedule|MEP/i.test(t.title)), "blueprint projects need schedule tasks");
});

test("5. Procurement list generates from BoQ and merges without losing edits", () => {
  const gen = generateProcurementFromBoq(sampleBoq);
  assert.strictEqual(gen.length, 3);
  assert.strictEqual(gen[0].requiredQty, 9);
  assert.strictEqual(gen[0].linkedBoqItem, "1.1");
  assert.strictEqual(gen[0].status, "needed");
  // zero-qty lines are skipped
  assert.strictEqual(generateProcurementFromBoq([{ code: "x", item: "Nothing", qty: 0 }]).length, 0);

  // A manually edited row must survive regeneration
  const edited = gen.map((g) => g.linkedBoqItem === "1.1" ? { ...g, supplier: "Local supplier", unitCost: 25000, manuallyEdited: true } : g);
  const changedBoq = sampleBoq.map((b) => b.code === "1.1" ? { ...b, qty: 12, unitCost: 21000 } : b);
  const merged = mergeProcurement(edited, generateProcurementFromBoq(changedBoq));
  const panels = merged.items.find((i) => i.linkedBoqItem === "1.1");
  assert.strictEqual(panels.unitCost, 25000, "manual cost edit must NOT be overwritten");
  assert.strictEqual(panels.supplier, "Local supplier");
  assert.strictEqual(merged.kept, 1);
  assert.strictEqual(merged.refreshed, 2, "untouched rows should refresh from the BoQ");
});

test("6. Task can be marked done and summary reflects it", () => {
  const d = createDefaultDelivery(sampleProject, sampleSizing, []);
  d.tasks = [createTask({ title: "A" }), createTask({ title: "B" })];
  assert.strictEqual(summarizeDelivery(d).tasks.done, 0);
  d.tasks[0].status = "done";
  const s = summarizeDelivery(d);
  assert.strictEqual(s.tasks.done, 1);
  assert.strictEqual(s.tasks.todo, 1);
  assert.strictEqual(s.tasks.percentComplete, 50);
});

test("7. Issue can be created and resolved", () => {
  const d = createDefaultDelivery(sampleProject, sampleSizing, []);
  d.issues = [createIssue({ title: "Roof leak near penetration", severity: "high" })];
  assert.strictEqual(summarizeDelivery(d).issues.open, 1);
  d.issues[0].status = "resolved";
  d.issues[0].resolvedAt = new Date().toISOString();
  const s = summarizeDelivery(d);
  assert.strictEqual(s.issues.open, 0);
  assert.strictEqual(s.issues.resolved, 1);
});

test("8. Blocker appears when an issue is critical and open", () => {
  const d = createDefaultDelivery(sampleProject, sampleSizing, []);
  d.tasks = [];
  d.issues = [createIssue({ title: "Inverter DOA", severity: "critical", status: "open" })];
  const blockers = getBlockedItems(d);
  assert.ok(blockers.some((b) => b.type === "issue" && b.severity === "critical"), "critical open issue must block");
  d.issues[0].status = "resolved";
  assert.ok(!getBlockedItems(d).some((b) => b.type === "issue"), "resolved issues must not block");

  // blocked tasks and overdue tasks also surface
  d.tasks = [createTask({ title: "Blocked thing", status: "blocked" }), createTask({ title: "Late thing", dueDate: "2020-01-01" })];
  const b2 = getBlockedItems(d);
  assert.ok(b2.some((b) => b.type === "task"));
  assert.ok(b2.some((b) => b.type === "overdue"));
});

test("9. Stage gate warns before procurement without client approval", () => {
  const d = createDefaultDelivery(sampleProject, sampleSizing, sampleBoq);
  const w = getStageGateWarnings(d, "procurement");
  assert.ok(w.some((x) => x.level === "danger" && /client approval/i.test(x.msg)), JSON.stringify(w));

  d.approvals.clientApproved.approved = true;
  d.approvals.depositPaid.approved = true;
  assert.strictEqual(getStageGateWarnings(d, "procurement").length, 0, "gate should clear once approvals are recorded");

  // installation before goods received
  const w2 = getStageGateWarnings(d, "installation_scheduled");
  assert.ok(w2.some((x) => /not fully received/i.test(x.msg)), "should warn about outstanding deliveries");

  // handover before checklist complete
  const w3 = getStageGateWarnings(d, "handover_done");
  assert.ok(w3.some((x) => /checklist/i.test(x.msg)), "should warn about incomplete checklist");
});

test("10. Installation checklist progress calculates correctly", () => {
  const d = createDefaultDelivery(sampleProject, sampleSizing, []);
  assert.strictEqual(getChecklistProgress(d).percent, 0);
  assert.strictEqual(getChecklistProgress(d).total, 16);
  d.installationChecklist.forEach((c, i) => { if (i < 8) c.complete = true; });
  assert.strictEqual(getChecklistProgress(d).done, 8);
  assert.strictEqual(getChecklistProgress(d).percent, 50);
  d.installationChecklist.forEach((c) => { c.complete = true; });
  assert.strictEqual(getChecklistProgress(d).percent, 100);
});

test("11. Client view hides internal procurement costs and internal issues", () => {
  const d = createDefaultDelivery(sampleProject, sampleSizing, sampleBoq);
  d.issues = [
    createIssue({ title: "Internal supplier dispute", severity: "high", clientVisible: false }),
    createIssue({ title: "Awaiting client gate key", severity: "medium", clientVisible: true }),
  ];
  const shared = getClientVisibleIssues(d);
  assert.strictEqual(shared.length, 1);
  assert.strictEqual(shared[0].title, "Awaiting client gate key");

  const timeline = getClientTimeline(d);
  assert.ok(timeline.length >= 6);
  assert.ok(timeline.every((m) => !("cost" in m) && !("unitCost" in m)), "client timeline must carry no costs");
  const blob = JSON.stringify(timeline);
  assert.ok(!blob.includes("23000") && !blob.includes("1200000"), "no internal figures in the client timeline");
});

test("12. Technician-relevant data is available (checklist + assigned tasks)", () => {
  const d = createDefaultDelivery(sampleProject, sampleSizing, []);
  assert.strictEqual(d.installationChecklist.length, 16);
  assert.ok(d.installationChecklist.some((c) => /safety briefing/i.test(c.label)));
  assert.ok(d.installationChecklist.some((c) => /earthing/i.test(c.label)));
  assert.ok(d.installationChecklist.some((c) => /handover/i.test(c.label)));
  assert.ok(d.tasks.some((t) => t.category === "installation"), "technicians need installation tasks");
  const phases = [...new Set(d.installationChecklist.map((c) => c.phase))];
  assert.ok(phases.length >= 4, "checklist should be grouped into phases");
});

test("13. Export/import preserves delivery state", () => {
  const delivery = createDefaultDelivery(sampleProject, sampleSizing, sampleBoq);
  delivery.stage = "installation_in_progress";
  delivery.tasks[0].status = "done";
  delivery.issues = [createIssue({ title: "Snag", severity: "low" })];

  const record = {
    schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, name: "Acme",
    project: { ...sampleProject, delivery }, survey: {}, simulation: {}, loadItemsV2: [{ id: 1 }],
  };
  const { jsonString } = exportProjectJson(record);
  const round = importProjectJson(jsonString, { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION });
  assert.ok(round.ok);
  assert.strictEqual(round.summary.hasDelivery, true, "import summary must flag delivery data");
  assert.strictEqual(round.summary.deliveryStage, "installation_in_progress");
  assert.ok(round.summary.deliveryTaskCount > 0);

  const restored = normalizeDelivery(round.record.project.delivery, sampleProject);
  assert.strictEqual(restored.stage, "installation_in_progress");
  assert.strictEqual(restored.tasks.filter((t) => t.status === "done").length, 1);
  assert.strictEqual(restored.issues.length, 1);
});

test("14. Everything degrades safely with no delivery object at all", () => {
  assert.doesNotThrow(() => summarizeDelivery({}));
  assert.doesNotThrow(() => getBlockedItems({}));
  assert.doesNotThrow(() => getNextActions({}, {}, {}));
  assert.doesNotThrow(() => getStageProgress({}));
  assert.doesNotThrow(() => getChecklistProgress({}));
  assert.doesNotThrow(() => getBoardColumn({}));
  assert.doesNotThrow(() => getProjectReadinessForStage({}, {}, {}));
  assert.doesNotThrow(() => getClientTimeline({}));
  const s = summarizeDelivery({});
  assert.strictEqual(s.tasks.total, 0);
  assert.strictEqual(s.checklist.total, 0);
  assert.ok(getNextActions({ stage: "lead" }, sampleProject, sampleSizing).length > 0, "even an empty project gets next actions");
});

test("15. Procurement export produces usable CSV without internal surprises", () => {
  const d = createDefaultDelivery(sampleProject, sampleSizing, sampleBoq);
  const rows = buildProcurementExportRows(d);
  assert.strictEqual(rows.length, 3);
  assert.ok("lineValue" in rows[0] && "supplier" in rows[0]);
  const csv = procurementRowsToCsv(rows);
  assert.ok(csv.split("\n").length === 4, "header + 3 rows");
  assert.ok(csv.startsWith("item,category,requiredQty"));
  // commas in names must be quoted, not break the CSV
  const tricky = procurementRowsToCsv([{ item: "Rail, 4.2m", qty: 1 }]);
  assert.ok(tricky.includes('"Rail, 4.2m"'));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
