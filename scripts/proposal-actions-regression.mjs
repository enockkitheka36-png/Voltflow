import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { generateClientExplanation } from "../src/utils/advisory.js";
import { buildReport, reportToText } from "../src/utils/reportBuilder.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({
  root,
  cacheDir: `${root}/qa/.proposal-actions-cache`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, watch: null },
  plugins: [{
    name: "audit-production-proposal-actions",
    enforce: "pre",
    transform(source, identifier) {
      if (!identifier.replaceAll("\\", "/").endsWith("/src/App.jsx")) return null;
      return `${source}\nexport function AuditProposalActions({ input, capture }) { capture(Proposal(input)); return null; }\n`;
    },
  }, react()],
});

const textOf = (value) => Array.isArray(value) ? value.map(textOf).join("") : value && typeof value === "object" ? textOf(value.props?.children) : value == null ? "" : String(value);
const buttonsIn = (value) => {
  if (Array.isArray(value)) return value.flatMap(buttonsIn);
  if (!value || typeof value !== "object") return [];
  return [...(value.type === "button" ? [value] : []), ...buttonsIn(value.props?.children)];
};
let passed = 0;
const check = (name, run) => { run(); passed++; console.log(`PASS: ${name}`); };

try {
  const { AuditProposalActions } = await server.ssrLoadModule("/src/App.jsx");
  const render = (patch = {}) => {
    const toasts = [];
    let tree;
    const input = {
      sizing: { quoteReady: true }, loadItemsV2: [], viewMode: "engineer",
      showToast: (...values) => toasts.push(values),
      projectReadiness: { criticalIssues: [{ label: "Synthetic review item" }], missingFields: [], warnings: [] },
      ...patch,
      project: { client: "SYNTHETIC proposal action test", assetSelections: [], batteryChemistry: "LFP", ...patch.project },
    };
    renderToStaticMarkup(React.createElement(AuditProposalActions, { input, capture(value) { tree = value; } }));
    const button = (name) => {
      const result = buttonsIn(tree).find((item) => textOf(item.props.children) === name);
      assert.ok(result, `Production button exists: ${name}`);
      return result;
    };
    return { button, toasts, markup: () => renderToStaticMarkup(tree) };
  };

  for (const label of ["Download PDF Quotation 📥", "Download Full Report (+ Simulation + Load/BOS) 📋"]) {
    check(`${label}: real click handler reaches readiness review without an undefined variable`, () => {
      const result = render();
      assert.doesNotThrow(() => result.button(label).props.onClick());
      assert.match(result.toasts[0]?.[0] || "", /Action needed:/);
    });
    check(`${label}: stale selected design is rejected before generation`, () => {
      const result = render({ project: { selectedDesignOption: { inputs_hash: "old" }, designRevision: { inputs_hash: "current" } } });
      result.button(label).props.onClick();
      assert.match(result.toasts[0]?.[0] || "", /STALE_DESIGN/);
    });
    check(`${label}: blocked sizing disables export and handler remains guarded`, () => {
      const result = render({ sizing: { quoteReady: false, quoteBlockedReason: "Synthetic blocked match" } });
      assert.equal(result.button(label).props.disabled, true);
      result.button(label).props.onClick();
      assert.match(result.toasts[0]?.[0] || "", /Synthetic blocked match/);
    });
    check(`${label}: current design reaches the queued generation callback`, () => {
      const result = render({ project: { selectedDesignOption: { inputs_hash: "current" }, designRevision: { inputs_hash: "current" } }, projectReadiness: null });
      const timers = [];
      const originalTimer = globalThis.setTimeout;
      globalThis.setTimeout = (callback, delay) => { timers.push({ callback, delay }); return 0; };
      try { result.button(label).props.onClick(); }
      finally { globalThis.setTimeout = originalTimer; }
      assert.equal(timers.length, 1);
      assert.equal(typeof timers[0].callback, "function");
      assert.equal(result.toasts.length, 0);
    });
  }

  check("All four formal report handlers reject a stale design without throwing", () => {
    const result = render({ project: { selectedDesignOption: { inputs_hash: "old" }, designRevision: { inputs_hash: "current" } } });
    for (const label of ["Client Proposal PDF", "Engineer Review PDF", "Technician Handover PDF", "Lender / Grant Readiness Report PDF"]) {
      assert.doesNotThrow(() => result.button(label).props.onClick());
      assert.match(result.toasts.at(-1)?.[0] || "", /STALE_DESIGN/);
    }
  });

  for (const label of ["Client Proposal PDF", "Engineer Review PDF", "Technician Handover PDF", "Lender / Grant Readiness Report PDF"]) {
    check(`${label}: current design reaches generation without an undefined variable`, () => {
      const result = render();
      const timers = [];
      const originalTimer = globalThis.setTimeout;
      globalThis.setTimeout = (callback, delay) => { timers.push({ callback, delay }); return 0; };
      try { result.button(label).props.onClick(); }
      finally { globalThis.setTimeout = originalTimer; }
      assert.equal(timers.length, 1);
      assert.equal(typeof timers[0].callback, "function");
    });
  }

  check("Blocked equipment suppresses sales recommendations and performance promises", () => {
    const sizing = { quoteReady: false, quoteBlockedReason: "Equipment matching unverified", equipment: { enabled: true, quoteReady: false }, actualKwp: 3.52, batteryKwh: 10.8, inverterKw: 5, annualEnergy: 5612, autonomyHours: 30.5, annualSavings: 53856 };
    const explanation = generateClientExplanation({}, sizing, null);
    assert.match(explanation.recommendation, /Resolve equipment matching/);
    assert.match(explanation.whatItWillDo, /claims are on hold/);
    assert.doesNotMatch(Object.values(explanation).join(" "), /3\.5|10\.8|5,612|30\.5|4,488|We recommend a/);
  });

  check("Other blocked sizing also withholds commercial recommendations", () => {
    assert.match(generateClientExplanation({}, { quoteReady: false }, null).whatItWillDo, /claims are on hold/);
  });

  check("Blocked proposal print is disabled and the handler cannot print", () => {
    const result = render({ sizing: { quoteReady: false, quoteBlockedReason: "Synthetic blocked match" } });
    assert.equal(result.button("Print Page Format").props.disabled, true);
    assert.doesNotThrow(() => result.button("Print Page Format").props.onClick());
    assert.match(result.toasts.at(-1)?.[0] || "", /Synthetic blocked match/);
  });

  check("Default earthing is labelled as an assumption, not a confirmed survey fact", () => {
    const markup = render({ survey: { earthingAvailable: true } }).markup();
    assert.match(markup, /Earthing Available \(Assumption/);
    assert.doesNotMatch(markup, /Earthing ✅ Confirmed/);
  });

  check("Roof capacity is not labelled as the number of installed panels", () => {
    const markup = render({ simulation: {}, panelLayout: { requiredPanels: 8, estimatedPanelsThatFit: 36 } }).markup();
    assert.match(markup, /Estimated roof capacity \(panels\)/);
    assert.doesNotMatch(markup, /Estimated Panels Fitted/);
  });

  check("Backup-hour explanation states the daily-average assumption", () => {
    const explanation = generateClientExplanation({}, { quoteReady: true, autonomyHours: 30.5 }, null);
    assert.match(explanation.whatItWillDo, /daily-average planning estimate, not guaranteed continuous runtime/);
  });

  check("Disabled borehole data cannot add pump recommendations or disclaimers to any report", () => {
    for (const mode of ["client", "engineer", "technician", "lender"]) {
      const report = buildReport(mode, { project: { borehole: { enabled: false } }, borehole: { suggestedPumpHp: 0.5 }, boreholeChecklist: { checklist: ["Synthetic stale borehole checklist"] } });
      assert.doesNotMatch(reportToText(report), /Suggested pump|Solar borehole & water pumping|Synthetic stale borehole checklist|Final borehole pump selection/);
    }
  });

  check("Load and import restore the save-name field in their shared normalization path", () => {
    const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
    const start = source.indexOf("const applyNormalizedRecord = (record) => {");
    const handler = source.slice(start, source.indexOf("const loadProject =", start));
    assert.match(handler, /record\?\.name, norm\.project\.client, norm\.survey\.clientName/);
    assert.match(handler, /setSaveName\(loadedSaveName \|\| "Untitled Project"\)/);
  });

  console.log(`\n${passed} proposal action checks; 0 failing.`);
} finally {
  await server.close();
}

await import("./pdf-layout-regression.mjs");
