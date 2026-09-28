# Voltflow — Meeting Pack: Next Call with Mary (and Vincent)

**Build:** 11.7 preview / 11.6 production · **Classification:** Internal Alpha / Bank Pilot Readiness.
Speaking notes — turn into slides if useful. Not legal advice; not certified engineering approval.

## 1. 60-second explanation
"Voltflow turns a lead and basic site/bill info into standardized, explainable solar quotes and
proposals, and tracks each job — without needing a solar engineer for every quote. It already
captures leads, sizes systems, produces Good/Better/Best variants, generates client-ready
proposals and tracks tasks/approvals. For the bank, we add a **simple guided mode** so their
staff can request a standard quote without solar training. What remains before a bank pilot is
mainly **security and governance** — access control, data handling and sign-off — not features."

## 2. Current status
- **11.7 preview:** feature-complete for a pilot — Studio builder, templates, Good/Better/Best
  scenarios, borehole module, BoQ, Proposal + audience reports, Delivery tracking, evidence/audit
  log, compliance workspace. Green: 21 test suites / 241 tests, clean build.
- **Production:** still **11.6** (11.7 preview only, held for a deliberate go/no-go).
- **Security/deployment:** secrets handled safely; no key/error leakage; managed HTTPS on Vercel.
  **But:** no login/auth and browser-only storage → controlled pilot only, not sensitive bank
  production yet.
- **Remaining limitations:** access control + multi-tenant cloud storage not built; UAT + written
  go/no-go pending; IP/pilot terms not yet agreed.

## 3. Three-phase roadmap (Mary's framing)
- **Phase 1 — Go-live readiness:** Bank Pilot Mode, banner, data warnings, UAT, Vincent sign-off,
  controlled pilot. *(This sprint delivers most of it.)*
- **Phase 2 — Legal/IP/business model:** ownership, licence vs subscription, usage terms, DPA/NDA.
- **Phase 3 — Rollout & multi-client SaaS:** Solarize + bank first, then Sytech + other EPCs;
  configurability, tenant isolation, support model.

## 4. Three collaboration models (detail in the IP doc)
1. **Founder-owned SaaS, Solarize = pilot customer** (cleanest ownership).
2. **Founder-owned SaaS, Solarize = strategic partner** (preferential terms / revenue share /
   market rights, with boundaries) — **recommended default**.
3. **Joint venture / co-owned** (strongest partnership, highest risk to your ownership).

## 5. Decisions needed from Mary
- Can we run a **controlled internal pilot first** (test data, limited users)?
- **Who signs off security** — is Vincent the accountable reviewer?
- What **bank user flow** does the bank actually require? Any required fields we're missing?
- **What data may be entered** in the pilot (test only vs real customer data)?
- What is the **fallback tool** if we go NO-GO (Zoho/manual)?
- Solarize's **preferred commercial relationship** (customer / partner / JV)?

## 6. Decisions needed from Vincent
- **Hosting** recommendation (Vercel now; VPS staging; Supabase target).
- **Auth / access control** recommendation + timeline.
- **Bank data security posture** — what's acceptable for the pilot vs production.
- **Technical go/no-go** for a controlled pilot.

## 7. Suggested closing
"I propose we treat Voltflow as a **controlled pilot tool first, not full production SaaS**. I
retain the **core IP and source code**, **Solarize becomes the anchor pilot customer and
strategic partner**, and we agree **formal terms — Pilot MOU, NDA/DPA and a SaaS licence —
before any wider rollout or bank-facing use**. For the pilot we use test/non-sensitive data on
the current hosting, and we add proper auth + cloud isolation before any confidential bank data."

## One-line asks
- **Mary:** approve a controlled internal pilot + tell me Solarize's preferred relationship.
- **Vincent:** give a hosting/auth recommendation + a technical go/no-go.
