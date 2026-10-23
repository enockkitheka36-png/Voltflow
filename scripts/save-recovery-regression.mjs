import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canExportProjectBackup, saveCloudProjectAndRefresh } from "../src/utils/projectSave.js";

let passed = 0;
const check = async (name, callback) => { await callback(); passed += 1; console.log(`PASS: ${name}`); };
for (const viewMode of ["engineer", "client", "technician", "bank"]) {
  for (const role of ["manager", "engineer", "sales", "technician", "client", "bank", null]) {
    await check(`${viewMode}/${role}: backup access remains restricted`, () => {
      assert.equal(canExportProjectBackup(viewMode, { cloudEnabled: true, role }), viewMode === "engineer" && ["manager", "engineer", "sales"].includes(role));
    });
  }
}
await check("Local backups are still Engineer View only", () => {
  assert.equal(canExportProjectBackup("engineer"), true);
  assert.equal(canExportProjectBackup("bank"), false);
});
await check("Saved identity is committed before a failing list refresh", async () => {
  const calls = [];
  const original = { project: { client: "Synthetic test" }, loadItemsV2: [{ name: "LED" }] };
  const unchanged = structuredClone(original);
  let confirmed = null;
  let creates = 0;
  let updates = 0;
  const projects = {
    async createProject() { creates += 1; calls.push("create"); return { id: "fixture-project", revisionNo: 1 }; },
    async updateProject(input) { updates += 1; assert.equal(input.projectId, "fixture-project"); assert.equal(input.expectedRevisionNo, 1); return { id: "fixture-project", revisionNo: 2 }; },
    async listProjects() { calls.push("list"); assert.ok(confirmed?.id); throw new Error("Synthetic refresh failure"); },
  };
  const first = await saveCloudProjectAndRefresh({ projects, organisationId: "fixture-org", record: original, requestId: "fixture-create", onSaved: (saved) => { calls.push("confirmed"); confirmed = saved; } });
  assert.deepEqual(calls, ["create", "confirmed", "list"]);
  assert.equal(first.saved.id, "fixture-project");
  assert.ok(first.refreshError);
  assert.equal(first.records, null);
  await saveCloudProjectAndRefresh({ projects, organisationId: "fixture-org", projectId: confirmed.id, expectedRevisionNo: confirmed.revisionNo, record: original, requestId: "fixture-update", onSaved: (saved) => { confirmed = saved; } });
  assert.equal(creates, 1);
  assert.equal(updates, 1);
  assert.deepEqual(original, unchanged);
});
await check("Write rejection never lists or reports a confirmed save", async () => {
  let confirmed = false;
  const projects = {
    async createProject() { throw new Error("Synthetic write failure"); },
    async listProjects() { assert.fail("List must not run after a rejected write"); },
  };
  await assert.rejects(saveCloudProjectAndRefresh({ projects, onSaved: () => { confirmed = true; } }), /Synthetic write failure/);
  assert.equal(confirmed, false);
});
await check("Successful save returns the refreshed list", async () => {
  const saved = { id: "fixture", revisionNo: 1 };
  const result = await saveCloudProjectAndRefresh({ projects: { async createProject() { return saved; }, async listProjects() { return [saved]; } }, onSaved: () => {} });
  assert.equal(result.refreshError, null);
  assert.deepEqual(result.records, [saved]);
});
await check("Conflict remains a rejection, never a refresh failure", async () => {
  const conflict = Object.assign(new Error("Synthetic conflict"), { code: "CONFLICT" });
  await assert.rejects(saveCloudProjectAndRefresh({ projectId: "fixture", projects: { async updateProject() { throw conflict; } }, onSaved: () => assert.fail("Conflict cannot confirm a save") }), (error) => error === conflict);
});
await check("Export handler and error feedback both enforce the backup permission", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const exportStart = app.indexOf("const exportCurrent = () => {");
  const exportEnd = app.indexOf("const applyNormalizedRecord", exportStart);
  const handler = app.slice(exportStart, exportEnd);
  assert.ok(handler.indexOf("if (!canUseProjectJson)") < handler.indexOf("exportProjectJson("));
  assert.match(app, /<SaveFeedback state=\{saveState\} canExport=\{canUseProjectJson\}/);
  assert.match(app, /if \(saveInFlight\.current\) return;/);
  assert.doesNotMatch(app, /JSON\.stringify\(\{ project, loadItemsV2 \}/);
  assert.match(app, /navigateToTab\("storage"\);\s+showToast\("Use Export current project JSON/);
  const feedback = readFileSync(new URL("../src/components/SaveFeedback.jsx", import.meta.url), "utf8");
  assert.match(feedback, /canExport && <button/);
  assert.match(feedback, /onClick=\{onRefresh\}/);
  assert.match(feedback, /!state\.conflict &&/);
});
console.log(`\n${passed} save/recovery checks passed. Provider calls were synthetic fixtures.`);
