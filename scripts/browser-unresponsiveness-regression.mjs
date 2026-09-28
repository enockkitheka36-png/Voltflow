import assert from "node:assert";
import { readFileSync } from "node:fs";

import {
  PROJECTS_KEY,
  PROJECTS_QUARANTINE_KEY,
  isSafeModeRequested,
  loadProjectsLocal,
  persistProjectsLocal,
} from "../src/utils/projectStorage.js";
import {
  AUDIT_EVENT_TYPES,
  clearAuditLog,
  loadAuditLog,
  recordAudit,
} from "../src/utils/auditLog.js";
import {
  migrateLegacyLoadsToV2,
  normalizeLoadItemsV2,
  normalizeProjectRef,
} from "../src/utils/schemaMigration.js";
import { createDefaultDelivery, normalizeDelivery } from "../src/utils/deliveryEngine.js";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const boundarySource = readFileSync(new URL("../src/components/AppErrorBoundary.jsx", import.meta.url), "utf8");

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

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  const writes = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      values.set(key, String(value));
      writes.set(key, (writes.get(key) || 0) + 1);
    },
    removeItem(key) { values.delete(key); },
    writeCount(key) { return writes.get(key) || 0; },
  };
}

function withBrowserStorage(storage, fn) {
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  globalThis.window = { localStorage: storage, location: { search: "" } };
  globalThis.localStorage = storage;
  try { return fn(); }
  finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
}

console.log("\nVoltflow 11.8.1 - Browser Unresponsiveness Regression\n");

await test("1. Legacy migration helpers are deterministic and idempotent", () => {
  const seed = { id: 7, name: "Legacy", savedAt: "2026-01-02T03:04:05.000Z", project: { client: "Acme" } };
  const projectRef = normalizeProjectRef(null, seed);
  const firstDelivery = createDefaultDelivery(seed.project, {}, [], { stableIdPrefix: projectRef, timestamp: seed.savedAt });
  const secondDelivery = normalizeDelivery(normalizeDelivery(firstDelivery, seed.project), seed.project);
  assert.deepStrictEqual(secondDelivery, normalizeDelivery(firstDelivery, seed.project));
  const legacyLoads = [{ id: "one", name: "Pump", watts: 800, dayHours: 4, nightHours: 2 }];
  const migrated = migrateLegacyLoadsToV2(legacyLoads);
  assert.deepStrictEqual(normalizeLoadItemsV2(migrated), normalizeLoadItemsV2(normalizeLoadItemsV2(migrated)));
  assert.strictEqual(projectRef, normalizeProjectRef(null, seed));
});

await test("2. Create Project is an event action with one factory and one audit call", () => {
  const start = appSource.indexOf("const handleCreateFromWizard = (answers) => {");
  const end = appSource.indexOf("const handleLoadDemo", start);
  const handler = appSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.strictEqual((handler.match(/buildProjectFromOnboarding\(/g) || []).length, 1);
  assert.strictEqual((handler.match(/PROJECT_CREATED/g) || []).length, 1);
  assert.doesNotMatch(handler, /useEffect|setInterval|requestAnimationFrame/);
});

await test("3. Duplicate project_created audit events are persisted once", () => {
  const storage = memoryStorage();
  withBrowserStorage(storage, () => {
    clearAuditLog();
    const first = recordAudit(AUDIT_EVENT_TYPES.PROJECT_CREATED, "Acme (Hybrid)", { projectRef: "SOL-1", user: "QA" });
    const second = recordAudit(AUDIT_EVENT_TYPES.PROJECT_CREATED, "Acme (Hybrid)", { projectRef: "SOL-1", user: "QA" });
    const events = loadAuditLog("SOL-1");
    assert.strictEqual(events.length, 1);
    assert.strictEqual(second.id, first.id);
  });
});

await test("4. Design revisions are created only by explicit sizing or proposal actions", () => {
  const helperStart = appSource.indexOf("const createCurrentDesignRevision = async");
  const commitStart = appSource.indexOf("const commitDraftLoadItems = async");
  const prepareStart = appSource.indexOf("const prepareProjectVersion = async");
  assert.ok(helperStart >= 0 && commitStart > helperStart && prepareStart > commitStart);
  assert.strictEqual((appSource.match(/createDesignRevision\s*\(/g) || []).length, 1);
  assert.ok(appSource.indexOf("createDesignRevision", helperStart) > helperStart);
  assert.match(appSource.slice(commitStart, prepareStart), /await createCurrentDesignRevision\(draftLoadItemsV2\)/);
  assert.match(appSource.slice(prepareStart, prepareStart + 1600), /await createCurrentDesignRevision\(loadItemsV2\)/);
  assert.match(appSource, /onCommit=\{commitDraftLoadItems\}/);
});

await test("5. Quote revisions are not issued from App render", () => {
  assert.doesNotMatch(appSource, /\.quotes\.issueQuote\s*\(/);
  assert.doesNotMatch(appSource, /issueQuote\s*\(/);
});

await test("6. Safe Mode bypasses saved-project restore", () => {
  assert.strictEqual(isSafeModeRequested("?safeMode=1"), true);
  assert.match(appSource, /cloudEnabled \|\| safeMode \? \[\] : loadProjectsLocal\(\)/);
  assert.match(appSource, /safeMode \? null : findLastActiveProject/);
});

await test("7. Corrupted localStorage is quarantined and never crashes startup", () => {
  const storage = memoryStorage({ [PROJECTS_KEY]: "{bad json" });
  withBrowserStorage(storage, () => {
    assert.deepStrictEqual(loadProjectsLocal(), []);
    assert.strictEqual(storage.getItem(PROJECTS_KEY), "{bad json");
    assert.ok(storage.getItem(PROJECTS_QUARANTINE_KEY));
  });
  assert.match(mainSource, /AppErrorBoundary/);
  assert.match(boundarySource, /Restart in Safe Mode/);
  assert.match(boundarySource, /Clear local demo data/);
});

await test("8. Identical local project state is written only once and reload is stable", () => {
  const storage = memoryStorage();
  const records = [{ id: 1, name: "Acme", project: { client: "Acme", monthlyBill: 50000 } }];
  withBrowserStorage(storage, () => {
    assert.strictEqual(persistProjectsLocal(records), true);
    assert.strictEqual(persistProjectsLocal(JSON.parse(JSON.stringify(records))), true);
    assert.strictEqual(storage.writeCount(PROJECTS_KEY), 1);
    assert.deepStrictEqual(loadProjectsLocal(), records);
    assert.strictEqual(storage.writeCount(PROJECTS_KEY), 1);
    const changed = [{ ...records[0], project: { ...records[0].project, monthlyBill: 55000 } }];
    assert.strictEqual(persistProjectsLocal(changed), true);
    assert.strictEqual(storage.writeCount(PROJECTS_KEY), 2);
  });
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
