# Getting Started with v0.1

## Run from source

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open the displayed loopback URL. Use **Import SPICE** to select one `.cir`,
`.sp`, or `.spi` entry plus its local include files. Imported instances begin
unplaced so that a human or Agent can decide the presentation.

## Edit and connect

- Drag unplaced instances onto the canvas.
- Use **Wire** to connect endpoints that already belong to the same logical
  Net.
- Use **Junction** to make a visible join. A geometric crossing alone is never
  connectivity.
- Use **Detach** to remove route geometry while preserving the logical Net.
- Undo, redo, transforms, alignment, annotations, and Agent transactions all
  use the same Edit Engine and revision rules.

## Save and recover

**Save Project** downloads canonical `.icproj.json`. Edits also stage an
origin-local recovery copy. On a later start the app offers **Restore
recovery** or **Discard recovery**; recovery never silently replaces a formal
file.

Use **Open Project** to validate and reopen a formal Project file. Opening an
invalid or future-version file leaves the current Document unchanged.

The older **Save snapshot** action is a session convenience kept for the v0.1
editor demo. It is not a formal filesystem save.

## Export

SVG, PNG, and PDF contain only formal schematic layers. PNG uses 3x raster
scale. PDF v0.1 contains that same high-resolution raster on a page matching
the SVG viewBox.

## Portable release

Build the versioned bundle and start it with Node 24:

```powershell
pnpm release:package
node output/release/interactive-circuit-maker-v0.1.0/start.mjs
```

Open `http://127.0.0.1:4173`. Chromium can install the app from its browser
install action. The server accepts only loopback connections.
