/**
 * reportPdf.js — Voltflow 11.7
 *
 * Renders a structured report (from reportBuilder.js) to a jsPDF A4 document.
 * Generic walker over section types (kv / list / checklist / table / text). Kept
 * separate from the legacy pdfGenerator.js so the existing quotation/full report
 * are untouched.
 */
import { jsPDF } from "jspdf";
import { REPORT_LABELS } from "./reportBuilder.js";

const MARGIN = 16;
const PAGE_W = 210;
const PAGE_H = 297;
const LINE = 5.4;

export function renderReportPdf(report) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensure = (needed = LINE) => {
    if (y + needed > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
  };
  const text = (str, x, size = 10, style = "normal", color = [30, 41, 59]) => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(String(str), PAGE_W - 2 * MARGIN - (x - MARGIN));
    wrapped.forEach((ln) => { ensure(); doc.text(ln, x, y); y += LINE; });
  };

  // Header band
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, PAGE_W, 22, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("VOLTFLOW", MARGIN, 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(REPORT_LABELS[report.mode] || "Report", MARGIN, 16);
  doc.setFontSize(8);
  doc.text("Internal Alpha — market-testing build. Not certified engineering approval.", PAGE_W - MARGIN, 10, { align: "right" });
  y = 30;

  text(report.title, MARGIN, 13, "bold");
  text(`Generated ${new Date(report.generatedAt).toLocaleString("en-KE")}`, MARGIN, 8, "normal", [100, 116, 139]);
  y += 2;

  report.sections.forEach((s) => {
    ensure(LINE * 2);
    // Section heading
    doc.setDrawColor(226, 232, 240); doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 4;
    text(s.heading, MARGIN, 11, "bold", [16, 185, 129]);

    (s.items || []).forEach((it) => {
      if (Array.isArray(it)) { // kv pair
        ensure();
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(51, 65, 85);
        const key = `${it[0]}: `;
        doc.text(key, MARGIN, y);
        const kw = doc.getTextWidth(key);
        doc.setFont("helvetica", "normal"); doc.setTextColor(30, 41, 59);
        const val = doc.splitTextToSize(String(it[1]), PAGE_W - 2 * MARGIN - kw);
        doc.text(val[0] || "", MARGIN + kw, y); y += LINE;
        for (let i = 1; i < val.length; i++) { ensure(); doc.text(val[i], MARGIN + kw, y); y += LINE; }
      } else if (s.type === "checklist") {
        text(`[  ]  ${it}`, MARGIN + 1, 9.5);
      } else {
        text(`•  ${it}`, MARGIN + 1, 9.5);
      }
    });
    if (s.note) text(s.note, MARGIN + 1, 8, "italic", [100, 116, 139]);
    y += 3;
  });

  // Disclaimers
  ensure(LINE * 3);
  y += 2;
  doc.setDrawColor(252, 211, 77); doc.setFillColor(255, 251, 235);
  const boxTop = y;
  (report.disclaimers || []).forEach(() => {});
  y += 2;
  (report.disclaimers || []).forEach((d) => text(d, MARGIN + 2, 8, "normal", [120, 53, 15]));
  doc.setDrawColor(252, 211, 77);
  doc.rect(MARGIN, boxTop - 1, PAGE_W - 2 * MARGIN, y - boxTop + 1);

  // Footer page numbers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text(`Voltflow ${REPORT_LABELS[report.mode] || ""} · page ${p}/${pages}`, PAGE_W / 2, PAGE_H - 8, { align: "center" });
  }
  return doc;
}

export function downloadReportPdf(report, filename) {
  const doc = renderReportPdf(report);
  const safe = (report.meta?.client || "project").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(filename || `voltflow-${report.mode}-${safe}.pdf`);
  return true;
}
