# Voltflow 11.7 — Template Gallery

`src/utils/projectTemplates.js` · tests `scripts/template-gallery-regression.mjs` (7) · UI: Voltflow Studio → "Start from a template" (engineer view).

## Purpose
Job-type starting points so a user builds a useful project in under 2 minutes instead of
filling blank forms. Templates pre-fill **inputs the user can edit** — deterministic sizing
still runs on the result.

## The 13 templates
Residential Backup · Residential Hybrid · Commercial Rooftop · School · Clinic ·
**Farm Solar + Borehole** · Dairy Farm · Carwash · Hotel/Lodge · Mini-grid · EV Charging
Station · Genset Hybrid · Solar Security Lighting.

## Each template carries
- `systemType` + `loadAssessmentMode` + a few project overrides (coverage, backup, phase, …)
- `loads` — typical load specs → real `loadItemsV2` via `loadEngine.createLoadItem`
- `enableBorehole` (+ `boreholeOverrides`) — Farm/Dairy/Hotel turn the borehole module **on**
- `commonWarnings`, `proposalLanguage {problem, solution, benefits}`, `boqCategories`,
  `checklistItems`, `recommendedSections`

## API
```js
listTemplates()            // preview cards
getTemplate(id)            // full template
applyTemplate(base, id)    // → { project, loadItemsV2, loadAssessmentMode, borehole, meta }
```
`applyTemplate` never mutates inputs. In the app, "Use template" applies loads + project +
borehole, logs a PROJECT_CREATED audit event, and routes to Load Assessment to review + Update
Sizing.

## Notes
- The Farm/Dairy templates include a 0-W "pump (see Borehole module)" placeholder row so the
  pump is sized in the Borehole module, not double-counted as a load (the double-count guard
  still warns if a real pump load is added).
- Templates are a starting point, not a design — every value is editable and must be verified.
