# Voltflow — Market Entry Notes

**Status:** Voltflow Internal Alpha — controlled testing and development, **not production SaaS**.
Honest, practical notes for deciding who tests it and how to talk about it.

---

## What is working well

- **End-to-end EPC flow in one tool:** clean startup → onboarding → site survey → load assessment → feasibility sizing → engineering compliance flags → installer simulation → BoQ → proposal → project delivery. Nothing is re-entered between steps.
- **Real sizing engine** with cold-Voc, voltage-drop, BMS-current and cable-ampacity checks — it catches genuine engineering problems, not just cosmetics.
- **Energy Data Import:** upload a data-logger CSV/XLSX and get a real load profile and sizing basis — a strong differentiator versus spreadsheet quoting.
- **Voltflow Delivery:** stages, tasks, BoQ-linked procurement (with manual-edit protection), installation checklist, issues and approval gates.
- **Three view modes** (engineer / technician / client) from one project — the client view is genuinely presentable.
- **Project Advisor:** rule-based guidance that works with no AI key.
- **Field usability (11.5.1):** numeric inputs that don't fight the user, preset chips for common equipment values.
- **Safe by default:** clean startup, no fake data, browser-local storage with export, engineering disclaimers throughout.

## What is not yet ready

- **No cloud backend or accounts.** Everything is browser-local; projects move by JSON export/import. This is the biggest gap for team use.
- **No multi-project pipeline** (the delivery board shows one project at a time).
- **AI Assistant is optional and off by default** (needs an Anthropic key in Vercel). Project Advisor covers the gap for now.
- **Known sizing caveat:** battery autonomy is reported against a 24-hour-averaged critical load, so it **overstates backup for night-dominant loads** (e.g. flood lighting) by roughly 1.8×. Fix is scheduled; until then, sanity-check backup hours on lighting-heavy jobs.
- **No PDF-quality client brochure** (the proposal is functional, not a designed document).
- Not a certified engineering tool — every number needs qualified review before it reaches a client.

## Who should test it first

1. **Solarise internal engineers** — the primary audience; they can judge the sizing against real jobs.
2. **A friendly EPC or two** doing residential/SME hybrid and off-grid work in Kenya — the sweet spot.
3. **One installation technician** — specifically the technician view and installation checklist on a phone.
Avoid putting it in front of end clients directly yet, except via a controlled client-view walkthrough led by an engineer.

## What makes Voltflow different in Kenya / Africa

- **Built around Kenyan conditions:** county-based site profiles (PSH, cell temp, soiling), KPLC/EPRA compliance notices, KES throughout, genset-hybrid and mini-grid modes that match how power is actually delivered here.
- **Survey-to-delivery in one tool**, not a sizing calculator bolted onto spreadsheets.
- **Works offline-ish and low-friction:** browser-local, no login wall to start, fast on modest laptops.
- **Data-logger-driven sizing** — moves EPCs from guesswork to measured consumption.
- **Delivery layer** — most sizing tools stop at the quote; Voltflow follows the job to handover.

## Current limitations (say these plainly)

Browser-local storage; single active project; optional AI; night-load battery caveat; feasibility-grade (not certified) outputs; alpha stability.

## Revenue ideas (exploratory, not commitments)

- Per-seat subscription for EPCs once cloud storage + accounts land.
- Per-project / per-proposal credit model for occasional users.
- A hosted "client proposal link" tier.
- Data-logger analysis as a paid add-on service.
- White-label for distributors/OEMs.
Do not price or sell any of these yet — the product is pre-cloud.

## Recommended outreach message to EPCs (honest version)

> "We're testing Voltflow, an internal tool that takes a solar job from site survey and load assessment through to feasibility sizing, a proposal and installation tracking — tuned for Kenyan conditions (KPLC/EPRA notes, county solar data, genset-hybrid and off-grid). It's an early internal alpha, not a finished product, and every number still needs engineer review. We'd value 30 minutes of your feedback on whether it fits how you actually quote and deliver."

## What NOT to promise yet

- Don't call it production-ready or a SaaS.
- Don't promise cloud sync, accounts, or multi-user collaboration (not built).
- Don't present outputs as certified/stamped engineering designs.
- Don't promise KPLC/EPRA approval, guaranteed savings, or carbon-credit revenue.
- Don't promise the AI Assistant works out of the box (it needs a key).
- Don't quote the reported battery backup hours on night-dominant lighting jobs without checking.
