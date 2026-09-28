# Voltflow 11.7 — Asset Library

`src/utils/assetLibrary.js` · tests `scripts/asset-library-regression.mjs` (4) · UI: **Asset Library** tab (`assets-lib`, engineer view).

## Purpose
A reusable component catalogue foundation — the first step toward a solar component
marketplace. Browse assets, add them to a project, mark preferred. **No supplier API** yet;
prices/stock are placeholders to confirm.

## 12 categories
panels · inverters · batteries · pumps · controllers/VFD · mounting · protection · cables ·
tanks · EV chargers · generators · monitoring.

## Asset shape
`{ id, category, brand, model, capacity, unit, price, warranty, supplier, datasheetUrl,
compatibilityNotes, stockStatus }` — a brand-neutral seed catalogue ships in `DEFAULT_ASSETS`.

## API
```js
ASSET_CATEGORIES / DEFAULT_ASSETS
listAssets(category?)              // browse
getAsset(id)
createAssetSelection(id, {qty, preferred})   // attach to a project
normalizeAssetSelections(list)               // migrate/repair (caps at 200)
assetCompatibilityWarning(asset, project)    // placeholder check (e.g. 1-phase inverter on 3-phase job; pump→curve)
```

## Persistence
`project.assetSelections` (array of catalogue references + qty + preferred). Saves/exports/
imports with the project; old projects → `[]` via `normalizeAssetSelections`.

## Roadmap (not this sprint)
Supplier integrations + live pricing/stock, BoQ auto-fill from selections, engine-driven
compatibility (voltage windows, BMS comms), datasheet attachments.
