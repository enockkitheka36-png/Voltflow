# Voltflow 11.4 — Client UX Polish + Assistant Shell

**App version:** Voltflow 11.4 · **Schema version:** 11.2 (unchanged — 11.4 adds no persisted project-shape change)
**Classification:** Voltflow Internal Alpha — controlled testing and development, **not production SaaS**.

---

## 1. UI improvements

A reusable design layer was added in `src/components/ui.jsx` + `ui.css` and adopted incrementally — no screen was rewritten and no feature was removed.

**Primitives:** `PageHeader`, `SectionHeader`, `CardGrid`, `FormGrid`, `ActionBar`, `StickySummaryPanel`, `StatusPill`, `EmptyState`, `WarningPanel`, `ResponsiveTable`, `ResponsiveDataTable`, `Spinner`, `Skeleton`.

**Global spacing:** larger card gaps, consistent section padding, taller table rows, roomier inputs, clearer disabled/hover button states, tighter mobile padding and single-column stacking below 900 px.

## 2. View modes

`project.viewMode` (`engineer` | `client` | `technician`), normalised by `normalizeViewMode` and persisted with the project. **Presentation only — it never changes a calculation.** Switching back to Engineer always restores all 27 tabs.

| Mode | Sees |
|---|---|
| **Engineer** (default) | Everything — full technical detail, compliance, formulas, warnings |
| **Client** | 4 tabs: Dashboard, Sizing Overview, Proposal, AI Assistant. A plain-language dashboard (recommended system, expected benefit, investment, backup expectation, next steps). No compliance tables, no LCOE/DSCR, no feedback button |
| **Technician** | 14 tabs centred on survey, roof, installer simulation, readiness and as-built. Financial/BoQ tabs hidden |

A guard redirects to the dashboard if the active tab isn't visible in the selected mode, so switching can never leave a blank screen.

## 3. Table improvements

- `ResponsiveDataTable` (data-driven: columns + rows + totals + empty state) and `ResponsiveTable` (wrapper for existing custom tables with inputs).
- A global retrofit upgrades **every existing** `.table-container`: zebra rows, sticky headers, non-wrapping header cells, tabular numerals, roomier padding, non-wrapping row action buttons, and a mobile `↔ scroll` affordance.
- Saved projects converted to `ResponsiveDataTable` (client, load count, app version, timestamp, actions) with a proper empty state; feedback list gained an empty state.

## 4. Animation system

CSS-only, no libraries: page/tab fade-slide on navigation, card entrance, button hover/press, chat message fade, spinner, skeleton shimmer, success pulse.

**Reduced motion is respected** — `@media (prefers-reduced-motion: reduce)` disables every animation and transform.

## 5. Assistant architecture

```
Browser (AssistantPanel)
   │  POST /api/assistant  { message, context, history }
   ▼
Vercel Serverless Function (api/assistant.js)   ← ANTHROPIC_API_KEY lives ONLY here
   │  @anthropic-ai/sdk → messages.create(claude-opus-4-8, adaptive thinking, max_tokens 1024)
   ▼
Anthropic API
```

- **The key is never in the browser bundle**, never returned in a response, and never logged (errors log a truncated message only).
- Protections: POST-only, 4 000-char message cap, last-8-turn history cap, ~12 req/min per-IP best-effort rate limit, controlled max tokens.
- `vercel.json` rewrite was narrowed to `/((?!api/).*)` so `/api/*` reaches the function instead of the SPA fallback.
- Model override available via the `ASSISTANT_MODEL` env var.

### Context safety (`src/utils/assistantContext.js`)

`buildAssistantContext(...)` returns a **strict whitelist**: client name, location, system type, daily kWh, PV kWp, panel count, battery kWh, inverter kW, total cost, payback, warnings (capped at 12), readiness status/score, load source, load count, sizing mode, roof fit status, energy data quality score, proposal status.

**Never sent:** saved project list, tester feedback, raw localStorage, survey photos, phone/email, meter numbers, GPS coordinates, internal unit costs, tariff or debt assumptions. The panel shows the user exactly what is being sent.

## 6. Configuring ANTHROPIC_API_KEY

The assistant is **optional** — without a key everything else works normally and the panel shows a clear notice.

```bash
npx vercel env add ANTHROPIC_API_KEY production
npx vercel env add ANTHROPIC_API_KEY preview
npx vercel deploy --prod        # redeploy so the function picks up the key
```

Or: Vercel dashboard → Project `voltflow-alpha` → Settings → Environment Variables.
Locally, copy `.env.local.example` to `.env.local` and run `vercel dev` (the plain Vite dev server has no serverless runtime, so the assistant shows the fallback notice there).

## 7. What the assistant can do

Explain sizing results · explain warnings · explain why the PV/battery/inverter size was chosen · flag missing data before proposal · summarise a project for manager review · produce a client-friendly explanation · suggest questions to ask a client · explain Energy Data Import output · explain Installer Simulation warnings · explain why a project is or isn't ready to send.

## 8. What the assistant must NOT be used for

- **It does not provide certified engineering advice** and cannot approve or sign off a design.
- It cannot produce binding or certified designs, stamped calculations, or protection-coordination settings.
- It cannot change project values — it only describes what you should change.
- It must not be relied on for KPLC/EPRA approval outcomes, carbon credit revenue, or regulatory guarantees.
- Responses are advisory and may be wrong. **Verify technical and commercial decisions before use.** Final engineering design and installation approval require qualified review.

## 9. Remaining limitations

- Assistant only runs on Vercel (or `vercel dev`), not the plain Vite dev server.
- Rate limiting is per-serverless-instance and resets on cold start — adequate for an internal alpha, not for public exposure.
- Chat history is per-browser localStorage; it is not shared or backed up.
- Projects and feedback remain browser-local (cloud storage is still scaffolded, `CLOUD_STORAGE_CONFIGURED = false`).
- Client view hides technical tabs but does not enforce access control — it is a presentation mode, not a permission system.
- Main bundle ~952 kB minified (~297 kB gzip); xlsx remains a separate lazy chunk.
- Deferred UI items are listed at the end of `VOLTFLOW_11_4_UI_AUDIT.md`.
