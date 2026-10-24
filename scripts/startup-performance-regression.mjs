import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build, createServer } from "vite";
import react from "@vitejs/plugin-react";
import { createWorkspaceLoader, WorkspaceLoadError } from "../src/utils/workspaceLoader.js";
import { measureStartupGraph } from "./lib/bundleGraph.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const results = [];
async function check(label, action) {
  try { await action(); results.push({ label, status: "PASS" }); console.log(`PASS: ${label}`); }
  catch (error) { results.push({ label, status: "FAIL", error: error.message }); console.error(`FAIL: ${label}: ${error.message}`); }
}

await check("Workspace requests are deferred until explicitly invoked", () => {
  let imports = 0;
  createWorkspaceLoader(() => { imports += 1; return { default: () => null }; });
  assert.equal(imports, 0);
});
await check("Concurrent requests share a single download and successful module", async () => {
  let imports = 0;
  const module = { default: () => null };
  const loader = createWorkspaceLoader(() => { imports += 1; return module; });
  const first = loader();
  assert.equal(loader(), first);
  assert.equal(await first, module);
  assert.equal(await loader(), module);
  assert.equal(imports, 1);
});
await check("A failed download is not permanently cached; a second attempt can succeed", async () => {
  let imports = 0;
  const cause = new Error("Synthetic offline download");
  const loader = createWorkspaceLoader(() => { imports += 1; if (imports === 1) throw cause; return { default: () => null }; });
  await assert.rejects(loader(), (error) => error instanceof WorkspaceLoadError && error.cause === cause);
  assert.equal(typeof (await loader()).default, "function");
  assert.equal(imports, 2);
});
await check("Repeated failures stay recoverable without a retry loop", async () => {
  let imports = 0;
  const loader = createWorkspaceLoader(() => { imports += 1; return Promise.reject(new Error("Offline")); });
  for (let attempt = 1; attempt <= 3; attempt++) { await assert.rejects(loader(), WorkspaceLoadError); assert.equal(imports, attempt); }
});
await check("Malformed downloaded modules are rejected rather than rendered", async () => {
  for (const module of [undefined, {}, { default: null }, { default: {} }, { default: "not a component" }]) await assert.rejects(createWorkspaceLoader(() => module)(), WorkspaceLoadError);
});
await check("Memo / forward-ref React component objects can be loaded", async () => {
  for (const component of [React.memo(() => null), React.forwardRef((_props, _reference) => null)]) assert.equal((await createWorkspaceLoader(() => ({ default: component }))()).default, component);
});
await check("Loader does not read, write or clear saved project storage", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let touches = 0;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Proxy({}, { get() { touches += 1; throw new Error("Storage must not be accessed"); } }) });
  try { await createWorkspaceLoader(() => ({ default: () => null }))(); assert.equal(touches, 0); }
  finally { if (previous === undefined) delete globalThis.localStorage; else Object.defineProperty(globalThis, "localStorage", previous); }
});

const virtualId = "\0startup-platform-context";
const server = await createServer({
  root, configFile: false, cacheDir: path.join(root, "qa/.startup-ssr-cache"), appType: "custom",
  server: { middlewareMode: true, watch: null },
  plugins: [{
    name: "test-startup-access-boundary",
    enforce: "pre",
    transform(source, identifier) {
      if (identifier.replaceAll("\\", "/").endsWith("/platform/RestrictedPortal.jsx")) return source.replace('from "./PlatformContext.jsx"', 'from "virtual:startup-platform-context"');
    },
    resolveId(source, importer) {
      if (source === "virtual:startup-platform-context" || source.endsWith("PlatformContext.jsx") && importer?.replaceAll("\\", "/").endsWith("/platform/RestrictedPortal.jsx")) return virtualId;
    },
    load(identifier) {
      if (identifier === virtualId) return "let context = {}; export function setContext(value) { context = value; } export function useVoltflowPlatform() { return context; }";
    },
  }, react()],
});
try {
  const { WorkspaceLoadingScreen } = await server.ssrLoadModule("/src/components/DeferredWorkspace.jsx");
  const { SecureApplicationBoundary } = await server.ssrLoadModule("/src/platform/RestrictedPortal.jsx");
  const contextModule = await server.ssrLoadModule("virtual:startup-platform-context");
  await check("Loading screen exposes a status, no fake percentage, and no destructive controls", () => {
    const markup = renderToStaticMarkup(React.createElement(WorkspaceLoadingScreen));
    assert.match(markup, /role="status"/); assert.match(markup, /aria-busy="true"/);
    assert.match(markup, /Opening your workspace/); assert.doesNotMatch(markup.replace(/<[^>]*>/g, ""), /[0-9]+%|Clear local|Delete projects/);
  });
  await check("Failure screen offers explicit retry/reload and preserves saved-data wording", () => {
    const markup = renderToStaticMarkup(React.createElement(WorkspaceLoadingScreen, { failed: true }));
    assert.match(markup, /role="alert"/); assert.match(markup, /Try again/); assert.match(markup, /Reload latest app/);
    assert.match(markup, /Saved projects have not been cleared/); assert.doesNotMatch(markup, /Clear local demo data/);
  });
  const shared = { mode: "catalyst", loading: false, session: { userId: "synthetic" }, authorization: { memberships: [] }, signIn() {}, signOut() {}, selectOrganisation() {}, platform: {} };
  for (const [label, context, allowed] of [
    ["Secure-session loading", { ...shared, loading: true, session: null }, false],
    ["Signed-out Catalyst", { ...shared, session: null }, false],
    ["Configuration error", { ...shared, mode: "configuration-error" }, false],
    ["No organisation membership", shared, false],
    ["Technician role", { ...shared, activeMembership: { id: "test", role: "technician" } }, false],
    ["Client role", { ...shared, activeMembership: { id: "test", role: "client" } }, false],
    ["Bank role", { ...shared, activeMembership: { id: "test", role: "bank" } }, false],
    ["Engineer role", { ...shared, activeMembership: { id: "test", role: "engineer" } }, true],
    ["Existing local-demo mode", { mode: "local-demo" }, true],
  ]) await check(`${label}: existing access boundary still controls workspace rendering`, () => {
    let rendered = 0;
    contextModule.setContext(context);
    const Child = () => { rendered += 1; return React.createElement("span", null, "engineering-workspace-probe"); };
    const markup = renderToStaticMarkup(React.createElement(SecureApplicationBoundary, null, React.createElement(Child)));
    assert.equal(rendered, allowed ? 1 : 0); assert.equal(markup.includes("engineering-workspace-probe"), allowed);
  });
} finally { await server.close(); }

await check("Boot stays inside the original security and crash boundaries, without an eager App import", async () => {
  const source = await readFile(path.join(root, "src/main.jsx"), "utf8");
  assert.match(source, /<AppErrorBoundary>[\s\S]*<VoltflowPlatformProvider>[\s\S]*<SecureApplicationBoundary>\s*<DeferredWorkspace/);
  assert.doesNotMatch(source, /import\s+App\s+from/);
});
await check("Loading lifecycle cancels stale updates and honours reduced motion", async () => {
  const component = await readFile(path.join(root, "src/components/DeferredWorkspace.jsx"), "utf8");
  const styles = await readFile(path.join(root, "src/components/DeferredWorkspace.css"), "utf8");
  assert.match(component, /return \(\) => \{ active = false; \}/);
  assert.match(component, /if \(active\) setLoaded/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[^}]*animation: none/);
});

const output = path.join(root, "qa/startup-performance-build");
assert.ok(output.startsWith(path.join(root, "qa") + path.sep));
const previousNodeEnv = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = "production";
  await build({ root, configFile: path.join(root, "vite.config.js"), configLoader: "runner", cacheDir: path.join(root, "qa/.startup-build-cache"), build: { outDir: output, emptyOutDir: false, manifest: true, reportCompressedSize: false } });
} finally { if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv; }
const after = await measureStartupGraph(output);
const baseline = JSON.parse(await readFile(path.join(root, "qa/startup-performance-baseline.json"), "utf8"));
await check("Build manifest proves the engineering workspace is absent from initial static imports", async () => {
  assert.equal(after.appDeferred, true);
  const manifest = JSON.parse(await readFile(path.join(output, ".vite/manifest.json"), "utf8"));
  const html = await readFile(path.join(output, "index.html"), "utf8");
  assert.ok(!html.includes(`href="./${manifest[after.app].file}"`));
});
await check("Initial static JavaScript is within budget, measured across all recursive imports", () => {
  assert.ok(after.gzipBytes <= 180 * 1024, `Initial gzip estimate ${after.gzipBytes} exceeds 180 KiB.`);
  assert.ok(after.gzipBytes <= baseline.gzipBytes * 0.6, "Initial gzip estimate has not improved by at least 40% over the recorded baseline.");
});
const reductionPct = (1 - after.gzipBytes / baseline.gzipBytes) * 100;
await writeFile(path.join(root, "qa/startup-performance-results.json"), JSON.stringify({ scope: "Build graph and synthetic loader / SSR role-rendering checks; not measured page-load time or live authorization proof", baseline, after, reductionPct, results }, null, 2));
console.log(`\n${results.length} startup checks; ${results.filter((result) => result.status === "FAIL").length} failing. Initial gzip estimate reduced ${reductionPct.toFixed(1)}%.`);
process.exitCode = results.some((result) => result.status === "FAIL") ? 1 : 0;
