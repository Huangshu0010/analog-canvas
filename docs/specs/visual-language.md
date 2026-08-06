# Visual Language

Status: `accepted`

Version: `1.0-initial`

Owning phase: `Phase 1/5`

Primary owner: `packages/render-svg`, `apps/editor`

## Purpose

Define the first formal schematic output style and keep export content separate
from editor-only interaction overlays.

## Consumers

- native SVG editor canvas
- `packages/render-svg`
- symbol compiler and annotation renderer
- SVG, PNG, and PDF exporters
- visual diagnostics and golden tests

## Terminology

| Term | Meaning |
|---|---|
| Formal layer | Electrical and explanatory content included in export |
| Overlay | Grid, selection, hit target, preview, flightline, or diagnostic UI |
| Style profile | Versioned tokens and rendering rules selected by a Document |

## Data model or interface

The initial profile ID is `textbook-monochrome-v1`.

```yaml
background: "#ffffff"
foreground: "#000000"
symbolStroke: 1
wireStroke: 1
annotationStroke: 0.8
junctionRadius: 1.75
fontFamily: "Georgia, Times New Roman, serif"
```

Formal SVG has stable groups for routes, Junctions, symbols, and annotations.
The editor creates its grid and interaction overlay outside the formal group.

## Invariants

- Formal output is black on white with no gradients, shadows, or decorative
  frames.
- Symbol geometry uses square line caps and miter joins unless a reviewed
  symbol explicitly requires another choice.
- Instance transforms apply local x-coordinate mirror, then rotation, then
  translation, matching the model coordinate contract.
- Object and layer ordering is deterministic by stable ID and fixed layer
  order.
- Selection, hit targets, grid, drag preview, diagnostics, and flightlines are
  absent from formal SVG export.
- SVG is derived output and never becomes connectivity or persistence truth.
- Visual goldens use original project fixtures, not copied textbook artwork.

## Operations and state transitions

```text
SchematicDocument + Symbol Resolver + optional bounds
→ validate
→ deterministic formal scene
→ SVG document
```

Viewport bounds may differ from export bounds. Export derives bounds from
placed symbol geometry plus an explicit integer margin.

## Persistence boundary

The Document persists `styleProfileId`, placement, annotations, and presentation
intent. Render scenes, SVG XML, grid, viewport, and overlay state are transient.

## Valid example

The Phase 1 rendered fixture produces `phase-1-manual.svg` with one formal
group and no editor overlay terms.

## Rejected example

An exported SVG containing a `hit-target`, `selection`, `editor-overlay`, or
grid pattern fails formal-layer validation even if the on-screen canvas is
correct.

## Compatibility and migration

Phase 1 proportions are provisional. Phase 5 may calibrate artwork and tokens,
but a changed golden requires visual review and a profile-version decision when
the change is not backward-compatible.

## Deterministic validation

- original SVG golden comparison
- all rotation/mirror transform tests
- repeated render equality
- formal versus overlay structural inspection
- browser export acceptance

## Open decisions

- Final typography metrics, annotation richness, VSS normalization, and dense
  analog spacing are resolved with Phase 5 evidence.
