import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_DIR } from "./lib/securityStatus.mjs";
import { CATALYST_PROOFS, buildCatalystReleaseStatus, catalystGateExitCode, hashCatalystBuild, resolveCatalystProofContext } from "./lib/catalystReleaseStatus.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--require")) {
  console.error("Usage: node scripts/release-catalyst-gate.mjs [--require <release-level>]");
  process.exit(2);
}
let buildHash = null;
try { buildHash = hashCatalystBuild(path.join(projectRoot, "dist")); }
catch (error) { console.error(`Build could not be fingerprinted: ${error.message}`); }
const context = resolveCatalystProofContext(process.env, buildHash);
const markers = {};
for (const [suite] of CATALYST_PROOFS) {
  const file = path.join(GENERATED_DIR, `catalyst-${suite}.json`);
  try { markers[suite] = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") markers[suite] = { malformed: true }; }
}
const status = buildCatalystReleaseStatus(markers, context);
fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(path.join(GENERATED_DIR, "catalyst-release-status.json"), JSON.stringify(status, null, 2));
console.log("\n=== Voltflow Catalyst Release Gate ===");
console.log(`  runtimeConfigured: ${status.runtimeConfigured}`);
for (const proof of Object.values(status.proofs)) console.log(`  [${proof.status}] ${proof.suite}: ${proof.reason}`);
console.log(`  allowedUse: ${status.allowedUse}`);
console.log(`  ${status.notes}`);
const exitCode = catalystGateExitCode(status, args[1]);
if (args[1]) console.log(`  Required ${args[1]}: ${exitCode === 0 ? "PASS" : "BLOCKED"}`);
process.exitCode = exitCode;
