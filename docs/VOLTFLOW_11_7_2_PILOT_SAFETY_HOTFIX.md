# Voltflow 11.7.2 - Pilot Safety Hotfix

**Date:** 2026-08-05  
**Classification:** Internal Alpha / Controlled Bank Pilot Build.

## What changed
- App version bumped to `Voltflow 11.7.2`; persisted schema stays `11.7`.
- Bank Pilot Mode now requires an explicit acknowledgement of the pilot data rules before a quote can be submitted for Solarise review.
- The persistent banner and bank warning now state the real constraints plainly: browser-only storage, no app access control, and test/non-sensitive data only until authentication and tenant isolation are enabled.
- Project JSON exports and full local-data backups now include `pilotSafety` metadata: build class, storage model, auth model, sensitive-data rule, and production-deployment approval requirement.
- Import review surfaces whether a project JSON contains pilot-safety metadata and warns on older exports that do not.
- Added `npm run test:pilot` and included it in `npm run test:all`.

## What did not change
- No authentication, database, cloud storage, tenant isolation, or new production deployment was added.
- No secrets were added to the repo or export payloads.
- No production deployment was run.

## Verification
Run:

```bash
npm run build
npm run test:all
```

On Windows inside a restricted Codex workspace, the build may need to be run from a temporary drive mapping so Vite does not traverse outside the repo while loading `vite.config.js`.
