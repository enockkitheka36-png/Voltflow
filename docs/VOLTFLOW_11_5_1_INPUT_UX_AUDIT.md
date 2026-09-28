# Voltflow 11.5.1 — Numeric Input UX Audit

**Build audited:** Voltflow 11.5 · **Scope:** every numeric input in the app.

## Headline

There are ~145 `type="number"` inputs. The great majority route through two shared components — `Field` (112 call sites) and `SurveyInput` — so a single root-cause fix in those two components resolves most of the frustration at once. The load-assessment table uses its own raw inputs and needs a direct fix.

## Root cause

Both shared components commit on every keystroke with:

```js
onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
```

`Number("")` is `0` and `Number("0.")` is `0`. Because the parent stores a **number** and feeds it straight back as the input's `value`, the field is fully controlled by a number — so:

| Symptom | Why |
|---|---|
| Clearing a field snaps back to `0` | empty string → `Number("")` = 0 → parent stores 0 → input re-renders "0" |
| Can't type `0.` or a leading decimal | `Number("0.")` = 0, trailing dot is lost on the round-trip |
| Cursor jumps / caret resets | the value the user typed is replaced by the reformatted number every keystroke |
| Hard to reach a target like `585` | first digit `5` → 5, but combined with call-site clamps values fight back |

## Clamp-while-typing

168 call sites wrap onChange in `Math.max(v, 0)` or `clamp(v, 0, 24)`. With min 0 that is mostly harmless, but the hour fields use `clamp(v, 0, 24)` **on every keystroke**, so typing `25` becomes `24` before the user finishes, and the load table's `parseHours`/`parseQty`/`parseWatts` clamp live too.

## NaN / crash risk

`Number("")` = 0 (not NaN) so there is no crash today, but any field that stored `""` or an intermediate would flow NaN into `useSizing`. The fix must guarantee calculations always receive a finite fallback while the field can still *look* empty.

## Contrast / readability

Inputs use `var(--text-main)` (#0f172a) on white — adequate. Table inputs are small (0.4rem padding, 0.85rem font); acceptable on laptop but tight on mobile. The 11.4 table retrofit already improved row padding. No dark-on-dark issues found.

## Specific hotspots (all fixed via the shared-component route unless noted)

- **Load Assessment table** (`LoadRow`) — raw inputs, `parseQty`/`parseWatts`/`parseHours` clamp on keystroke. **Needs direct fix.**
- Project Setup / PV / Battery / Inverter / Finance / Carbon / EV / Mini-grid — all `<Field>`, fixed centrally.
- Survey numeric fields — `<SurveyInput>`, fixed centrally.
- Energy Import mapping/paste — text/select, not affected.
- Delivery procurement/task numeric cells — raw table inputs; low frequency, addressed opportunistically.

## Also found (folded into 11.5.1)

- **BUG-1 (from 11.5.1 validation):** the survey→project sync overwrites `project.phase` with `defaultSurvey.phaseType` ("Single Phase"), silently discarding a wizard "Three Phase" choice. One-line fix: blank `defaultSurvey.phaseType` (matching the 11.4.1 clean-startup treatment of `county`).

## Fix strategy

1. New `SmartNumberField` (buffers text locally, shows empty when empty, feeds a finite fallback to calculations, clamps on blur, rejects non-numeric keystrokes without caret loss).
2. Route `Field(type="number")` and `SurveyInput(type="number")` through it — fixes the 112+ shared call sites with no call-site changes (the `onChange(number)` contract is unchanged; existing `Math.max` wrappers become harmless safety nets on committed values).
3. Rewire the load table inputs directly and add the >24h / blank warnings.
4. Preset chips as non-forcing suggestions on key technical fields.
