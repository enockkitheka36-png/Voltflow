import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openSizingAuditRuntime } from './lib/sizingAuditRuntime.mjs';
import { DEMO_PROJECTS, createProjectFromDemo } from '../src/utils/demoProjects.js';
import { computeOptionSizing } from '../src/utils/designRevision.js';
import { computeInverterSizing } from '../src/utils/inverterCoherence.js';
import { calculateReadiness, computeGovernanceStatus } from '../src/utils/readiness.js';

const runtime = await openSizingAuditRuntime();
const checks = [];
const examples = [];
const close = (actual, expected, label) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(0.011, Math.abs(expected) * 1e-9),
  `${label}: actual ${actual}; expected ${expected}`,
);
function check(label, action) {
  try { action(); checks.push({ label, status: 'PASS' }); }
  catch (error) { checks.push({ label, status: 'FAIL', detail: error.message }); }
}
function verifyMath(label, project, loads) {
  const sized = runtime.size(project, loads);
  const expectedDaily = loads.reduce((sum, load) => sum + load.qty * load.watts * (load.dayHours + load.nightHours) / 1000, 0);
  const critical = loads.filter(load => load.critical).reduce((sum, load) => sum + load.qty * load.watts * (load.dayHours + load.nightHours) / 1000, 0);
  const losses = [Math.max(0, (project.cellTemp - 25) * Math.abs(project.temperatureCoeffPmax)), project.soilingLoss, project.lidLoss, project.mismatchLoss, project.shadingLoss, project.dcCableLoss, project.acCableLoss, project.availabilityLoss];
  const expectedPr = Math.min(0.95, Math.max(0.45, losses.reduce((product, loss) => product * (1 - Math.max(0, Math.min(0.4, loss))), 1) * Math.min(0.99, Math.max(0.75, project.inverterEfficiency))));
  const designDaily = project.systemType === 'Mini-grid'
    ? project.mgHouseholds * project.mgHouseholdLoadKwh + project.mgCommercialCustomers * project.mgCommercialLoadKwh + project.mgAnchorLoad * 12
    : project.systemType === 'EV charging'
      ? ({ L1: 3.7, L2: 7.4, DCFC50: 50, DCFC150: 150, HPC350: 350 }[project.evChargerType] || 7.4) * project.evChargersTotal * project.evDailyChargingHours * project.evOccupancy
      : expectedDaily;
  const expectedPanels = Math.max(1, Math.ceil(designDaily * project.solarCoverage / Math.max(project.psh * expectedPr, 0.1) * 1000 / project.panelW));
  const expectedBatteryEnergy = ['Off-grid', 'Mini-grid'].includes(project.systemType)
    ? designDaily * project.autonomyDays : critical * project.backupHours / 24;
  check(`${label}: load energy, PR, PV rounding and yield`, () => {
    close(sized.dailyKwh, expectedDaily, 'daily kWh');
    close(sized.designDailyKwh, designDaily, 'design daily kWh');
    close(sized.pr, expectedPr, 'performance ratio');
    assert.equal(sized.panels, expectedPanels);
    close(sized.annualEnergy, expectedPanels * project.panelW / 1000 * project.psh * expectedPr * 365, 'annual yield');
    close(sized.annualEnergyP90, sized.annualEnergy * project.p90Factor, 'P90 assumption');
  });
  check(`${label}: battery units and nominal-to-usable energy`, () => {
    close(sized.backupEnergyNeed, expectedBatteryEnergy, 'backup energy');
    close(sized.batteryKwh, sized.batteryModules * project.batteryModuleKwh, 'nominal battery kWh');
    close(sized.usableBatteryKwh, sized.batteryKwh * project.dod * project.batteryEfficiency, 'usable battery kWh');
    assert.ok(sized.usableBatteryKwh + 1e-9 >= expectedBatteryEnergy);
  });
  check(`${label}: quote line, contingency and tax reconciliation`, () => {
    close(sized.quote.lines.reduce((sum, line) => sum + line.gross_amount, 0), sized.totalCost, 'gross quote');
    close(sized.subtotal + sized.vatAmount, sized.totalCost, 'net + VAT');
    close(sized.quote.lines.reduce((sum, line) => sum + line.tax_amount, 0), sized.vatAmount, 'line tax');
  });
  check(`${label}: NPV and year-by-year cash ledger`, () => {
    const ledger = sized.annualRows;
    const investment = project.systemType === 'Mini-grid' ? sized.miniGridTotalCost : sized.totalCost;
    const expectedNpv = ledger.reduce((sum, row) => sum + row.netY / (1 + project.discountRate) ** row.year, -investment);
    close(sized.npvLife, expectedNpv, 'NPV includes full investment');
    close(ledger.at(-1).cumulativeProjectCash, -investment + ledger.reduce((sum, row) => sum + row.netY, 0), 'cash ledger');
    const rate = project.loanInterest;
    const principal = investment * project.debtShare;
    const debt = principal === 0 ? 0 : rate === 0 ? principal / project.loanTerm : principal * rate / (1 - (1 + rate) ** -project.loanTerm);
    close(sized.annualDebtService, debt, 'annual loan payment');
  });
  examples.push({ label, dailyKwh: sized.designDailyKwh, pvKwp: sized.actualKwp, batteryKwh: sized.batteryKwh, inverterKw: sized.inverterKw, totalCost: sized.totalCost, annualNet: sized.annualNet });
  return sized;
}

try {
  for (const demo of DEMO_PROJECTS) {
    const { project, loads } = createProjectFromDemo(runtime.defaults, demo.id);
    const sized = verifyMath(demo.label, project, loads);
    const option = computeOptionSizing(project, loads);
    check(`${demo.label}: alternative option agrees with main sizing`, () => {
      close(option.dailyKwh, sized.designDailyKwh, 'daily energy');
      close(option.actualKwp, sized.actualKwp, 'PV kWp');
      close(option.battKwh, sized.batteryKwh, 'battery kWh');
      close(option.invKw, sized.inverterKw, 'inverter kW');
      close(option.totalCost, sized.totalCost, 'quote total');
      close(option.annualNet, sized.annualNet, 'annual benefit');
    });
  }
  const base = createProjectFromDemo(runtime.defaults, 'residential_karen');
  for (let sample = 1; sample <= 100; sample++) {
    const project = { ...base.project, systemType: sample % 3 === 0 ? 'Off-grid' : 'Solar PV – Hybrid', psh: 3.5 + sample % 36 / 10, debtShare: sample % 4 / 10, loanInterest: sample % 5 === 0 ? 0 : 0.12 };
    const loads = [{ id: 1, name: 'Synthetic bounded audit load', qty: 1 + sample % 5, watts: 80 + sample * 7, dayHours: sample % 12, nightHours: 1 + sample % 10, surge: 1 + sample % 3, critical: true }];
    verifyMath(`Bounded scenario ${sample}`, project, loads);
  }
  for (const loads of [[], [{ id: 1, name: 'Invalid hours', qty: 1, watts: 100, dayHours: 20, nightHours: 10, surge: 1, critical: true }]]) {
    check(`Invalid or empty inventory ${checks.length}: fail closed`, () => {
      const sized = runtime.size(base.project, loads);
      assert.equal(sized.quoteReady, false);
      assert.equal(sized.loadInventoryBlocked, true);
      assert.equal(sized.totalCost, 0);
      assert.equal(sized.investmentCost, 0);
      assert.equal(sized.actualKwp, 0);
    });
  }
  check('Catalogue overflow: oversized demand is not marked supported', () => {
    const sized = computeInverterSizing({ connectedW: 200000, surgeKw: 300, actualKwp: 150 });
    assert.equal(sized.loadSupported, false);
  });
  check('Unknown cable size is not marked ampacity-checked', () => {
    const sized = runtime.size({ ...base.project, dcCableSizeMm2: 7, acCableSizeMm2: 7 }, base.loads);
    assert.equal(sized.dcCableAmpacityOk, false);
    assert.equal(sized.acCableAmpacityOk, false);
  });
  check('Mini-grid anchor demand retained by alternative options', () => {
    const project = { ...base.project, systemType: 'Mini-grid', mgAnchorLoad: 5 };
    const sized = runtime.size(project, base.loads);
    close(computeOptionSizing(project, base.loads).dailyKwh, sized.designDailyKwh, 'anchor energy');
  });
  check('EV peak buffer retained by alternative options', () => {
    const project = { ...base.project, systemType: 'EV charging', evBatteryBufferEnabled: true, evPeakBufferHours: 4 };
    const sized = runtime.size(project, base.loads);
    close(computeOptionSizing(project, base.loads).battKwh, sized.batteryKwh, 'EV buffer');
  });
  for (const basis of ['auto_engineering', 'backup_peak_led', 'pv_ratio_led', 'manual_review']) {
    check(`Inverter basis ${basis}: alternative and main agree`, () => {
      const project = { ...base.project, inverterSizingBasis: basis, manualInverterKw: 3, panelCost: 23000.13, epcCost: 108000.37, mountingPerPanel: 4750.33 };
      const sized = runtime.size(project, base.loads);
      const option = computeOptionSizing(project, base.loads);
      close(option.invKw, sized.inverterKw, 'selected inverter');
      close(option.totalCost, sized.totalCost, 'rounded quote');
    });
  }
  check('Tiny load: assumed self-consumed energy never exceeds annual demand', () => {
    const loads = [{ id: 1, name: 'Tiny test load', qty: 1, watts: 10, dayHours: 1, nightHours: 1, surge: 1, critical: true }];
    const sized = runtime.size({ ...base.project, capSavingsToBill: false }, loads);
    assert.ok(sized.annualSavings / base.project.gridTariff <= sized.designDailyKwh * 365 + 1e-9);
  });
  check('All-negative cash flows: IRR is unavailable, not an invented return', () => {
    const sample = createProjectFromDemo(runtime.defaults, 'offgrid_farm');
    assert.equal(runtime.size(sample.project, sample.loads).irrLife, null);
  });
  check('Reported IRR must solve the actual cash-flow equation', () => {
    const sized = runtime.size(base.project, base.loads);
    assert.ok(Number.isFinite(sized.irrLife));
    const residual = sized.annualRows.reduce((sum, row) => sum + row.netY / (1 + sized.irrLife) ** row.year, -sized.investmentCost);
    assert.ok(Math.abs(residual) < 0.02, `IRR cash-flow residual ${residual}`);
  });
  check('Oversized inverter demand blocks governance and quote readiness', () => {
    const loads = [{ id: 1, name: 'Oversized synthetic motor', qty: 1, watts: 200000, dayHours: 4, nightHours: 4, surge: 3, critical: true }];
    const sized = runtime.size(base.project, loads);
    const readiness = calculateReadiness(base.project, loads, {}, sized);
    assert.equal(computeGovernanceStatus(base.project, sized, readiness).status, 'Engineering review required');
    assert.equal(sized.quoteReady, false);
  });
  check('Single- and three-phase currents use their corresponding voltage basis', () => {
    const single = runtime.size({ ...base.project, phase: 'Single Phase (230V)', acVoltage: 230 }, base.loads);
    const three = runtime.size({ ...base.project, phase: 'Three Phase (400V)', acVoltage: 400 }, base.loads);
    close(single.acCurrent, single.inverterKw * 1000 / 230, 'single-phase current');
    close(three.acCurrent, three.inverterKw * 1000 / (400 * Math.sqrt(3)), 'three-phase current');
  });
  check('Higher demand never reduces required PV or nominal battery capacity', () => {
    const lower = runtime.size(base.project, base.loads);
    const higher = runtime.size(base.project, base.loads.map(load => ({ ...load, qty: load.qty * 2 })));
    assert.ok(higher.actualKwp >= lower.actualKwp);
    assert.ok(higher.batteryKwh >= lower.batteryKwh);
  });
  const miniGrid = createProjectFromDemo(runtime.defaults, 'minigrid');
  assert.ok(miniGrid, 'Mini-grid audit fixture exists');
  verifyMath('Mini-grid with debt and distribution', { ...miniGrid.project, debtShare: 0.6, loanInterest: 0.12 }, miniGrid.loads);
  const report = { generatedAt: new Date().toISOString(), scope: 'Local production hook via SSR transform; no live cloud, hourly dispatch or engineering certification proof', passed: checks.filter(check => check.status === 'PASS').length, failed: checks.filter(check => check.status === 'FAIL').length, checks, examples: examples.slice(0, DEMO_PROJECTS.length) };
  await fs.mkdir(new URL('../qa/', import.meta.url), { recursive: true });
  await fs.writeFile(new URL('../qa/sizing-audit-results.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, failures: checks.filter(check => check.status === 'FAIL'), examples: report.examples }, null, 2));
  if (report.failed) process.exitCode = 1;
} finally {
  await runtime.close();
}
