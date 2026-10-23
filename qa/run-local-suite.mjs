import fs from "node:fs";
import { spawnSync } from "node:child_process";

const configuration = JSON.parse(fs.readFileSync("package.json", "utf8"));
const names = Array.from(configuration.scripts["test:all"].matchAll(/npm run ([\w:-]+)/g), (match) => match[1]);
const results = [];
fs.writeFileSync("qa/regression-results.txt", "");
for (const name of names) {
  const command = configuration.scripts[name];
  if (!/^node scripts\/[\w-]+\.mjs$/.test(command)) throw new Error(`Unsupported local regression command: ${name}`);
  const execution = spawnSync(process.execPath, [command.slice(5)], { encoding: "utf8", timeout: 180000 });
  const output = `${execution.stdout || ""}${execution.stderr || ""}`;
  fs.appendFileSync("qa/regression-results.txt", `\n=== ${name} ===\n${output}`);
  const assertions = Array.from(output.matchAll(/(?:^|\n)\s*PASS:/g)).length;
  results.push({ name, exitCode: execution.status, assertions });
  console.log(`${name}: ${execution.status === 0 ? "PASS" : "FAIL"} (${assertions} named assertions)`);
}
fs.writeFileSync("qa/regression-summary.json", JSON.stringify(results, null, 2));
const failures = results.filter((result) => result.exitCode !== 0);
console.log(`\n${results.length} suites; ${failures.length} failing.`);
process.exitCode = failures.length ? 1 : 0;
