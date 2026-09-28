# Voltflow — IP & Commercial Models (for the Mary conversation)

> **This is a business-planning document, NOT legal advice.** Before signing anything, get a
> qualified lawyer to draft/review agreements. Nothing here creates rights or obligations.

**Author's position:** Voltflow is a founder-initiated product. The goal is a founder-owned SaaS
with Solarize as anchor pilot customer + strategic partner, retaining core IP and the source
code, while respecting Solarize's role and data confidentiality.

## First principles (keep these straight)
- **IP ownership ≠ data confidentiality.** You can guarantee Solarize/bank **data** is protected
  *without* transferring any ownership of the **software**. Keep the two separate in every talk.
- **Access to use ≠ access to source code.** Solarize can *use* Voltflow (a licence) without ever
  receiving the **source code**. Don't conflate them.
- **Pilot ≠ ownership.** Running a pilot does not, by itself, give Solarize rights to the IP —
  but only if that's written down. Silence is risky.

## Three realistic models

### Model 1 — Founder-owned SaaS, Solarize as **pilot customer**
- You retain **all IP + source code**.
- Solarize gets a **pilot/customer licence to use** the hosted app (not the code).
- The bank uses it **under Solarize's project terms** (sub-use), within the pilot scope.
- Future EPCs subscribe on their own terms.
- **Pros (you):** cleanest ownership; simplest to scale to other EPCs. **Pros (Solarize):** low
  cost, low commitment, immediate value.
- **Cons:** Solarize has less "stake," so may invest less; you carry product cost/risk.

### Model 2 — Founder-owned SaaS, Solarize **strategic partner**
- You retain **core IP + source code**.
- Solarize gets a **preferential licence** and possibly **revenue share** or **pilot/market
  rights** in a defined scope (e.g. named accounts / a region), with confidentiality + market
  boundaries written down.
- **Pros (you):** aligned partner who helps sell/validate; still own the asset. **Pros
  (Solarize):** upside + priority + influence.
- **Cons:** must define boundaries carefully (exclusivity, territory, term) or it can constrain
  future EPC deals. **Recommended default** if Solarize wants to be more than a customer.

### Model 3 — Joint venture / **co-owned** commercialisation
- IP/source-code ownership must be **explicitly defined** (who owns what, background vs foreground IP).
- Solarize contributes market access, pilot data, the bank opportunity; you contribute the product.
- **Pros:** strongest partnership, shared investment. **Cons:** **highest risk to your ownership**
  — co-ownership of IP is hard to unwind and can block you from selling to other EPCs. Only
  consider with clear legal structuring and a real reason it beats Model 2.

## What NOT to give away casually
- **Source code.** A use-licence to the hosted product is enough for a pilot; do not hand over the repo.
- **IP assignment / "work made for hire" framing.** If anyone suggests Voltflow was built *for*
  Solarize as their property, address it explicitly and in writing — clarify it's your product
  that Solarize is piloting.
- **Exclusivity** without limits (scope, territory, time) — it can lock you out of Sytech + other EPCs.
- **Perpetual/free rights.** Keep licences time-boxed and renewable.

## Why the technical points matter commercially
- **Source-code access should be limited** because it's the core asset; a hosted licence protects it.
- **Data confidentiality is separate from IP** — you can (and should) sign a strong DPA/NDA while
  keeping 100% of the software IP.
- **Multi-client SaaS needs tenant isolation** — before you serve Solarize + bank + Sytech, each
  client's data must be separated (see security doc). That's a *product* requirement, and it also
  *protects the commercial story*: you can sell to competitors because their data never mixes.

## Possible agreements (have a lawyer draft these)
| Agreement | Purpose |
|---|---|
| **Pilot MOU** | Scope, duration, users, data rules, no IP transfer, success criteria |
| **SaaS licence agreement** | Right to *use* the hosted app; term; fees; restrictions (no reverse-engineering) |
| **Data Processing Agreement (DPA)** | How customer/bank data is handled, stored, deleted |
| **Confidentiality / NDA** | Protect both sides' confidential info |
| **Support / maintenance agreement** | SLA, response times, who fixes what |
| **Reseller / partner agreement** | If Solarize helps sell Voltflow — commission/territory/boundaries |
| **IP-ownership clarification** | Written confirmation the IP/source is founder-owned (address any "built at Solarize" ambiguity now) |

## Suggested stance for the call
"Voltflow is my product. I'd like Solarize to be the **anchor pilot customer and strategic
partner** (Model 1 → Model 2), with a proper Pilot MOU, NDA/DPA and a SaaS licence — I keep the
IP and source, Solarize gets preferential terms and confidentiality guarantees, and we agree
formal terms before any wider or bank-facing rollout." Keep it collaborative, not defensive.
