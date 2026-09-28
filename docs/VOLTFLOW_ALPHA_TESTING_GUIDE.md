# Voltflow Internal Alpha — Testing Guide

**Build:** Voltflow 11.7 — Evidence Reports + Cloud-Ready Project Record
**Live URL:** https://voltflow-alpha.vercel.app (11.6 in production; 11.7 in preview pending approval)
**Classification:** Voltflow Internal Alpha / Market-Testing Build. **Not production SaaS.**

## New in 11.7 — Voltflow Studio (see VOLTFLOW_11_7_STUDIO_CANVA_LIKE_BUILDER.md)
- **🎨 Voltflow Studio** tab (Main group): visual project blocks (click to jump), Good/Better/Best/Custom **scenario cards**, a 13-item **template gallery**, and an **"Explain the numbers"** hub with plain-language + formula drawers.
- **Proposal Studio** (Proposal tab): pick audience mode + choose/reorder the 17 proposal sections.
- **Asset Library** tab: browse a 12-category component catalogue, add assets to the project, mark preferred.
- New persisted fields (template/scenario/proposal-config/asset-selections/studio-progress) migrate old projects safely; localStorage + Export/Import unchanged.

## Also in 11.7 — Evidence Reports (see VOLTFLOW_11_7_EVIDENCE_REPORTS_AND_CLOUD_READY_RECORD.md)
- **Formal reports** on the Proposal tab: Client Proposal / Engineer Review / Technician Handover / Lender-Grant Readiness PDFs. Client hides internal detail; engineer has the technical basis; technician has checklists; lender has assumptions + unresolved risks.
- **Compliance** tab (Kenya-first: EPRA, net-metering, NEMA, county/fire, ODPC, procurement, e-waste, WRA water permit).
- **Evidence & Audit** tab: evidence record (who/confidence/version/approval), pilot KPIs, and a local activity log (project created, loads applied, import/export, reports generated, warning overrides).
- **Solar Borehole → Pump curve & test report** card (feasibility shell; "final pump selection requires pump curve and borehole test confirmation").
- Version **Voltflow 11.7**; schema **11.7** (evidence/compliance/pilot + borehole test-report fields persisted; old projects migrate safely).

## New in 11.6 (see VOLTFLOW_11_6_TESTING_GUIDE.md for the full checklist)
- **Solar Borehole module** (Specialist Modules → Solar Borehole): enable it, estimate water demand, enter borehole data → get pump/PV/tank + warnings; appears in BoQ, Proposal, Action Center, Advisor; saves/imports.
- **Inverter/PV coherence:** the Inverter + Safety tab now explains *why* the inverter was picked (load-led vs PV-led), interprets the DC:AC ratio with corrective options, adds load-diversity factors, and clarifies requested vs effective panels/string.
- **Market-safety:** AI Assistant fallback is now generic ("not enabled in this environment") with no env-var name; floating buttons moved to a Help dock that never overlaps inputs.
- Version now shows **Voltflow 11.6**; schema **11.6** (borehole persisted — old projects migrate safely).

---

## What this is

A hosted alpha of the Voltflow solar EPC platform (survey → load assessment →
sizing → simulation → BoQ → proposal → as-built) for internal testers. It is a
feasibility/planning aid — it does **not** replace licensed engineering
sign-off, structural or wind-load design, protection coordination, cable
ampacity design, earthing design, or KPLC/EPRA approval.

## New in 11.5.2 — readiness sync, Action Center, alerts, guided navigation

Do these after loading a project (start a new one, or load any demo).

**Readiness Dashboard**
1. Open the **Dashboard** tab. Confirm a readiness ring (0–100 score), a status
   pill, key sizing metrics, a critical-blockers panel, "next actions", and a grid
   of section progress cards. (The old financial view is now **Sizing Overview**.)
2. Switch **Client view** / **Technician view** (top-left) — the dashboard content
   and available cards adjust; switching back to **Engineer view** restores everything.

**Load inventory progress**
3. Open **Load Assessment**, edit a load (change a watt/qty value) but do **not**
   click Update Sizing. Return to the Dashboard — the Load Inventory card should say
   **"Load inventory edited but not applied. Click Update Sizing."** and the Action
   Center should list a pending-changes warning.
4. Click **Update Sizing**. The Load Inventory card should flip to **complete** and
   the pending warning should clear immediately (no reload).

**Missing-field + safety alerts**
5. On a project with gaps, confirm missing required fields appear in the Action
   Center and as glow-highlighted items. Confirm the Advisor, Dashboard and Action
   Center agree on the score and blockers.
6. Force a safety issue (e.g. an inverter with too-low max DC voltage so **cold Voc
   exceeds the limit**, or a demo with an AC-cable ampacity flag). Confirm it shows
   as a **critical** blocker in the Dashboard, Advisor and Action Center.

**Project Action Center**
7. Click the floating **🎯 Action Center** button (engineer/technician). Confirm the
   drawer lists items by priority with **Go fix →** buttons. When critical blockers
   exist, the FAB **pulses** (unless you have reduced motion enabled).
8. Click **Go fix** on an item — it should switch to the right tab, **highlight** the
   target card/field (glow + scroll), and close the drawer.

**Proposal gate**
9. Open **Proposal** and click **Download PDF Quotation** on a project with blockers.
   A warning modal should list the blockers/required items with **Review first →**,
   **Continue anyway**, and **Cancel**. "Review first" jumps to the first blocker;
   "Continue anyway" generates the PDF with the disclaimer.

**Night-load / flood-lighting**
10. Load the **Off-grid Farm** or **EV Charging** demo (night-heavy). Open **Battery**
    and confirm a **Night-load autonomy** card (night share, critical night energy,
    usable battery, coverage, estimated night autonomy). If coverage < 100 %, a
    caution appears on the Battery card, Dashboard, Advisor, proposal and Action
    Center. Confirm a normal day-dominant residential load does **not** trigger it.

**Guided navigation / Back**
11. From the Dashboard, click a section progress card → it opens that tab and
    highlights the target. Use **← Back** (Advisor / Action Center) to return to the
    previous view. With no previous view, Back returns to the Dashboard.

**Reduced motion**
12. Enable OS "reduce motion" and reload — pulses/glows should stop animating
    (a static outline remains). Nothing should blink aggressively at any time.

---

## New in 11.4.1 — fresh-user testing (please do this first)

0. **Open the app as a brand-new user.** You should see the **Welcome to Voltflow**
   start screen with six entry cards — and **no client project loaded**.
   - Confirm there is **no "Karen Homeowner", no "Karen, Nairobi", no KES 35,000
     bill and no pre-filled loads** anywhere. Report immediately if you see any.
   - Confirm no project tabs appear in the sidebar until a project exists.
0a. **Start New Project** — walk the 5 steps (client → site → objective → load
    source → create). Check you land on the tab matching your chosen load source
    and that the sidebar shows your client name under ACTIVE PROJECT.
    - In step 2, confirm **"Nairobi / Karen" is still offered as a site profile** —
      that is real Kenya solar data and must stay.
0b. **Try Demo Project** — load any of the six demos. Confirm the purple
    **DEMO PROJECT** banner, the DEMO DATA flag in the sidebar, and that the
    client name starts with "DEMO — ". Then use **"Use as template for a real
    project"**, enter a real name, and confirm the badge disappears.
0c. **Import Project JSON** — import a file exported from 11.3/11.4 and confirm
    the staged review appears before anything is applied.
0d. **Continue Last Project** — save a project, return to the start screen via
    the sidebar link, and confirm the card offers to resume it. It must **never**
    open automatically.
0e. **Upload Energy Data** from the start screen — confirm it takes you straight
    to Energy Data Import with a blank (unnamed) project.

## New in 11.5 — Voltflow Delivery testing

D1. **Open Project Delivery** (sidebar, "Delivery" section). Check the stage bar,
    progress %, next actions, blockers and the four summary metrics render.
D2. **Move the stage** to "Procurement" without recording client approval — you
    should get a **danger warning** telling you not to commit purchase orders,
    with a "Move anyway" option. Record Client approved + Deposit in the
    Approvals tab, then try again — the warning should clear.
D3. **Tasks** — confirm ~17 starter tasks were generated for your system type
    (genset/EV/mini-grid/blueprint projects get extra specific tasks). Add a
    task, set an owner and due date, mark one blocked and one done, and check
    the blocked one appears under Blockers on Overview.
D4. **Procurement** — click "Generate from BoQ". Confirm it lists your major
    equipment *and* the accessories/BOS lines with a total value. Then **edit a
    line** (change supplier or unit cost) and click Generate again: you must get
    a confirmation showing your edited line will be **kept**, not overwritten.
    Export the CSV and open it in Excel.
D5. **Installation checklist** — tick items across the phases, add a signed-off-by
    name and date, and confirm the progress bar moves. Then try moving the stage
    to "Handover done" with the checklist incomplete — expect a danger warning.
D6. **Issues** — log an issue at "critical" severity and confirm it appears as a
    blocker. Tick "Share this issue with the client", then switch to Client View
    and confirm only that issue is visible.
D7. **Client View** → the tab is renamed **Project Progress** and shows a simple
    milestone timeline. Confirm there are **no costs, no procurement table and no
    internal issues**. Report immediately if you see any internal figure.
D8. **Technician View** → confirm Delivery shows only Overview, Installation,
    My tasks and Issues — no procurement, no approvals, no stage board.
D9. **Save/Export/Import** — save the project, export the JSON, then re-import it
    and confirm the review screen reports delivery data and its stage, and that
    tasks/issues/checklist survive the round-trip.

## New in 11.5.1 — field usability & advisor

U1. **Number fields** — on any technical field (PV, Battery, Inverter, Finance)
    and in the load table: clear a field and confirm it stays **empty** (no
    snapped-back 0), type a decimal like `0.5` and a value like `585`, and
    confirm the cursor never jumps. Out-of-range values should correct only
    when you leave the field, not mid-type.
U2. **Preset chips** — under Panel Wattage, Inverter Max DC V, AC Voltage and
    the cable-size fields, click a chip (e.g. 585 W) and confirm it fills the
    field; then type your own value over it and confirm manual entry wins.
U3. **Load table** — add a load, type qty/watts/hours smoothly; set day + night
    hours above 24 and confirm the amber ">24 h" warning; leave watts blank and
    confirm the blank warning.
U4. **Project Advisor** (AI Assistant tab, top card) — confirm it shows a
    verdict, next-3-actions, missing data and warnings **without any AI key
    configured**. The AI chat below should say it's not configured yet and point
    you to the Advisor.
U5. **Market readiness checklist** (Send Feedback tab, bottom) — confirm the
    auto-ticked items and that you can tick the manual ones; read the
    "What Voltflow does" summary.

## What testers should test

1. **Full workflow pass** — New Project → sizing basis → Site Survey → Load
   Assessment (add/edit loads, Update Sizing) → Eng. Compliance → Installer
   Simulation → System Options → Readiness → Proposal.
2. **Load Assessment control** — invalid rows must block Update Sizing with a
   red banner; Reset Changes must restore; duplicates (⧉) must work.
3. **Energy Data Import** — upload a real logger CSV/XLSX or paste interval
   data; check column mapping, day/night split (06:00–18:00 EAT), peak/P95,
   charts; generate draft loads and commit them.
4. **Blueprint mode** — pick "Blueprint / new build", generate template loads
   for a building type you know, sanity-check the numbers.
5. **PDF exports** — Proposal → both PDF buttons; open the files and read the
   Load Summary, Simulation Summary and (if used) Blueprint/Energy sections.
6. **Save / Export / Import** — save locally, Export JSON, re-import the same
   file (a review summary appears before anything is applied).
7. **Phones and tablets** — field technicians will use small screens; report
   anything unusable on mobile.

### New in 11.4 — please test these specifically

8. **View modes** (sidebar, top of the nav — Engineer / Client / Technician):
   - Switch to **Client view**: you should see only Dashboard, Sizing Overview,
     Proposal and AI Assistant, with a plain-language summary (recommended
     system, monthly saving, payback, backup hours, next steps) and no
     technical tables. Ask yourself: *would a real client understand this
     page without an engineer present?*
   - Switch to **Technician view**: survey, roof, installer simulation,
     readiness and as-built should be front and centre; financial tabs hidden.
   - Switch back to **Engineer view**: every tab must return. Report immediately
     if anything is missing.
9. **AI Assistant** (✨ button bottom-right, or the sidebar tab):
   - If no API key is configured you should see a clear
     "AI assistant is not configured" notice — **the rest of the app must keep
     working normally**. That is expected behaviour, not a bug.
   - If a key is configured, try the suggested prompts ("What data is missing
     before proposal?", "Explain this sizing in simple client language").
   - Check the **"What the assistant sees"** table — confirm it contains no
     phone numbers, photos, GPS coordinates or saved-project data.
   - Remember: assistant answers are **advisory and may be wrong**, and never
     constitute certified engineering advice.
10. **Proposal PDF buttons** — click "Download PDF Quotation" and "Download Full
    Report": the button should show a spinner, disable itself during
    generation, and show a success toast. Confirm the file opens, and that the
    proposal now includes the Investment & next steps block (investment,
    payment terms placeholder, exclusions, next steps).
11. **Feedback button** (🐞 bottom-right, hidden in Client view) — submit a test
    report with the project-snapshot checkbox ticked, then Export Feedback JSON.
12. **Mobile view** — open the app on a phone: tables should scroll sideways with
    a "↔ scroll" hint rather than clipping, cards should stack, and buttons
    should stay tappable. Report any horizontal page scroll or overlapping text.

## Known limitations (do not report these as bugs)

- **Projects save in your browser only.** No accounts, no cloud sync yet.
  Clearing browser data, incognito mode, or switching devices loses local
  saves — **Export JSON is the only durable backup.**
- Feedback is also stored on your device until you export and send it.
- The Energy Data Import raw rows are kept for the session only; re-analysis
  after a page reload needs the file again (the summary is kept).
- Data logger import assumes site-local (EAT) timestamps.
- Synthetic "logger profile" loads are an energy-envelope estimate, not an
  appliance inventory.
- BOS/accessories totals are a procurement reference, kept separate from the
  headline BoQ total by design.
- No user accounts, roles, or multi-user collaboration yet.

## How to export a project (backup / share)

Save / Load tab → **Export current project JSON** → send the file via email or
WhatsApp. Anyone can re-open it via **Import JSON project** on the same tab —
an import summary with version warnings appears before it is applied.

## How to report bugs / give feedback

Click the **🐞 Send Feedback / Report Issue** button (bottom-right, always
visible) or the "Send Feedback" sidebar entry:

1. Fill in your name, role, the tab where it happened, and the issue type
   (Bug / Calculation concern / UI issue / Missing feature / Proposal issue).
2. Describe what happened and what you expected — for calculation concerns,
   include the numbers you expected.
3. Tick **"Attach a snapshot of the current project JSON"** for calculation
   issues so the team can reproduce your exact inputs.
4. Submit, then use **Export Feedback JSON** and send the file to the Voltflow
   team. Feedback does not upload automatically in this alpha.

## What not to rely on yet

- Long-term storage of anything in the browser (export what you must keep).
- Final pricing — catalogue costs are defaults until supplier quotes load.
- The proposal as a client-ready commercial document without engineer review.
- Carbon revenue figures (excluded from cashflow by default, advisory only).

## Internal alpha disclaimer

This build is provided for controlled internal testing and development of
Voltflow. Outputs are feasibility-level estimates based on the data entered.
Final engineering design requires site verification, equipment confirmation,
safety checks and licensed engineering review. Do not distribute the URL or
generated documents outside the testing group.
