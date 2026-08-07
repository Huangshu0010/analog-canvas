# Getting Started with v0.1

## Run from source

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open the displayed loopback URL. Open **File** and use **Import SPICE** to
select one `.cir`, `.sp`, or `.spi` entry plus its local include files.
Imported instances begin unplaced so that a human or Agent can decide the
presentation. A normal launch starts with a genuinely empty `New Circuit`
Document for palette-first manual authoring.

## Edit and connect

- Use **+ Component** to search the categorized built-in library, choose a
  symbol, and click the canvas to place it. Imported unplaced instances may
  still be dragged onto the canvas.
- Click to select, `Shift`/`Ctrl`-click to extend the selection, or drag blank
  canvas to box-select. Dragging one selected instance moves the whole
  selection atomically.
- Use **Wire** or press `W`, then choose two pins, Junctions, or route segments.
  Passing across a conductor remains a Crossing; ending on one creates a
  Junction automatically. An exact multi-route intersection is rejected as
  ambiguous instead of silently merging Nets.
- Select a direct route to expose its dogleg handle. Use the contextual
  **Remove route geometry** action to keep logical membership while deleting
  only the drawn route.
- Right-click an endpoint for the distinct **Disconnect endpoint** and
  **Delete connection** actions.
- Press `R` to rotate, `F` to fit, `Ctrl+Z` to undo, and `Ctrl+Y` or
  `Ctrl+Shift+Z` to redo. Shortcuts do not fire while typing in a field.
- Use `Ctrl`+mouse wheel to zoom around the cursor and middle-button drag to
  pan. View changes do not increment the Document revision.
- Human UI and Agent transactions use the same typed Edit Engine operations and
  revision rules.

## Save and recover

**File / Save Project** downloads canonical `.icproj.json`. Edits also stage
an origin-local recovery copy. On a later start the File menu offers **Restore
recovery** or **Discard recovery**; recovery never silently replaces a formal
file.

Use **File / Open Project** to validate and reopen a formal Project file.
Opening an invalid or future-version file leaves the current Document
unchanged. The old manual snapshot buttons have been removed; recovery is
automatic infrastructure.

## Export

The **Export** menu produces SVG, PNG, and PDF containing only formal schematic
layers. PNG uses 3x raster scale. PDF contains that same high-resolution raster
on a page matching the SVG viewBox.

## Portable release

Build the versioned bundle and start it with Node 24:

```powershell
pnpm release:package
node output/release/interactive-circuit-maker-v0.1.0/start.mjs
```

Open `http://127.0.0.1:4173`. Chromium can install the app from its browser
install action. The server accepts only loopback connections.
