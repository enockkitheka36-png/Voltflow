# Voltflow Creator — Data Model (v1)

Build these as **Forms** in Creator (a Form = a table). Field types use Creator's names.
Child forms link to Project via a **Lookup** field. Keep names stable — the Deluge functions
reference these field link-names.

## Form: Project
| Field (label) | Type | Notes |
|---|---|---|
| Client | Single Line | required |
| Location | Single Line | |
| Site_Type | Dropdown | Residential / Commercial / Industrial / Farm / School / Hospital |
| System_Type | Dropdown | Solar PV – Hybrid / Off-grid / Genset hybrid / EV charging / Mini-grid |
| Monthly_Bill_KES | Currency | |
| Grid_Tariff | Decimal | KES/kWh (default 22) |
| Self_Consumption_Rate | Decimal | 0–1 (default 0.9) |
| Solar_Coverage | Decimal | 0–1 (default 0.85) |
| PSH | Decimal | peak sun hours (default 5.6) |
| Panel_W | Number | watts (default 550) |
| Panel_Cost_KES | Currency | per panel |
| Battery_Module_kWh | Decimal | |
| Battery_Module_Cost_KES | Currency | |
| DoD | Decimal | 0–1 |
| Battery_Efficiency | Decimal | 0–1 |
| Backup_Hours | Number | |
| Autonomy_Days | Number | off-grid/mini-grid |
| Inverter_Headroom | Decimal | e.g. 1.25 |
| Inverter_Unit_Cost_KES | Currency | |
| Contingency | Decimal | 0–1 (e.g. 0.05) |
| VAT | Decimal | 0–1 (0.16) |
| OandM_Rate | Decimal | 0–1 |
| Design_Inputs_Hash | Single Line | sha256:… (stale-design guard) |
| Status | Dropdown | Draft / Engineering review / Quote-ready |
| Site_Type_Source | Dropdown | user_entered / inferred_from_objective / default_assumption |

## Form: Load  (Lookup: Project)
| Field | Type | Notes |
|---|---|---|
| Project | Lookup → Project | |
| Name | Single Line | |
| Qty | Number | |
| Rated_W | Number | |
| Day_Hours | Decimal | |
| Night_Hours | Decimal | |
| Duty_Cycle_Pct | Number | default 100 (fraction of rated actually drawn) |
| Surge_Multiplier | Decimal | default 1 |
| Supply_Scope | Dropdown | SOLAR / BACKUP / GRID_ONLY / EXCLUDED — **this drives sizing** (BACKUP = battery basis) |
| Demand_Factor_Pct | Number | default 100 |
| Diversity_Factor_Pct | Number | default 100 (applied at inverter stage) |

> Note: the battery/critical basis is **Supply_Scope = BACKUP** (mirrors the JS engine), not a
> separate "critical" flag. SOLAR+BACKUP feed the PV energy basis; GRID_ONLY is billing-only;
> EXCLUDED is dropped. See `deluge/loads.dg`.

## Form: Design_Revision  (Lookup: Project) — append-only
| Field | Type | Notes |
|---|---|---|
| Project | Lookup → Project | |
| Revision_Ref | Single Line | rev_<16hex> |
| Inputs_Hash | Single Line | sha256:… |
| PV_kWp | Decimal | |
| Panels | Number | |
| Battery_kWh | Decimal | |
| Battery_Modules | Number | |
| Inverter_kW | Decimal | |
| Total_Cost_KES | Currency | |
| Annual_Savings_KES | Currency | |
| Payback_Years | Decimal | |
| Issued_At | DateTime | set once; do not edit (enforce via workflow) |

## Form: Quote  (Lookup: Project + Design_Revision) — append-only
| Field | Type | Notes |
|---|---|---|
| Project | Lookup → Project | |
| Design_Revision | Lookup → Design_Revision | |
| Quote_Ref | Single Line | |
| Status | Dropdown | DRAFT / ISSUED / VOID |
| Currency | Single Line | KES |
| Supplier_Cost_KES | Currency | |
| Margin_Pct | Decimal | |
| VAT_KES | Currency | |
| Client_Price_KES | Currency | |
| Issued_At | DateTime | required when ISSUED |

## Form: Evidence  (Lookup: Project)
| Field | Type | Notes |
|---|---|---|
| Project | Lookup → Project | |
| Kind | Dropdown | photo / document / measurement |
| File | File Upload | Creator file store (not Supabase) |
| Checksum | Single Line | |
| Captured_By | Users | Creator user |
| Status | Dropdown | pending / verified |

## Form: Audit_Event  (Lookup: Project) — append-only
| Field | Type | Notes |
|---|---|---|
| Project | Lookup → Project | |
| Action | Single Line | project_created / load_committed / design_revision_issued / quote_revision_issued / evidence_added / project_exported |
| Actor | Users | |
| Occurred_At | DateTime | |
| Detail | Multi Line | JSON string |

## Access control (Creator-native — re-establish, don't assume)
- Define Creator **Roles** (Owner, Manager, Engineer, Sales, Technician, Client, Bank).
- Use **permission sets** + **field/section permissions** so Client/Bank cannot see cost/margin
  fields. Use **record-level criteria** (e.g. "created by current user's org") for tenant scoping.
- This replaces Supabase RLS and is **unproven until tested in Creator** — mirror the tenant-attack
  checks manually.
