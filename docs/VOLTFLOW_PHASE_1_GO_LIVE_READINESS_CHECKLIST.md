# Voltflow — Phase 1 Go-Live Readiness Checklist

**For:** Mary — Phase 1 decision document · **Build:** 11.7 preview / 11.6 production
**Classification:** Internal Alpha / Bank Pilot Readiness. **Not certified engineering approval; not legal advice.**

Priority key: **M** = must-have before bank pilot · **N** = nice-to-have · **D** = defer.
Status key: ✅ done · 🔎 needs verification · ⬜ not started · ⛔ blocked.
Owner: Me (founder) / Claude / Vincent / Mary / Solarize team.

## A. Functionality & UX
| Item | What must be done | How to verify | Owner | Pri | Status |
|---|---|---|---|---|---|
| Bank user flow simple & guided | Ship **Bank Pilot Mode** (simplified steps, standard packages, hides engineering) | Walk the flow as a non-engineer | Claude/Me | M | 🔎 (added this sprint) |
| Standard package / quote variants | Good/Better/Best scenario cards produce 2–3 variants | Generate variants on a demo lead | Me | M | ✅ |
| Clean client proposal | Client report hides internal detail | Generate Client Proposal PDF | Me | M | ✅ |
| Task/stage + approval status | Delivery stages + "submit for review" visible | Move a project through stages | Me/Solarize | M | ✅ |
| Mobile/tablet usable | Responsive layout, no overlap | Open on a phone/tablet | Solarize team | N | 🔎 |
| Empty/error states clear | No dead ends; friendly empties | Try each tab with no data | Me | N | ✅ |

## B. Security & Data Protection  *(the real gaps — read carefully)*
| Item | What must be done | How to verify | Owner | Pri | Status |
|---|---|---|---|---|---|
| No API key / raw error leakage | Key server-side only; safe error text | Grep client for key; trigger errors | Claude/Vincent | M | ✅ |
| **Real access control (login/auth)** | Decide + implement auth; **view modes are cosmetic, NOT security** | Attempt access without auth | Vincent/Me | M | ⛔ **not implemented** |
| **User cannot access others' records** | Requires accounts + server storage + tenant isolation | Two users, separate data | Vincent/Me | M | ⛔ **not implemented (browser-only today)** |
| Browser-only storage risk addressed | Show clear data-risk banner; agree what data may be entered | See banner; read data note | Claude/Mary | M | 🔎 (banner added this sprint) |
| No secrets in export bundle | Export contains only project data | Inspect an exported JSON | Claude | M | ✅ |
| HTTPS / encryption in transit | TLS on the production host | Open padlock; `https://` | Vincent | M | ✅ (Vercel) / 🔎 (VPS) |
| Safe, generic error messages | No stack traces / env names to users | Trigger failures | Claude | M | ✅ |
| Audit/activity log | Local audit log of key events | Open Evidence & Audit tab | Me | N | ✅ (local, per-browser) |

## C. Reliability & Performance
| Item | What must be done | How to verify | Owner | Pri | Status |
|---|---|---|---|---|---|
| Build green | `npm run build` clean | Run build | Claude | M | ✅ |
| Automated tests green | `npm run test:all` | Run tests | Claude | M | ✅ (21 suites/241) |
| No console errors in normal flow | Clean console on demo journey | DevTools console | Me | M | ✅ |
| Handles bad input safely | No NaN/Infinity; validation | Enter blanks/garbage | Claude | N | ✅ |

## D. Deployment & Infrastructure
| Item | What must be done | How to verify | Owner | Pri | Status |
|---|---|---|---|---|---|
| Production host decided | Vercel now; VPS staging only until hardened | Confirm with Vincent | Vincent/Me | M | 🔎 |
| SSL/HTTPS active | Managed TLS | Padlock | Vincent | M | ✅ (Vercel) |
| Production stable | Promote 11.7 only after go/no-go | Smoke test | Me | M | 🔎 (prod still 11.6) |
| Backups / export process | Manual Export JSON today; automate later | Export a project | Me/Vincent | M | 🔎 (manual only) |
| Rollback plan | Vercel instant rollback; VPS `dist.bak` | Roll back a deploy | Vincent | M | ✅ (Vercel) |
| Monitoring/logs | Basic uptime + Nginx logs (if VPS) | Check logs | Vincent | N | ⬜ |

## E. Testing & UAT
| Item | What must be done | How to verify | Owner | Pri | Status |
|---|---|---|---|---|---|
| Automated regression | Keep `test:all` green | Run suite | Claude | M | ✅ |
| UAT by Solarize users | Run the UAT plan with sales+ops | Signed UAT results | Solarize/Mary | M | ⬜ |
| Bank-like test user | Simulate a bank user pre-real-bank | UAT scenario 12 | Me/Mary | M | ⬜ |
| Go/no-go recorded | Written decision from Mary + Vincent | Signed note | Mary/Vincent | M | ⬜ |

## F. Operational Support
| Item | What must be done | How to verify | Owner | Pri | Status |
|---|---|---|---|---|---|
| Support contact / SLA | Name a support owner + response time | Agreed note | Me/Mary | N | ⬜ |
| Incident response owner | Vincent or Me on-call for pilot | Agreed note | Vincent/Me | M | ⬜ |
| User guide / training | Short bank-user one-pager | Hand to a tester | Me | N | ⬜ |
| Data export/delete on request | Export exists; delete = clear local data | Try both | Me | N | 🔎 |

## G. Legal / Business Readiness  *(business planning, not legal advice)*
| Item | What must be done | How to verify | Owner | Pri | Status |
|---|---|---|---|---|---|
| IP/ownership position clear | Agree founder-owned + Solarize role | Signed MOU/terms | Me/Mary | M | ⬜ |
| Pilot MOU / usage terms | Define pilot scope + confidentiality | Signed MOU | Me/Mary | M | ⬜ |
| Data processing / confidentiality | DPA/NDA for bank + Solarize data | Signed agreement | Me/Mary | M | ⬜ |
| Classification banner visible | "Controlled Bank Pilot Build" in UI | See banner | Claude | M | 🔎 (added this sprint) |

## Bottom line for Mary
Functionality is strong and green. The **must-have gaps are governance, not features**: real
**access control + per-user data separation** are **not yet implemented** (today's storage is
browser-only and view modes are cosmetic), UAT and a written go/no-go are pending, and the
IP/pilot terms are not yet agreed. A **controlled pilot** (limited users, non-sensitive/test
data, Solarize-supervised) can proceed once the banner + Bank Pilot Mode land and Vincent
accepts the hosting/data posture. **Do not present it as full production SaaS or as secure
multi-user bank production until access control + data isolation exist.**
