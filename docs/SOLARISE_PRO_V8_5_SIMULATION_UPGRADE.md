# Solarise Pro v8.5 — Installer Simulation Studio Upgrade

## What the Installer Simulation Studio does

The Installer Simulation Studio is a **planning and technician guidance module** embedded in Solarise Pro. It is not a structural design tool, CAD system, or licensed engineering document generator. It helps solar engineers and installers:

- Visualise panel layout on a 2D SVG roof canvas
- Plan across multiple roof faces (main roof, garage, carport, ground mount)
- Generate string and MPPT assignments
- Place inverter, battery, DB, and accessory markers
- Estimate cable route lengths
- Complete an installation sequence checklist
- Record as-built commissioning data and compare to planned values
- Export a simulation summary to PDF alongside the financial proposal

---

## Multi-Roof Face Workflow

1. Go to **Installer Simulation → Multi-Roof tab**
2. The primary roof face is pre-populated from your Site Survey / Roof & Shading data
3. Click **+ Add Roof Face** to add a garage roof, carport, or ground mount area
4. Set dimensions, pitch, azimuth, condition and usable % for each face
5. Mark faces as **Selected for PV** or excluded
6. The panel distribution engine allocates panels to faces in order of suitability (orientation, condition, area)
7. View per-face capacity, allocated panels, and fit status
8. The Dashboard and System Options use the total multi-roof capacity for roof-fit badges

---

## Assisted Manual Layout Workflow

1. In the **Layout tab**, the SVG canvas shows auto-placed panels
2. Obstruction management: click **+ [obstruction type]** to add obstructions with x/y/width/height as % of roof dimensions
3. Obstructions are excluded from panel placement automatically
4. Switch between **Portrait / Landscape / Auto** orientation
5. Select cable exit side: Bottom / Left / Right / Top
6. **Reset to Auto** clears any manual overrides

---

## String / MPPT Planner Workflow

1. Go to **Installer Simulation → Strings tab**
2. Set MPPT count and strings per MPPT to match your inverter datasheet
3. Click **⚡ Regenerate String Plan** to create an auto string assignment
4. Review per-string Voc cold (flagged red if exceeds inverter max DC voltage)
5. Change MPPT assignment per string using the dropdown
6. String table shows colour coding that matches the roof canvas
7. If string count > 2, combiner box advisory appears automatically

---

## Simulation-Informed BoQ

The BoQ tab includes an **advisory section** showing:
- DC / AC cable quantities estimated from simulation cable lengths
- Combiner box if string count > 2
- DC isolator, SPD items
- Alternative mounting advisory if roof cannot fit required panels

These are flagged as *planning estimates* and must be confirmed on site.

---

## As-Built Handover Workflow

1. After installation, go to **Installer Simulation → As-Built tab**
2. Enable As-Built Mode
3. Record: actual panels installed, cable lengths, installer name, commissioning date
4. Tick commissioning tests: earthing continuity, insulation resistance, monitoring configured, client handover
5. Enter measured Voc and Isc per string — the tool flags deviations > 10% (Voc) or 15% (Isc)
6. As-built data is saved with the project and included in PDF export

---

## Technician View Workflow

1. Click **Switch to Technician View** button in the Installer Simulation header
2. A full-screen overlay appears showing:
   - System quick-reference (PV, battery, inverter, string plan)
   - Critical and warning alerts
   - Installation sequence checklist
3. The Technician View hides all financial/sales data — safe for on-site use
4. The overlay is printable (use browser Print → Save as PDF)
5. Close by toggling the header button

---

## Recommended Solarise Internal Workflow

| Step | Action | Tool |
|------|--------|------|
| 1 | Complete client survey and roof measurements | Field Survey tabs |
| 2 | Confirm roof dimensions, condition and orientation | Roof & Shading tab |
| 3 | Generate roof layout | Installer Simulation → Layout |
| 4 | Add obstructions | Installer Simulation → Layout |
| 5 | Add multiple roof faces if needed | Installer Simulation → Multi-Roof |
| 6 | Confirm panels fit; adjust if needed | Multi-Roof summary |
| 7 | Generate string / MPPT plan | Installer Simulation → Strings |
| 8 | Place inverter, battery, DB locations | Installer Simulation → Equipment |
| 9 | Review cable route estimates | Installer Simulation → Cables |
| 10 | Review all installer warnings | Installer Simulation → Warnings |
| 11 | Generate proposal / PDF | Output → Proposal |
| 12 | On installation day: use Technician View | Header toggle |
| 13 | After installation: complete As-Built mode | Installer Simulation → As-Built |
| 14 | Export handover record | As-Built → Save / PDF |

---

## Limitations

| Limitation | Status |
|-----------|--------|
| Rectangular roofs only | v8.5 — L-shapes need two faces |
| No full drag-and-drop | Arrow controls planned for v9 |
| No 3D visualisation | 2D SVG only |
| String layout not shown on canvas | Per-string colour coding available |
| No wind loading or structural calculation | Always requires on-site qualified engineer |
| No KPLC/EPRA submission output | Proposal and SLD required separately |
| PDF simulation summary is text only | No SVG canvas in PDF yet |

---

## Disclaimer

The Installer Simulation Studio is a **planning and technician guidance tool only**.

It does **not** replace:
- Structural roof assessment
- Wind loading calculation
- Waterproofing method statement
- Full cable ampacity and protection coordination design
- Earthing and bonding design
- KPLC / EPRA interconnection approval
- Licensed engineering sign-off

All installation work must be carried out by qualified personnel in accordance with applicable regulations, product manuals, and safe work practices.
