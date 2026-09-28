# Voltflow 11.7 — Testing Guide (Studio)

**Build:** Voltflow 11.7 · Internal Alpha / Market-Testing.

## Automated
```bash
npm run build      # clean
npm run test:all   # 21 suites, 241 tests, 0 failures
```
New suites: `test:studio` (6), `test:templates` (7), `test:proposal-studio` (5),
`test:assets` (4), `test:explainers` (6). Pure logic is node-tested; UI is browser-verified.

## Manual — Voltflow Studio
1. Load any demo → open **🎨 Voltflow Studio** (Main group).
2. **Project blocks:** 10 blocks (Client→Delivery) with status edges + metrics. Click a block
   → it opens that tab and highlights the section. (e.g. Loads → Load Assessment.)
3. **Compare solutions:** Good / Better / Best / Custom cards show PV/inverter/battery/cost/
   payback/confidence. Click **Use this design** → coverage/backup update.
4. **Explain the numbers:** click any ⓘ button → a drawer opens with plain language, the
   formula, key inputs, assumptions, warnings and what to verify. (Try PV size, DC:AC ratio,
   borehole pump.)
5. **Start from a template** (engineer view): 13 job types. Click **Use template** on
   *Farm Solar + Borehole* → loads preload, the borehole module turns on, you land on Load
   Assessment. Click **Update Sizing**.

## Manual — Proposal Studio (Proposal tab)
6. Pick an audience mode (Client/Engineer/Technician/Lender).
7. Toggle sections on/off and reorder with ↑/↓. Save/Load the project → the config persists.

## Manual — Asset Library (Asset Library tab)
8. Switch categories; **Add** an asset → it appears under "Selected for this project"; mark
   **Prefer** / **Remove**. Export/Import → selections round-trip.

## Manual — views
9. **Client view:** Studio hides the template gallery/build actions; blocks + scenario
   comparison remain; internal detail stays hidden.
10. **Technician view:** field tabs + checklists remain foregrounded.

## Regression / safety
11. **Old project migrates:** load a pre-11.7 export → opens with default Studio config, no
    error, no data loss.
12. **Reduced motion:** OS "reduce motion" → block/card hovers + drawer animations stop.
13. **No console errors** across the Studio flow.
