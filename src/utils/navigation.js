/**
 * navigation.js — Voltflow 11.5.2 (Add-on: guided navigation)
 *
 * Pure navigation rules shared by App.jsx and the navigation regression tests.
 * No React, no DOM. Keeps view-mode routing, back-target resolution and the
 * highlight-class decision in ONE place so the UI and the tests can never drift.
 */

export const DEFAULT_VIEW = "field-dashboard";

// Every tab the app can route to via navigateToTab / Action Center / Dashboard cards.
export const VALID_TABS = new Set([
  "field-dashboard", "dashboard", "project", "site-survey", "roof-shading", "roof-layout",
  "electrical", "site-photos", "safety-risks", "loads", "energy-import", "generation",
  "battery", "inverter", "eng-compliance", "boq", "finance", "carbon", "installer-sim",
  "system-options", "proposal", "readiness", "storage", "feedback", "assistant",
  "delivery", "genset", "ev", "minigrid", "borehole", "compliance", "evidence",
  "studio", "assets-lib", "bank-flow",
]);

// v11.7.1 — Bank Pilot Mode: a deliberately minimal, guided surface. Bank users
// never see the engineering workspace.
export const BANK_SAFE_TABS = new Set([
  "bank-flow", "field-dashboard", "proposal", "storage",
]);

// Client view: only the clean, client-safe pages.
export const CLIENT_SAFE_TABS = new Set([
  "field-dashboard", "dashboard", "proposal", "assistant", "feedback",
]);

// Technician view: field/survey/install-oriented tabs only.
export const TECHNICIAN_SAFE_TABS = new Set([
  "field-dashboard", "dashboard", "site-survey", "roof-shading", "roof-layout",
  "electrical", "site-photos", "safety-risks", "installer-sim", "proposal",
  "readiness", "storage", "assistant", "delivery", "loads", "borehole", "compliance", "studio",
]);

/**
 * Is a tab reachable in the given view mode?
 * Engineer sees everything; technician/client are restricted to their safe sets.
 */
export function isTabAllowedInView(tab, viewMode = "engineer") {
  if (viewMode === "technician") return TECHNICIAN_SAFE_TABS.has(tab);
  if (viewMode === "client") return CLIENT_SAFE_TABS.has(tab);
  if (viewMode === "bank") return BANK_SAFE_TABS.has(tab); // v11.7.1 Bank Pilot Mode
  return true; // engineer (default) — full access
}

/**
 * Where "← Back" should return. Uses internal previousView state, never browser
 * history. Falls back to the dashboard when there is nothing to go back to.
 */
export function resolveBackTarget(previousView, fallback = DEFAULT_VIEW) {
  if (previousView && typeof previousView.tab === "string" && previousView.tab) return previousView.tab;
  return fallback;
}

/**
 * The class a highlightable element should carry: "vf-highlight" when it is the
 * active navigation target, else "". (CSS turns off the animation under
 * prefers-reduced-motion, keeping a static outline.)
 */
export function highlightClass(activeHighlightId, targetId) {
  return activeHighlightId && targetId && activeHighlightId === targetId ? "vf-highlight" : "";
}
