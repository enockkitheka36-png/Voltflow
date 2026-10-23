import { jsPDF } from 'jspdf';
import { BLUEPRINT_TEMPLATES } from './loadEngine.js';
import { getCableEstimates } from './installerSimulation.js';

// Helper to format currency
const nf = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });
const money = (v) => `KES ${nf.format(Number.isFinite(v) ? v : 0)}`;
const num = (v, d = 1) => Number.isFinite(Number(v || 0)) ? Number(v || 0).toFixed(d) : 'N/A';
const pct = (v) => Number.isFinite(Number(v || 0)) ? `${(Number(v || 0) * 100).toFixed(1)}%` : 'N/A';

/**
 * Build the quotation PDF and return the jsPDF doc object WITHOUT saving.
 * Callers can append pages then call doc.save() themselves.
 */
export function buildQuotationPDF(project, sizing, loads) {
  if (project.equipmentSelection?.enabled && (!sizing.equipment?.quoteReady || sizing.quoteReady === false)) throw new Error("Resolve equipment matching and sizing checks before generating a quotation.");
  // Create a standard A4 portrait PDF (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2); // 180mm
  const quotationDate = new Date().toLocaleDateString('en-KE');
  const quotationReference = project.projectRef?.reference || `SOL-${Date.now().toString().slice(-6)}`;

  let y = 18;

  // Helpers to draw headers and text
  const printHeader = () => {
    y = 18;
    // Top Color bar
    doc.setFillColor(16, 185, 129); // Emerald Primary
    doc.rect(0, 0, pageWidth, 5, 'F');

    // Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text('SOLARISE PRO', margin, y);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text('Powered by Voltflow · Quality Solar PV, Storage & Hybrid Energy Suites across East Africa', margin, y + 5);

    // Right header metadata
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(project.equipmentSelection?.enabled ? sizing.equipment?.commercialBasis === 'SUPPLIER_QUOTE' ? 'DRAFT QUOTATION' : 'DRAFT ESTIMATE' : 'OFFICIAL QUOTATION', pageWidth - margin, y, { align: 'right' });
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${quotationDate}`, pageWidth - margin, y + 4.5, { align: 'right' });
    doc.text(`Ref: ${quotationReference}`, pageWidth - margin, y + 8, { align: 'right' });

    // Divider Line
    doc.setDrawColor(226, 232, 240); // Slate border
    doc.setLineWidth(0.5);
    doc.line(margin, y + 11, pageWidth - margin, y + 11);
    y += 18;
  };

  printHeader();

  // Client Details Box
  const metadataColumns = [
    [['Client Name', project.client], ['Location', project.location], ['Prepared By', project.preparedBy]],
    [['System Type', project.systemType], ['Connection Phase', project.phase], ['Design Stage', project.designStage || 'Feasibility']],
  ];
  const metadataColumnWidth = (contentWidth - 16) / 2;
  const metadataValueOffset = 33;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  const metadataRows = metadataColumns[0].map((field, rowIndex) => metadataColumns.map((column) => ({
    label: column[rowIndex][0],
    lines: doc.splitTextToSize(String(column[rowIndex][1] || 'N/A'), metadataColumnWidth - metadataValueOffset),
  })));
  const metadataRowHeights = metadataRows.map((row) => Math.max(...row.map((field) => field.lines.length)) * 4.2 + 2.5);
  const metadataHeight = 14 + metadataRowHeights.reduce((total, height) => total + height, 0);
  doc.setFillColor(248, 250, 252); // Pale Slate background
  doc.rect(margin, y, contentWidth, metadataHeight, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, metadataHeight, 'S');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('PROJECT METADATA', margin + 5, y + 6);

  // Divider inside metadata box
  doc.setLineWidth(0.2);
  doc.line(margin + 5, y + 8, margin + contentWidth - 5, y + 8);

  let metadataRowY = y + 14;
  metadataRows.forEach((row, rowIndex) => {
    row.forEach((field, columnIndex) => {
      const columnX = margin + 6 + columnIndex * (metadataColumnWidth + 4);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`${field.label}:`, columnX, metadataRowY);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      field.lines.forEach((line, lineIndex) => doc.text(line, columnX + metadataValueOffset, metadataRowY + lineIndex * 4.2));
    });
    metadataRowY += metadataRowHeights[rowIndex];
  });

  y += metadataHeight + 6;

  // Technical Sizing Results
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('ENGINEERING SIZING METRICS', margin, y);
  y += 4;

  const colWidth = contentWidth / 4;
  const metrics = [
    { label: 'PV ARRAY SIZE', val: `${num(sizing.actualKwp, 2)} kWp`, desc: `${sizing.panels} modules x ${project.panelW}W` },
    { label: 'BATTERY BANK', val: `${num(sizing.batteryKwh, 1)} kWh`, desc: `${sizing.batteryModules} modules (${project.batteryChemistry})` },
    { label: 'INVERTER', val: `${num(sizing.inverterKw, 1)} kW`, desc: `${String(project.phase || 'Single phase').split(' ')[0]} Phase` },
    { label: 'TOTAL CAPEX', val: money(sizing.totalCost), desc: 'Including VAT' }
  ];

  metrics.forEach((metric, index) => {
    const xOffset = margin + (index * colWidth);
    doc.setFillColor(248, 250, 252);
    doc.rect(xOffset, y, colWidth - 2, 22, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(xOffset, y, colWidth - 2, 22, 'S');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(metric.label, xOffset + 4, y + 5);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(metric.val, xOffset + 4, y + 12);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('Helvetica', 'normal');
    doc.text(metric.desc, xOffset + 4, y + 18);
  });

  y += 28;

  // Performance and Yields
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('PERFORMANCE & ECONOMICS', margin, y);
  y += 4;

  const econMetrics = [
    { label: 'SYSTEM PR', val: pct(sizing.pr), desc: 'Computed loss standard' },
    { label: 'ANNUAL YIELD', val: `${num(sizing.annualEnergy, 0)} kWh`, desc: 'P50 Annual estimate' },
    { label: 'SIMPLE PAYBACK', val: Number.isFinite(sizing.payback) ? `${num(sizing.payback, 1)} Years` : 'Not reached', desc: 'P50 Baseline' },
    { label: 'LCOE P50', val: `${num(sizing.lcoe, 1)} KES/kWh`, desc: 'Levelised Energy Cost' }
  ];

  econMetrics.forEach((metric, index) => {
    const xOffset = margin + (index * colWidth);
    doc.setFillColor(248, 250, 252);
    doc.rect(xOffset, y, colWidth - 2, 22, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(xOffset, y, colWidth - 2, 22, 'S');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(metric.label, xOffset + 4, y + 5);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(metric.val, xOffset + 4, y + 12);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('Helvetica', 'normal');
    doc.text(metric.desc, xOffset + 4, y + 18);
  });

  y += 30;

  // Bill of Quantities Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('BILL OF QUANTITIES (BOQ) BUILDUP', margin, y);
  y += 4;

  // Table setup
  const headers = ['#', 'Description', 'Qty', 'Unit', 'Unit Cost (KES)', 'Total Cost (KES)'];
  const colSizes = [10, 75, 12, 12, 35, 36];

  let tempX = margin;
  const drawTableHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    tempX = margin;
    headers.forEach((header, index) => {
      const align = index >= 4 ? 'right' : 'left';
      const cellPadding = index >= 4 ? colSizes[index] - 4 : 3;
      doc.text(header, tempX + cellPadding, y + 5.5, { align });
      tempX += colSizes[index];
    });
    y += 8;
  };
  if (y + 22 > pageHeight - margin) { doc.addPage(); printHeader(); }
  drawTableHeader();

  // Compile BOQ rows
  const boqRows = [
    ["1.1", sizing.equipment?.models?.panel || "PV Panels", sizing.panels, "panels", project.panelCost, sizing.pvCost],
    ["1.2", "Mounting rails, clamps & structural hardware", sizing.panels, "sets", project.mountingPerPanel, sizing.mountingCost],
    ["2.1", sizing.equipment?.models?.inverter || "Hybrid/Grid-tied inverter suite", 1, "unit", sizing.inverterCost, sizing.inverterCost],
    ["3.1", sizing.equipment?.models?.battery || `Battery modules (${project.batteryChemistry})`, sizing.batteryModules, "units", project.batteryModuleCost, sizing.batteryModules * project.batteryModuleCost],
    ["3.2", "Battery rack, active BMS & interconnects", 1, "lot", 16000, 16000],
    ["4.1", "DC/AC cabling, breakers, SPDs, earthing lot", 1, "lot", project.cablingProtectionCost, project.cablingProtectionCost],
    ["5.1", "IoT monitoring datalogger module", 1, "lot", project.monitoringCost, project.monitoringCost],
    ["10.1", "Installation, commissioning, SLD & training", 1, "lot", project.epcCost, project.epcCost],
    ["", "EPC Contingency Allowance", 1, "lot", sizing.contingencyAmount, sizing.contingencyAmount],
    ["", `Value Added Tax (${((Number(project.vat) || 0) * 100).toFixed(0)}%)`, 1, "tax", sizing.quote?.tax ?? sizing.vatAmount, sizing.quote?.tax ?? sizing.vatAmount],
  ];

  // Specialist capex is already inside sizing.contingencyAmount + sizing.vatAmount (included in base).
  // Show as informational breakdown lines (col 5 = 0) so grandTotal = sizing.totalCost.
  if (project.systemType === "Genset hybrid") {
    boqRows.splice(8, 0, ["6.1", "Genset ATS Integration & commissioning (incl. in system cost)", 1, "lot", 85000, 0]);
  }
  if (project.systemType === "EV charging") {
    const evUnitCost = evChargerSpecs[project.evChargerType]?.unitCost ?? 180000;
    const evCableCost = project.evChargersTotal * 25000;
    const ocppCost = sizing.ocppRequired ? 48000 : 0;
    boqRows.splice(8, 0,
      ["6.1", "EV AC/DC charger units (incl. in system cost)", project.evChargersTotal, "units", evUnitCost, 0],
      ["6.2", "EV supply cabling & bay build (incl. in system cost)", project.evChargersTotal, "bays", 25000, 0]
    );
    if (sizing.ocppRequired) boqRows.splice(10, 0, ["6.3", "OCPP smart charging software (incl. in system cost)", 1, "lot", ocppCost, 0]);
  }
  if (project.systemType === "Mini-grid") {
    boqRows.splice(8, 0,
      ["7.1", "LV distribution line, poles & service cables", 1, "lot", project.mgCapexDistribution, project.mgCapexDistribution],
      ["7.2", "Smart meters (incl. in system cost)", sizing.totalSubscribers, "units", 6500, 0],
      ["7.3", "SCADA / billing integration (incl. in system cost)", 1, "lot", 85000, 0]
    );
  }

  const grandTotal = sizing.quote?.total_gross ?? sizing.totalCost;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  boqRows.forEach((row, rowIndex) => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    const descriptionLines = doc.splitTextToSize(String(row[1]), colSizes[1] - 6);
    const rowHeight = Math.max(7, descriptionLines.length * 3.5 + 3);
    if (y + rowHeight > pageHeight - margin) { doc.addPage(); printHeader(); drawTableHeader(); }
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    // Alternate row backgrounds
    if (rowIndex % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    tempX = margin;
    row.forEach((cell, cellIndex) => {
      const align = (cellIndex >= 4) ? 'right' : 'left';
      const cellPadding = (cellIndex >= 4) ? colSizes[cellIndex] - 4 : 3;
      
      let textVal = cell;
      if (cellIndex === 4 || cellIndex === 5) {
        textVal = nf.format(cell);
      }
      
      if (cellIndex === 1) descriptionLines.forEach((line, lineIndex) => doc.text(line, tempX + cellPadding, y + 5 + lineIndex * 3.5));
      else doc.text(String(textVal), tempX + cellPadding, y + 5, { align });
      tempX += colSizes[cellIndex];
    });

    y += rowHeight;
  });

  // Grand Total Row
  if (y + 12 > pageHeight - margin) { doc.addPage(); printHeader(); }
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentWidth, 9, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL INCL. VAT', margin + 3, y + 6);
  doc.text(money(grandTotal), margin + contentWidth - 4, y + 6, { align: 'right' });

  y += 18;

  // If there are safety warnings, print a signature and compliance block on a new page or fit if space is available
  // Engineering Warnings Banner if present
  if (sizing.warnings && sizing.warnings.length > 0) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    const warningLines = sizing.warnings.flatMap((warning) => doc.splitTextToSize(`- ${String(warning).replace(/[\u2600-\u27BF\uFE0F]/g, '')}`, contentWidth - 10));
    let warningOffset = 0;
    while (warningOffset < warningLines.length) {
      if (y + 20 > pageHeight - margin) { doc.addPage(); printHeader(); }
      const count = Math.min(warningLines.length - warningOffset, Math.max(1, Math.floor((pageHeight - margin - y - 14) / 3.8)));
      const bannerHeight = 14 + count * 3.8;
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(253, 230, 138);
      doc.rect(margin, y, contentWidth, bannerHeight, 'FD');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 53, 15);
      doc.text('ENGINEERING COMPLIANCE & SAFETY WARNINGS:', margin + 4, y + 5);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      warningLines.slice(warningOffset, warningOffset + count).forEach((line, lineIndex) => doc.text(line, margin + 5, y + 10 + lineIndex * 3.8));
      warningOffset += count;
      y += bannerHeight + 6;
    }
  }

  if (y > pageHeight - 35) {
    doc.addPage();
    y = 15;
    printHeader();
    y += 10;
  }

  // Blueprint / New Construction Assumptions (v11.1) — shown when sizing is not
  // based on an existing, measurable site.
  if (project.sizingMode && project.sizingMode !== 'existing_site') {
    const bp = project.blueprint || {};
    const tpl = BLUEPRINT_TEMPLATES.find(t => t.key === bp.buildingType);
    const bpRows = [
      ['Sizing basis', project.sizingMode === 'blueprint_new_build' ? 'Blueprint / new construction' : 'Future expansion'],
      ['Building type', tpl ? tpl.label : (bp.buildingType || '—')],
      ['Floor area', bp.floorAreaM2 ? `${bp.floorAreaM2} m²` : '—'],
      ['Occupancy', bp.occupancy || '—'],
      ['Operating schedule', bp.scheduleHoursPerDay ? `${bp.scheduleHoursPerDay} h/day` : '—'],
      ['Future growth margin', bp.futureGrowthPct != null ? `${bp.futureGrowthPct}%` : '—'],
      ['Assumption confidence', bp.confidenceLevel || 'medium'],
    ];
    const bpHeight = 12 + bpRows.length * 4.5 + 12;
    if (y > pageHeight - (bpHeight + 20)) { doc.addPage(); y = 15; printHeader(); y += 10; }
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(252, 211, 77);
    doc.rect(margin, y, contentWidth, bpHeight, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 53, 15);
    doc.text('BLUEPRINT / NEW CONSTRUCTION ASSUMPTIONS', margin + 4, y + 6);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    bpRows.forEach(([k, v], i) => {
      doc.setTextColor(120, 53, 15);
      doc.text(`${k}:`, margin + 5, y + 12 + i * 4.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(v), margin + 55, y + 12 + i * 4.5);
    });
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 15);
    doc.text(
      'This proposal is based on blueprint-stage assumptions. Final sizing must be reviewed once the equipment schedule, MEP drawings, or actual operating loads are confirmed.',
      margin + 4, y + 12 + bpRows.length * 4.5 + 3, { maxWidth: contentWidth - 8 }
    );
    y += bpHeight + 8;
    if (y > pageHeight - 35) { doc.addPage(); y = 15; printHeader(); y += 10; }
  }

  // Legal Disclaimer
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const disclaimerText = 'Disclaimer: This document is a feasibility-level system sizing and financial estimate. Final cable ampacity, protection coordination, earthing/bonding, SPD selection, KPLC/EPRA interconnection approval, and commissioning tests must be verified by qualified personnel before installation. Produced by Solarise Insight Limited.';
  const disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  const preparedByLines = doc.splitTextToSize(String(project.preparedBy || 'Solarise Lead Engineer'), 90);
  const closingHeight = disclaimerLines.length * 3.5 + 24 + preparedByLines.length * 3.5;
  if (y + closingHeight > pageHeight - margin) { doc.addPage(); printHeader(); }
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  disclaimerLines.forEach((line, lineIndex) => doc.text(line, margin, y + lineIndex * 3.5));

  y += disclaimerLines.length * 3.5 + 6;

  // Signatures
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Prepared By:', margin, y);
  doc.line(margin, y + 12, margin + 50, y + 12);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  preparedByLines.forEach((line, lineIndex) => doc.text(line, margin, y + 15 + lineIndex * 3.5));

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Approved / Client Acceptance:', margin + 110, y);
  doc.line(margin + 110, y + 12, margin + 165, y + 12);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Name / Signature / Date', margin + 110, y + 15);

  return doc; // Caller saves — allows appendSimulationSummary before saving
}

/**
 * Generate and immediately download the quotation PDF (engineering/financial only).
 * Backward-compatible with existing call sites.
 */
export function generateQuotationPDF(project, sizing, loads) {
  const doc = buildQuotationPDF(project, sizing, loads);
  const filename = `${(project.client || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_solar_quotation.pdf`;
  doc.save(filename);
}

/**
 * Generate and download the full PDF: engineering proposal + installer simulation
 * summary + load assessment / accessories summary (v10).
 * @param {object} project
 * @param {object} sizing
 * @param {Array}  loads
 * @param {object} simulation   - v8.5 simulation state
 * @param {object} panelLayout  - from estimatePanelLayout
 * @param {object} stringPlan   - from generateStringPlan
 * @param {object} [loadAccessoriesData] - { loadSummary, loadWarnings, dataLoggerRecommendation, accessoriesBoQ } (v10, optional)
 */
export function generateFullPDF(project, sizing, loads, simulation, panelLayout, stringPlan, loadAccessoriesData, simulationExtras) {
  const doc = buildQuotationPDF(project, sizing, loads);
  appendSimulationSummary(doc, project, sizing, simulation, panelLayout, stringPlan, simulationExtras);
  if (loadAccessoriesData) {
    appendLoadAndAccessoriesSummary(doc, project, loadAccessoriesData);
  }
  const filename = `${(project.client || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_solarise_full_report.pdf`;
  doc.save(filename);
}

/**
 * Append installer simulation summary page(s) to an existing jsPDF doc object.
 * Called optionally — safe to skip if simulation is null/undefined.
 *
 * @param {object} doc        - jsPDF instance
 * @param {object} project    - Project state
 * @param {object} sizing     - useSizing output
 * @param {object} simulation - simulation state (may be null for old saves)
 * @param {object} panelLayout - estimatePanelLayout output
 * @param {object} stringPlan  - generateStringPlan output
 */
export function appendSimulationSummary(doc, project, sizing, simulation, panelLayout, stringPlan, extras) {
  if (!doc || !simulation) return;
  const roofGeometry = extras?.roofGeometry || {};
  const simWarnings  = Array.isArray(extras?.simWarnings) ? extras.simWarnings : [];

  const margin       = 15;
  const pageWidth    = 210;
  const contentWidth = pageWidth - margin * 2;
  let y              = 20;

  doc.addPage();

  // Section header
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('INSTALLER SIMULATION SUMMARY', margin, y);
  y += 7;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Planning guide — for technician reference. Not a structural, wind loading, or licensed engineering document.', margin, y);
  y += 10;

  const drawRow = (label, value, bold = false) => {
    doc.setFont('Helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(label + ':', margin, y);
    doc.setFont('Helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(value || '—'), margin + 70, y);
    y += 6;
  };

  const drawSection = (title) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(title, margin, y);
    y += 7;
  };

  // Table 1: Roof layout summary
  drawSection('Table 1 — Roof Layout Summary');
  drawRow('Roof fit status',       panelLayout?.roofFitStatus || '—');
  drawRow('Panels required',       sizing?.panels || '—');
  drawRow('Estimated panels fitted', panelLayout?.estimatedPanelsThatFit || '—');
  drawRow('Recommended orientation', panelLayout?.recommendedPanelOrientation || '—');
  drawRow('Roof utilisation',      panelLayout?.roofUtilisationPercent ? `${panelLayout.roofUtilisationPercent.toFixed(0)}%` : '—');
  drawRow('Inverter location',     (simulation.inverterLocation || '—').replace(/_/g, ' '));
  drawRow('Battery location',      (simulation.batteryLocation  || '—').replace(/_/g, ' '));
  drawRow('DB location',           simulation.dbLocation || '—');
  drawRow('Cable entry point',     simulation.cableEntryPoint || '—');
  drawRow('Obstructions',          simulation.obstructions?.length > 0 ? simulation.obstructions.map(o => o.label).join(', ') : 'None');
  y += 4;

  // Table 2: String / MPPT plan
  if (stringPlan && stringPlan.strings && stringPlan.strings.length > 0) {
    drawSection('Table 2 — String / MPPT Plan');
    drawRow('Total strings',   stringPlan.totalStrings);
    drawRow('Panels per string', stringPlan.panelsPerString);
    drawRow('MPPT inputs',     stringPlan.mpptCount);
    drawRow('Combiner required', stringPlan.needsCombiner ? 'Yes' : 'No');
    y += 2;
    // Per-string rows
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('String', margin, y);
    doc.text('Panels', margin + 22, y);
    doc.text('MPPT', margin + 40, y);
    doc.text('Voc cold (V)', margin + 58, y);
    doc.text('Status', margin + 90, y);
    y += 5;
    stringPlan.strings.forEach(s => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(s.label,               margin, y);
      doc.text(String(s.panelCount),  margin + 22, y);
      doc.text(`MPPT ${s.mpptNumber}`, margin + 40, y);
      doc.text(String(s.stringVocCold), margin + 58, y);
      doc.setTextColor(s.status === 'ok' ? 5 : 239, s.status === 'ok' ? 150 : 68, s.status === 'ok' ? 105 : 68);
      doc.text(s.status === 'ok' ? '✓ OK' : '⚠ Warning', margin + 90, y);
      doc.setTextColor(15, 23, 42);
      y += 5;
    });
    y += 4;
  }

  // Table 3: Cable route estimates — v11.1: show the effective estimates the
  // rest of the app uses (custom value, else auto-estimate), not just "auto".
  const cableEst = getCableEstimates(simulation, project, roofGeometry);
  drawSection('Table 3 — Cable Route Estimates');
  drawRow('DC route estimate',      `${cableEst.dcM} m${simulation.dcRouteCustomM > 0 ? ' (manual)' : ' (auto)'}`);
  drawRow('AC route estimate',      `${cableEst.acM} m${simulation.acRouteCustomM > 0 ? ' (manual)' : ' (auto)'}`);
  drawRow('Battery cable estimate', `${cableEst.batM} m${simulation.batteryRouteCustomM > 0 ? ' (manual)' : ' (auto)'}`);
  drawRow('DC voltage drop',        sizing?.dcDropPct !== undefined ? `${(sizing.dcDropPct * 100).toFixed(1)}%` : '—');
  drawRow('AC voltage drop',        sizing?.acDropPct !== undefined ? `${(sizing.acDropPct * 100).toFixed(1)}%` : '—');
  y += 4;

  // Installer warnings (v11.1) — danger and warning levels only
  const importantWarnings = simWarnings.filter(w => w && (w.level === 'danger' || w.level === 'warning'));
  if (importantWarnings.length > 0) {
    drawSection('Installer Warnings');
    importantWarnings.slice(0, 14).forEach(w => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(w.level === 'danger' ? 239 : 217, w.level === 'danger' ? 68 : 119, w.level === 'danger' ? 68 : 6);
      doc.text(`${w.level === 'danger' ? '⛔' : '⚠'} ${w.msg}`, margin, y, { maxWidth: contentWidth });
      y += 5.5;
    });
    doc.setTextColor(15, 23, 42);
    y += 4;
  }

  // Table 4: As-built summary (when commissioning mode enabled)
  const ab = simulation.asBuilt;
  if (ab && ab.enabled) {
    drawSection('Table 4 — As-Built Summary');
    drawRow('Actual panels installed',    ab.actualPanelsInstalled || '—');
    drawRow('Installer',                  ab.installerName || '—');
    drawRow('Commissioning date',         ab.commissioningDate || '—');
    drawRow('Earthing continuity passed', ab.actualEarthingContinuityPass ? 'Yes' : 'No');
    drawRow('Insulation resistance passed', ab.actualInsulationResistancePass ? 'Yes' : 'No');
    drawRow('Monitoring configured',      ab.monitoringConfigured ? 'Yes' : 'No');
    drawRow('Client handover completed',  ab.clientHandoverCompleted ? 'Yes' : 'No');
    if (ab.asBuiltNotes) {
      y += 2;
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Notes: ${ab.asBuiltNotes}`, margin, y, { maxWidth: contentWidth });
      y += 8;
    }
  }

  // Disclaimer
  if (y > 260) { doc.addPage(); y = 20; }
  y += 5;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y - 2, contentWidth, 14, 'F');
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Disclaimer: The installer simulation is a planning guide only. Final layout must be verified on site based on roof structure, ' +
    'purlins/rafters, waterproofing, clamp zones, wind loading, earthing, cable routing, product manuals, and installer safety requirements. ' +
    'This document does not replace structural design, protection coordination, or KPLC/EPRA approvals.',
    margin + 2, y + 4,
    { maxWidth: contentWidth - 4 }
  );
}

/**
 * Append load assessment + accessories/BOS summary page(s) to an existing
 * jsPDF doc object (v10). Safe to skip if loadAccessoriesData is null/undefined.
 *
 * @param {object} doc      - jsPDF instance
 * @param {object} project  - Project state
 * @param {object} loadAccessoriesData - { loadSummary, loadWarnings, dataLoggerRecommendation, accessoriesBoQ }
 */
export function appendLoadAndAccessoriesSummary(doc, project, loadAccessoriesData) {
  if (!doc || !loadAccessoriesData) return;
  const { loadSummary, loadWarnings = [], dataLoggerRecommendation, accessoriesBoQ } = loadAccessoriesData;
  if (!loadSummary && !accessoriesBoQ) return;

  const margin       = 15;
  const pageWidth    = 210;
  const pageHeight   = 297;
  const contentWidth = pageWidth - margin * 2;
  let y              = 20;

  doc.addPage();
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('LOAD ASSESSMENT & ACCESSORIES (BOS) SUMMARY', margin, y);
  y += 7;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Load assessment mode: ${loadSummary?.mode || 'N/A'}. ${loadSummary?.modeDefaults?.proposalLanguage || ''}`, margin, y, { maxWidth: contentWidth });
  y += 10;

  const drawRow = (label, value) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(label + ':', margin, y);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(value ?? '—'), margin + 75, y);
    y += 6;
  };
  const drawSection = (title) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(title, margin, y);
    y += 7;
  };

  if (loadSummary) {
    drawSection('Table 1 — Load Summary');
    drawRow('Connected load', `${num1(loadSummary.connectedKw)} kW`);
    drawRow('Max demand (demand x diversity)', `${num1(loadSummary.maxDemandKw)} kW`);
    drawRow('Daily energy', `${num1(loadSummary.dailyKwh)} kWh (day ${num1(loadSummary.dayKwh)} / night ${num1(loadSummary.nightKwh)})`);
    drawRow('Critical / backup energy', `${num1(loadSummary.criticalKwh)} kWh (${(loadSummary.criticalFraction * 100).toFixed(0)}% of daily)`);
    drawRow('Solar-offset-only energy', `${num1(loadSummary.solarOffsetOnlyKwh)} kWh`);
    drawRow('Peak with surge', `${num1(loadSummary.peakKw)} kW`);
    drawRow('Load factor', num2(loadSummary.loadFactor));
    if (loadSummary.largestMotorName) drawRow('Largest motor', `${loadSummary.largestMotorName} (${num1(loadSummary.largestMotorStartingKva)} kVA start)`);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Recommendation: ${loadSummary.recommendation}`, margin, y, { maxWidth: contentWidth });
    y += 9;
  }

  if (loadWarnings.length > 0) {
    drawSection('Table 2 — Load Quality Warnings');
    loadWarnings.slice(0, 12).forEach((w) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(w.level === 'danger' ? 185 : 71, w.level === 'danger' ? 28 : 85, w.level === 'danger' ? 28 : 105);
      const prefix = w.level === 'danger' ? '! ' : w.level === 'warning' ? '~ ' : '- ';
      doc.text(prefix + w.msg, margin, y, { maxWidth: contentWidth });
      y += 6;
    });
    y += 3;
  }

  if (dataLoggerRecommendation?.recommended) {
    drawSection('Data Logger Recommendation');
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(dataLoggerRecommendation.note, margin, y, { maxWidth: contentWidth });
    y += 6;
    doc.text(`Capture: ${dataLoggerRecommendation.capture.join(', ')}.`, margin, y, { maxWidth: contentWidth });
    y += 9;
  }

  if (accessoriesBoQ) {
    drawSection('Table 3 — Accessories / BOS Summary');
    Object.entries(accessoriesBoQ.categories || {}).forEach(([catKey, rows]) => {
      if (!rows || rows.length === 0) return;
      const subtotal = rows.reduce((s, r) => s + r.total, 0);
      drawRow(catKey.charAt(0).toUpperCase() + catKey.slice(1), `${rows.length} item(s) — ${money(subtotal)}`);
    });
    y += 2;
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 9, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text('BOS SUBTOTAL (reference — not added to engineering BoQ total)', margin + 3, y + 6);
    doc.text(money(accessoriesBoQ.totalCost), margin + contentWidth - 4, y + 6, { align: 'right' });
    y += 16;
  }

  if (y > 260) { doc.addPage(); y = 20; }
  y += 3;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y - 2, contentWidth, 14, 'F');
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Disclaimer: Load and accessories figures are planning-level estimates from itemised/preset load data and the current roof/string design. ' +
    'Commercial/industrial loads should be validated with temporary data logging where recommended above. Final BOS quantities, ' +
    'protection coordination and structural fixings must be confirmed on site by qualified personnel before procurement.',
    margin + 2, y + 4,
    { maxWidth: contentWidth - 4 }
  );
}

const num1 = (v) => Number(v || 0).toFixed(1);
const num2 = (v) => Number(v || 0).toFixed(2);

// Fallback EV specs in case evChargerSpecs is not loaded in scope
const evChargerSpecs = {
  L1: { label: "L1 - 3.7 kW home socket", kw: 3.7, standard: "IEC 62196 Type 2", unitCost: 85000 },
  L2: { label: "L2 - 7.4 kW AC wallbox", kw: 7.4, standard: "IEC 62196 Type 2", unitCost: 180000 },
  DCFC50: { label: "DCFC - 50 kW fast charger", kw: 50, standard: "CCS2 / CHAdeMO", unitCost: 2500000 },
  DCFC150: { label: "DCFC - 150 kW rapid charger", kw: 150, standard: "CCS2", unitCost: 7800000 },
  HPC350: { label: "HPC - 350 kW ultra-rapid charger", kw: 350, standard: "CCS2", unitCost: 18000000 },
};
