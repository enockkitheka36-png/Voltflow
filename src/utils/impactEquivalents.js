export const IMPACT_EQUIVALENCE_METHOD = "VF-ILLUSTRATIVE-URBAN-TREE-1";
export const TREE_UPTAKE_TONNES_PER_YEAR = 0.060;
export const TREE_EQUIVALENCE_SOURCE = "https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references";
export function calculateImpactEquivalents(avoidedTonnes) {
  const valid = typeof avoidedTonnes === "number" && Number.isFinite(avoidedTonnes) && avoidedTonnes >= 0 && avoidedTonnes <= 1e9;
  return { ready: valid, avoidedTonnes: valid ? avoidedTonnes : null, illustrativeUrbanTreeYears: valid ? avoidedTonnes / TREE_UPTAKE_TONNES_PER_YEAR : null, coralCount: null, issuedCredits: null, method: IMPACT_EQUIVALENCE_METHOD, source: TREE_EQUIVALENCE_SOURCE };
}
