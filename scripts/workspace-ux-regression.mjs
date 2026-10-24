import assert from "node:assert/strict";
import { getWorkspaceNavigation, filterWorkspaceNavigation, getWorkspaceLocation } from "../src/utils/workspaceNavigation.js";

const common = ["field-dashboard", "dashboard", "proposal", "delivery", "assistant"];
const technical = ["studio", "site-survey", "roof-shading", "roof-layout", "electrical", "site-photos", "safety-risks", "borehole", "compliance", "evidence", "installer-sim", "readiness", "storage", "feedback"];
const engineering = ["new-project", "project", "loads", "energy-import", "generation", "battery", "inverter", "eng-compliance", "finance", "carbon", "accessories", "assets-lib", "boq"];
const systems = ["", "Solar PV – Hybrid", "Off-grid", "Genset hybrid", "EV charging", "Mini-grid"];
let passed = 0;
const keys = (groups) => groups.flatMap((group) => group.items.map((item) => item.key));

for (const viewMode of ["engineer", "client", "technician", "bank"]) {
  for (const systemType of systems) {
    const expected = viewMode === "bank" ? ["bank-flow", "field-dashboard", "proposal", "storage"] : [...common];
    if (viewMode === "engineer" || viewMode === "technician") expected.push(...technical);
    if (viewMode === "engineer") {
      expected.push(...engineering);
      if (["Solar PV – Hybrid", "Off-grid", "Genset hybrid"].includes(systemType)) expected.push("system-options");
      const specialist = { "Genset hybrid": "genset", "EV charging": "ev", "Mini-grid": "minigrid" }[systemType];
      if (specialist) expected.push(specialist);
    }
    const groups = getWorkspaceNavigation({ viewMode, project: { systemType } });
    assert.deepEqual(keys(groups).sort(), expected.sort(), `${viewMode}/${systemType}: preserve the existing sidebar visibility exactly`);
    assert.equal(new Set(keys(groups)).size, keys(groups).length, "No duplicate tool links");
    passed += 1;
  }
}

for (const viewMode of ["engineer", "client", "technician", "bank"]) {
  const groups = getWorkspaceNavigation({ viewMode, canAccess: (key) => ["field-dashboard", "proposal"].includes(key) });
  assert.deepEqual(keys(groups).sort(), ["field-dashboard", "proposal"], "Role filtering cannot be bypassed by a group or search");
  assert.deepEqual(keys(filterWorkspaceNavigation(groups, "battery")), []);
  passed += 1;
}

const groups = getWorkspaceNavigation();
assert.deepEqual(keys(filterWorkspaceNavigation(groups, " BATTERY ")), ["battery"]);
assert.deepEqual(keys(filterWorkspaceNavigation(groups, "bill of quantities")), ["boq"]);
assert.equal(filterWorkspaceNavigation(groups, "not a tool").length, 0);
assert.deepEqual(filterWorkspaceNavigation(groups, " "), groups);
assert.equal(getWorkspaceLocation(groups, "loads").group.id, "plan");
assert.equal(getWorkspaceLocation(groups, "battery").group.id, "design");
assert.equal(getWorkspaceLocation(groups, "proposal").group.id, "quote");
assert.equal(getWorkspaceLocation(groups, "evidence").group.id, "deliver");
assert.equal(getWorkspaceLocation(groups, "unknown"), null);
assert.equal(getWorkspaceLocation(getWorkspaceNavigation({ viewMode: "client" }), "battery"), null);
passed += 10;
console.log(`PASS: ${passed} workspace navigation, search and visibility checks.`);
