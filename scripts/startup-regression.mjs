/**
 * startup-regression.mjs — Voltflow 11.4.1
 * Run: node scripts/startup-regression.mjs   (npm run test:startup)
 *
 * Guards the clean-startup contract: the app must never boot with a fake
 * client project, while demo data stays available on request and the
 * "Nairobi / Karen" SITE PROFILE remains selectable.
 *
 * UI-only checks (start screen renders, wizard steps, empty states) are
 * verified in the browser — see the testing guide.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";

import {
  createBlankProject, createBlankLoads, isBlankProject, buildProjectFromOnboarding, inferLoadAssessmentMode,
  PROJECT_OBJECTIVES, LOAD_SOURCES, getObjective, getLoadSource, BLANK_PROJECT_IDENTITY,
} from "../src/utils/projectFactory.js";
import {
  DEMO_PROJECTS, DEMO_DISCLAIMER, getDemoProject, createProjectFromDemo, convertDemoToRealProject,
} from "../src/utils/demoProjects.js";
import {
  importProjectJson, saveProjectLocal, rememberLastActiveProject, findLastActiveProject,
  summarizeLocalData, clearLocalProjectData, exportAllLocalData, loadProjectsLocal,
  getLocalProjectRecovery, isSafeModeRequested, PROJECTS_KEY, PROJECTS_QUARANTINE_KEY,
  MAX_LOCAL_PROJECT_BYTES,
} from "../src/utils/projectStorage.js";
import { SCHEMA_VERSION, APP_VERSION, normalizeProjectRef, normalizeLoadItemsV2, migrateLegacyLoadsToV2 } from "../src/utils/schemaMigration.js";
import { createDefaultDelivery, normalizeDelivery } from "../src/utils/deliveryEngine.js";
import { settleFailedDesignRevision } from "../src/utils/designRevision.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const errorBoundarySource = readFileSync(new URL("../src/components/AppErrorBoundary.jsx", import.meta.url), "utf8");
// The engineering baseline as declared in App.jsx (parsed loosely for assertions)
const defaultProjectBlock = appSource.slice(appSource.indexOf("const defaultProject = {"), appSource.indexOf("const evChargerSpecs"));
const defaultLoadsBlock = appSource.slice(appSource.indexOf("const defaultLoads"), appSource.indexOf("const countyToSiteProfile"));

console.log(`\n${APP_VERSION} — Clean Startup Regression\n`);

test("1. Fresh app state does not contain Karen Homeowner", () => {
  assert.ok(!defaultProjectBlock.includes("Karen Homeowner"), "defaultProject must not hardcode the demo client");
  const blank = createBlankProject({ psh: 5.6, panelW: 600 });
  assert.strictEqual(blank.client, "");
  assert.ok(!JSON.stringify(blank).includes("Karen Homeowner"));
});

test("2. Fresh app state does not use Karen, Nairobi as the active project", () => {
  assert.ok(!defaultProjectBlock.includes('location: "Karen, Nairobi"'), "defaultProject must not hardcode the demo location");
  assert.ok(!defaultProjectBlock.includes('siteProfile: "Nairobi / Karen"'), "defaultProject must not preselect a site profile");
  const blank = createBlankProject({});
  assert.strictEqual(blank.location, "");
  assert.strictEqual(blank.siteProfile, "");
  assert.strictEqual(blank.monthlyBill, 0);
  assert.strictEqual(blank.systemType, "");
});

test("3. Nairobi / Karen remains available as a SITE PROFILE option", () => {
  assert.ok(appSource.includes('"Nairobi / Karen": {'), "the Kenya site profile must still exist");
  assert.ok(appSource.includes('Nairobi: "Nairobi / Karen"'), "county→profile mapping must still exist");
});

test("4. Startup starts with an empty load table", () => {
  assert.deepStrictEqual(createBlankLoads(), []);
  assert.ok(/const defaultLoads = \[\]/.test(defaultLoadsBlock), "defaultLoads must be empty on a clean start");
  assert.ok(!defaultLoadsBlock.includes("Kettle / heavy socket"), "sample household loads must not be the startup default");
});

test("5. Start New Project wizard builds a real active project", () => {
  const { project, nextTab } = buildProjectFromOnboarding({ psh: 5.6, panelW: 600 }, {
    client: "Acme Ltd", location: "Industrial Area, Nairobi", siteProfile: "Nairobi / Karen",
    phase: "Three Phase (400V)", siteType: "Industrial", monthlyBill: 180000, objectiveKey: "commercial", loadSourceKey: "energy_import",
    preparedBy: "QA Engineer",
  });
  assert.strictEqual(project.client, "Acme Ltd");
  assert.strictEqual(project.systemType, "Solar PV – Hybrid");
  assert.strictEqual(project.monthlyBill, 180000);
  assert.strictEqual(project.siteType, "Industrial");
  assert.strictEqual(project.loadAssessmentMode, "Industrial / Manufacturing");
  assert.strictEqual(inferLoadAssessmentMode("Commercial", "commercial"), "Commercial & Industrial");
  assert.strictEqual(project.loadSource, "data_logger");
  assert.strictEqual(project.isDemo, false);
  assert.strictEqual(project.psh, 5.6, "engineering defaults must survive");
  assert.strictEqual(nextTab, "energy-import");
  assert.ok(!isBlankProject(project));
});

test("5b. Blueprint load source switches the sizing mode", () => {
  const { project, nextTab } = buildProjectFromOnboarding({}, { client: "C", location: "L", objectiveKey: "residential_backup", loadSourceKey: "blueprint" });
  assert.strictEqual(project.sizingMode, "blueprint_new_build");
  assert.strictEqual(nextTab, "loads");
  assert.strictEqual(PROJECT_OBJECTIVES.length, 7);
  assert.strictEqual(LOAD_SOURCES.length, 5);
  assert.ok(getObjective("offgrid").systemType === "Off-grid");
  assert.ok(getLoadSource("manual").tab === "loads");
});

test("6. Try Demo Project loads clearly labelled demo data", () => {
  assert.strictEqual(DEMO_PROJECTS.length, 6, "six demos expected");
  const demo = createProjectFromDemo({ psh: 5.6, panelW: 600 }, "residential_karen");
  assert.ok(demo, "Karen demo must exist");
  assert.strictEqual(demo.project.isDemo, true);
  assert.ok(demo.project.client.startsWith("DEMO —"), `demo client must be badged, got ${demo.project.client}`);
  assert.ok(demo.loads.length > 0, "demo must carry sample loads");
  assert.strictEqual(demo.project.psh, 5.6, "demo inherits engineering defaults");
  assert.ok(/demo data only/i.test(DEMO_DISCLAIMER));
  DEMO_PROJECTS.forEach((d) => assert.ok(d.project.client.startsWith("DEMO —"), `${d.id} client must be badged`));
});

test("7. Karen demo exists ONLY inside demoProjects", () => {
  assert.ok(getDemoProject("residential_karen"), "Karen must live in the demo library");
  // App.jsx may reference the site profile, but not the demo client/location as defaults
  assert.ok(!appSource.includes('client: "Karen Homeowner"'));
  assert.ok(!appSource.includes('location: "Karen, Nairobi"'));
});

test("7b. Demo converts to a real project and drops the badge", () => {
  const demo = createProjectFromDemo({}, "commercial_sme");
  const real = convertDemoToRealProject(demo.project, "Real Client Ltd");
  assert.strictEqual(real.isDemo, false);
  assert.strictEqual(real.demoId, null);
  assert.strictEqual(real.client, "Real Client Ltd");
  assert.strictEqual(real.convertedFromDemo, "commercial_sme");
});

test("8. Import JSON still validates and summarises", () => {
  const cur = { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION };
  const ok = importProjectJson(JSON.stringify({ schemaVersion: SCHEMA_VERSION, name: "Imported", project: { client: "Imported Co" }, loadItemsV2: [{ id: 1 }] }), cur);
  assert.ok(ok.ok && ok.summary.client === "Imported Co");
  assert.ok(!importProjectJson("{}", cur).ok, "a file with no project section must be rejected");
});

test("9. Save/load and last-session pointer still work", () => {
  const rec = { id: 99, name: "Saved One", project: { client: "Saved Co" }, savedAt: new Date().toISOString() };
  const { records } = saveProjectLocal(rec, []);
  assert.strictEqual(records.length, 1);
  // No browser storage in node → remember/find degrade safely rather than throwing
  assert.doesNotThrow(() => rememberLastActiveProject(99, "Saved One"));
  assert.doesNotThrow(() => findLastActiveProject(records));
});

test("10. Energy-data entry point produces a usable blank project", () => {
  const p = createBlankProject({ psh: 5.6 }, { loadSource: "data_logger" });
  assert.strictEqual(p.loadSource, "data_logger");
  assert.strictEqual(p.client, "");
  assert.ok(isBlankProject(p), "still blank until the user names it");
});

test("11. Blank project is safe for client view (no fake data, no NaN inputs)", () => {
  const p = createBlankProject({ psh: 5.6, panelW: 600, solarCoverage: 0.85 });
  assert.strictEqual(p.client, "");
  assert.strictEqual(p.location, "");
  assert.strictEqual(p.monthlyBill, 0);
  Object.entries(BLANK_PROJECT_IDENTITY).forEach(([k, v]) => assert.deepStrictEqual(p[k], v, `${k} must be blank`));
  assert.ok(Number.isFinite(p.psh) && Number.isFinite(p.panelW), "engineering numbers must stay numeric");
});

test("12. Existing saved projects still migrate safely (old Karen saves included)", () => {
  const cur = { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION };
  const legacy = importProjectJson(JSON.stringify({
    schemaVersion: "8.5", appVersion: "Voltflow 8.5", name: "Old Karen Project",
    project: { client: "Karen Homeowner", location: "Karen, Nairobi", siteProfile: "Nairobi / Karen", monthlyBill: 35000 },
    loads: [{ id: 1, name: "Fridge", qty: 1, watts: 250, dayHours: 6, nightHours: 6, surge: 3, critical: true }],
  }), cur);
  assert.ok(legacy.ok, "an old saved project must still import");
  assert.strictEqual(legacy.summary.client, "Karen Homeowner", "the user's own historic data is preserved as-is");
  assert.ok(legacy.warnings.some((w) => /older app version/i.test(w)));
});

test("13. Reset local data reports what it clears and KEEPS feedback by default", () => {
  // No browser storage in node — the helpers must degrade safely, not throw.
  assert.doesNotThrow(() => summarizeLocalData());
  const s = summarizeLocalData();
  ["savedProjects", "feedbackEntries", "assistantMessages", "hasLastSession"].forEach((k) => assert.ok(k in s, `summary missing ${k}`));

  const kept = clearLocalProjectData();
  assert.strictEqual(kept.clearedFeedback, 0, "feedback must NOT be deleted unless explicitly requested");
  assert.ok("keptFeedback" in kept, "reset must report what it preserved");

  const wiped = clearLocalProjectData({ includeFeedback: true });
  assert.strictEqual(wiped.keptFeedback, 0, "opting in must clear feedback too");
});

test("14. Backup export bundles local data before a reset", () => {
  const { filename, jsonString } = exportAllLocalData(APP_VERSION);
  assert.ok(filename.includes("voltflow_local_backup"));
  const parsed = JSON.parse(jsonString);
  ["appVersion", "exportedAt", "savedProjects", "feedback", "lastSession"].forEach((k) => assert.ok(k in parsed, `backup missing ${k}`));
  assert.strictEqual(parsed.appVersion, APP_VERSION);
});

test("15. Safe mode skips saved browser projects and last-session resume", () => {
  assert.strictEqual(isSafeModeRequested("?safeMode=1"), true);
  assert.strictEqual(isSafeModeRequested("?safeMode=0"), false);
  assert.ok(/cloudEnabled \|\| safeMode \? \[\] : loadProjectsLocal\(\)/.test(appSource));
  assert.ok(/safeMode \? null : findLastActiveProject/.test(appSource));
  assert.ok(/Safe Mode<\/strong> - saved browser project data not loaded/.test(appSource));
  assert.ok(/Clear local demo data/.test(appSource));
});

test("16. Corrupt and oversized project storage is skipped without deletion", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = { localStorage: storage, location: { search: "" } };
  try {
    storage.setItem(PROJECTS_KEY, "{bad json");
    assert.deepStrictEqual(loadProjectsLocal(), []);
    assert.strictEqual(storage.getItem(PROJECTS_KEY), "{bad json", "original corrupt value must be preserved");
    assert.ok(storage.getItem(PROJECTS_QUARANTINE_KEY), "recovery metadata must be written under the backup key");
    assert.match(getLocalProjectRecovery().reason, /could not be parsed/i);

    const oversized = "x".repeat(Math.floor(MAX_LOCAL_PROJECT_BYTES / 2) + 1);
    storage.setItem(PROJECTS_KEY, oversized);
    assert.deepStrictEqual(loadProjectsLocal(), []);
    assert.strictEqual(storage.getItem(PROJECTS_KEY).length, oversized.length, "oversized original must not be deleted");
    assert.match(getLocalProjectRecovery().reason, /safety limit/i);
    assert.strictEqual(loadProjectsLocal({ skipSavedData: true }).length, 0);
  } finally {
    delete globalThis.window;
  }
});

test("17. Legacy reference and delivery migration are deterministic", () => {
  const seed = { id: 42, name: "Legacy", savedAt: "2025-01-02T03:04:05.000Z", project: { client: "Demo", location: "Nairobi" } };
  assert.strictEqual(normalizeProjectRef(null, seed), normalizeProjectRef(null, seed));
  const options = { stableIdPrefix: normalizeProjectRef(null, seed), timestamp: seed.savedAt };
  const first = createDefaultDelivery(seed.project, {}, [], options);
  const second = createDefaultDelivery(seed.project, {}, [], options);
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(
    normalizeDelivery({ tasks: [{ title: "Inspect" }], issues: [{ title: "Check" }] }),
    normalizeDelivery({ tasks: [{ title: "Inspect" }], issues: [{ title: "Check" }] }),
  );
  assert.deepStrictEqual(normalizeLoadItemsV2([{ name: "Load" }]), normalizeLoadItemsV2([{ name: "Load" }]));
  assert.deepStrictEqual(migrateLegacyLoadsToV2([{ name: "Legacy" }]), migrateLegacyLoadsToV2([{ name: "Legacy" }]));
});

test("18. Crash fallback, revision bailout and lazy JSON export are wired", () => {
  assert.ok(/AppErrorBoundary/.test(mainSource));
  assert.ok(/Restart in Safe Mode/.test(errorBoundarySource));
  assert.ok(/Clear local demo data/.test(errorBoundarySource));
  assert.ok(/if \(!hasActiveProject\) return undefined/.test(appSource), "revision hashing must not run on startup");
  const settled = { designRevision: null, selectedDesignOption: null };
  assert.strictEqual(settleFailedDesignRevision(settled), settled, "repeated revision failures must preserve object identity");
  assert.deepStrictEqual(
    settleFailedDesignRevision({ designRevision: { inputs_hash: "old" }, selectedDesignOption: { id: "old" } }),
    { designRevision: null, selectedDesignOption: null },
  );
  assert.ok(/setProject\(settleFailedDesignRevision\)/.test(appSource), "rejected revisions must use the stable bailout");
  assert.ok(!/data:application\/json;charset=utf-8/.test(appSource), "proposal JSON must not be expanded into a data URL during render");
  assert.ok(/navigateToTab\("storage"\);\s+showToast\("Use Export current project JSON/.test(appSource), "proposal delegates to complete backup tools");
  assert.ok(/const exportCurrent = \(\) => \{[\s\S]*?exportProjectJson\(buildRecord/.test(appSource), "complete JSON is created only in the explicit export handler");
  assert.ok(!/JSON\.stringify\(\{ project, loadItemsV2 \}/.test(appSource), "partial project-only backups cannot be exported");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
