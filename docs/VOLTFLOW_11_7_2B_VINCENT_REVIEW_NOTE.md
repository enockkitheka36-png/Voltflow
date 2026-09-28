# Voltflow 11.7.2b - Vincent Review Note

**Build:** Voltflow 11.7.2b  
**Schema:** 11.7  
**Purpose:** Sanitized deployment review and controlled staging  
**Production deployment:** Not authorized

## Package set

- `voltflow-11.7.2b-frontend-sanitized.zip`: React/Vite frontend source and static-host configuration.
- `voltflow-11.7.2b-backend-deploy-sanitized.zip`: API wrapper, Node server, deployment material, scripts, documentation, and package manifests.
- `voltflow-11.7.2b-full-repo-sanitized-for-vincent.zip`: Complete non-secret source for review and reproducible build/test.

Generated dependencies and build output are deliberately excluded. Run `npm ci` before building. No `.env`, `.env.local`, `.vercel`, `node_modules`, or pre-existing ZIP files should be present in the packages.

## Recommended review sequence

```bash
npm ci
npm run build
npm run test:all
npm run test:data-integrity
npm run test:pilot
```

The validated 2026-08-05 source passed the build and all 26 regression suites (276 checks, zero failures). Vite reports a non-blocking large-chunk warning for the main frontend bundle.

## Deployment options

### Static staging first

Build the frontend and serve the contents of `dist/` behind HTTPS with SPA fallback to `index.html`. Voltflow remains usable with the local Project Advisor and no external AI request. This is the recommended first staging posture.

### Frontend plus optional Node API

`server/index.js` reuses `api/assistant.js` and can run behind Nginx/PM2. Configure `ANTHROPIC_API_KEY` only in the server environment outside the repo. Do not place a real key in `.env.local.example`, deployment scripts, frontend variables, logs, or archives. Leave the assistant disabled for Bank Mode.

Detailed files are under `deploy/interserver/`. Replace placeholder domains and paths before use, review each command, and run the smoke-test checklist. No production cutover is approved by this package.

## 11.7.2b review focus

- Zero committed loads gate all quote-ready sizing and commercial output.
- Wizard monthly bill and project choices persist into downstream calculations.
- Client and Bank proposal views hide internal engineering, authoring, BOS cost, margin, and JSON-export detail.
- Survey defaults are assumptions pending confirmation, not verified facts.
- Disabled AI and Bank Mode do not issue an external POST.
- Bank readiness is recorded locally and does not claim Solarise received a submission.
- Invalid 24-hour load schedules block sizing and downstream calculations.
- BoQ labour, transport, and markup reconcile while internal values remain restricted by view.
- Financial surfaces share one LCOE source; carbon revenue is opt-in only.
- Drawer and short-viewport navigation controls have regression coverage.

## Security boundary

Voltflow has no authentication, authorization, tenant isolation, database, or cloud project submission. Browser view modes are not access controls. Data is stored in localStorage and can be accessed by anyone using the same browser profile. Restrict staging to dummy or explicitly approved non-sensitive data.

## Vincent sign-off checklist

- Verify all published SHA256 checksums before extracting.
- Inspect the ZIP entry list before deployment.
- Run the full build and regression suite in the target environment.
- Start with static staging and HTTPS; keep production DNS unchanged.
- Confirm Bank Mode makes no assistant request.
- Keep any real API secret outside the application directory with restricted permissions.
- Do not approve real bank/customer data until authentication and tenant-isolated storage exist.
