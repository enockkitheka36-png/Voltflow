# Voltflow 11.7.2b Release Notes

**Release date:** 2026-08-05  
**Persisted schema:** 11.7  
**Classification:** Internal Alpha / Controlled Bank Pilot Build

## Scope

Voltflow 11.7.2b is a focused data-integrity and proposal-sanitization hotfix. It retains the 11.7.2 pilot-safety warnings and export metadata. It does not add authentication, tenant isolation, cloud storage, a database, or production deployment.

## Data integrity changes

- Projects with no committed loads now show `Pending load inventory` and cannot produce quote-ready sizing, BoQ, investment, proposal, or advisor outputs.
- The new-project wizard persists monthly bill, site type, objective, and load source. Proposal and financial outputs use the persisted bill instead of the legacy KES 35,000 fallback.
- Load rows where day hours plus night hours exceed 24 block Update Sizing and cannot drive downstream sizing, BoQ, proposal, or financial calculations.
- Dashboard, Sizing Overview, Financials, and Proposal use the same LCOE source.
- Carbon revenue defaults to zero unless explicitly opted in. Debt-free financial wording is `No debt selected` or `Equity-only case`.

## Proposal and commercial changes

- Client and Bank views hide internal blockers, raw engineering warnings, internal BOS costs, margins, Proposal Studio authoring controls, and project JSON export controls.
- Engineer View retains the internal engineering and commercial detail required for review.
- Technician View is limited to practical field content and hides commercial or margin-sensitive detail unless explicitly allowed.
- Default roof area, breaker size, roof condition, and earthing values are labelled `Assumption - confirm during site survey` and are not presented as verified facts.
- BoQ totals now include and reconcile labour, transport, and markup allowances. Internal cost and margin remain hidden from Client and Bank views.

## Privacy and workflow changes

- No external AI POST is attempted when AI is disabled or Bank Mode is active.
- The AI destination domain is displayed only when AI is enabled.
- Bank workflow language now says `Mark ready locally` or directs the user to export/share for Solarise review. It does not imply a network submission occurred.
- Drawers close with Escape, destination selection closes the menu, controls avoid each other at short viewport heights, and the drawer close control no longer sits beneath Open Menu.

## Pilot-safety controls retained

- Persistent Internal Alpha / Controlled Bank Pilot labelling.
- Explicit acknowledgement of pilot data rules before the local bank-ready action.
- Browser-only storage, no-authentication, and non-sensitive/test-data warnings.
- `pilotSafety` metadata in project exports and local backups.
- Import warnings for older records without pilot-safety metadata.

## Verification

Executed from the sanitized source on 2026-08-05:

```text
npm run build                 PASS (431 modules; bundle-size warning only)
npm run test:all              PASS (26 suites, 276 checks, 0 failures)
npm run test:data-integrity   PASS (11 checks, 0 failures)
npm run test:pilot            PASS (5 checks, 0 failures)
```

## Known limitations

- Project data remains in browser localStorage. There is no cloud persistence or cross-device synchronization.
- There is no login, role-based authorization, tenant isolation, or server-side audit trail.
- View modes are presentation controls, not security boundaries.
- The optional AI assistant requires a server-side `ANTHROPIC_API_KEY`; it should remain disabled in Bank Mode.
- The main JavaScript bundle is approximately 1.2 MB minified and triggers Vite's non-blocking chunk-size warning.
- Engineering outputs remain feasibility guidance and require qualified review before procurement, installation, lending, or certification decisions.

## Release posture

Suitable for Solarise internal UAT, Vincent-controlled staging, and a supervised bank demonstration using dummy or approved non-sensitive data. Not approved for production SaaS or confidential bank/customer data.
