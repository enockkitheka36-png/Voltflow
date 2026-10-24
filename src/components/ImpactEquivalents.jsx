import React from "react";
import { calculateImpactEquivalents } from "../utils/impactEquivalents.js";
import "./FieldPlanning.css";

export default function ImpactEquivalents({ sizing }) {
  const result = calculateImpactEquivalents(sizing.quoteReady === false ? null : sizing.carbonOffsetMethodology);
  return <section className="card field-planning" aria-label="Illustrative environmental equivalents"><h2>Environmental impact — explain, do not overclaim</h2>
    <div className="planning-grid"><div className="planning-value">Modelled avoided emissions<strong>{result.ready ? result.avoidedTonnes.toFixed(2) : "Complete design checks"}{result.ready && " tCO₂/year"}</strong>Using this project's selected emission-factor assumption—not verified measured performance.</div>
      <div className="planning-value">Illustrative urban-tree annual uptake equivalent<strong>{result.ready ? Math.round(result.illustrativeUrbanTreeYears).toLocaleString() : "Not available"}</strong>Tree-years of uptake, not trees saved, planted or protected.</div>
      <div className="planning-value">Corals saved<strong>Not calculated</strong>No project-specific ecological evidence or defensible universal CO₂-to-coral conversion is supplied.</div></div>
    <p className="field-note">Tree comparison uses EPA's illustrative 0.060 tCO₂ per urban tree per year, based on US assumptions averaged over early growth. It is not a Kenyan forestry estimate, biodiversity outcome or carbon-credit methodology. <a href={result.source} target="_blank" rel="noopener noreferrer">Method and limitations ↗</a></p>
    <p className="field-note">Estimated emissions reductions and visual equivalents are not issued carbon credits. Eligibility, additionality, approved methodology, monitoring, independent validation/verification and registry issuance are separate processes. No coral or tree credit revenue is added by this comparison.</p>
  </section>;
}
