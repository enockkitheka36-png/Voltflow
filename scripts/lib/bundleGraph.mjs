import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

export async function measureStartupGraph(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, ".vite/manifest.json"), "utf8"));
  const entry = Object.keys(manifest).find((key) => manifest[key].isEntry && manifest[key].file.endsWith(".js"));
  if (!entry) throw new Error("JavaScript entry missing from build manifest.");
  const visited = new Set();
  const visit = (key) => {
    if (visited.has(key)) return;
    if (!manifest[key]) throw new Error(`Missing manifest node: ${key}`);
    visited.add(key);
    for (const dependency of manifest[key].imports || []) visit(dependency);
  };
  visit(entry);
  const files = [...new Set([...visited].map((key) => manifest[key].file).filter((file) => file.endsWith(".js")))];
  let bytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const source = await readFile(path.join(directory, file));
    bytes += source.length;
    gzipBytes += gzipSync(source).length;
  }
  const app = Object.keys(manifest).find((key) => manifest[key].src === "src/App.jsx");
  return { entry, files, staticKeys: [...visited], app, appDeferred: !!app && !visited.has(app), bytes, gzipBytes };
}
