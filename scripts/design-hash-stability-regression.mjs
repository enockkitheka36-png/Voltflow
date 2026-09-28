/**
 * design-hash-stability-regression.mjs — Voltflow 11.8.1 crashfix
 *
 * Locks the "Page Unresponsive" freeze fix: the deterministic design-revision
 * hash MUST NOT change when only the ephemeral roof-face id (or name/label/
 * photo_ids) changes. Otherwise the auto design-revision effect loops forever
 * (setProject -> activeFaces regenerates Date.now() ids -> new hash -> repeat).
 */
import assert from "node:assert";
import { createDesignRevision, buildDesignInputs } from "../src/utils/designRevision.js";
import { normalizeRoofFace } from "../src/utils/multiRoofLayout.js";

let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`  PASS: ${name}`); passed++; } catch (e) { console.log(`  FAIL: ${name}\n        ${e.message}`); failed++; } };

console.log("\nVoltflow 11.8.1 crashfix — Design Hash Stability Regression\n");

const project = { systemType: "Solar PV – Hybrid", panelW: 550, psh: 5.6, solarCoverage: 0.85, monthlyBill: 350000, gridTariff: 22 };
const geom = { roofLengthM: 8, roofWidthM: 6, roofAzimuthDeg: 0, roofPitchDeg: 10, roofUsablePercent: 0.7 };

await test("1. Same geometry, DIFFERENT ephemeral face id -> identical design hash", async () => {
  // normalizeRoofFace mints a fresh Date.now() id each call — simulate two renders.
  const faceA = normalizeRoofFace({ ...geom });
  const faceB = normalizeRoofFace({ ...geom });
  assert.notStrictEqual(faceA.id, faceB.id, "precondition: ids differ per render");
  const a = await createDesignRevision({ project, loads: [], loadItemsV2: [], roofFaces: [faceA] });
  const b = await createDesignRevision({ project, loads: [], loadItemsV2: [], roofFaces: [faceB] });
  assert.strictEqual(a.inputs_hash, b.inputs_hash, "design hash must ignore the ephemeral face id");
});

await test("2. Different name/label/photo_ids -> identical design hash", async () => {
  const faceA = normalizeRoofFace({ ...geom, id: "fixed", name: "North", photo_ids: ["p1"] });
  const faceB = normalizeRoofFace({ ...geom, id: "fixed", name: "Renamed", photo_ids: ["p1", "p2"] });
  const a = await createDesignRevision({ project, loads: [], loadItemsV2: [], roofFaces: [faceA] });
  const b = await createDesignRevision({ project, loads: [], loadItemsV2: [], roofFaces: [faceB] });
  assert.strictEqual(a.inputs_hash, b.inputs_hash, "cosmetic/evidence fields must not affect the design hash");
});

await test("3. Different GEOMETRY -> different design hash (sanity)", async () => {
  const faceA = normalizeRoofFace({ ...geom });
  const faceB = normalizeRoofFace({ ...geom, roofAzimuthDeg: 180 });
  const a = await createDesignRevision({ project, loads: [], loadItemsV2: [], roofFaces: [faceA] });
  const b = await createDesignRevision({ project, loads: [], loadItemsV2: [], roofFaces: [faceB] });
  assert.notStrictEqual(a.inputs_hash, b.inputs_hash, "real geometry change must change the hash");
});

await test("4. buildDesignInputs roofFaces carry no id/name/photo_ids keys", () => {
  const inputs = buildDesignInputs({ project, roofFaces: [normalizeRoofFace({ ...geom })] });
  const rf = inputs.roofFaces[0];
  for (const k of ["id", "name", "label", "photo_ids"]) assert.ok(!(k in rf), `hashed roof face must not include ${k}`);
  assert.ok("azimuth_deg" in rf && "usable_area_m2" in rf, "design geometry retained");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
