# Visual Language

Status: `accepted`

Version: `1.3`

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

| Term          | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| Formal layer  | Electrical and explanatory content included in export              |
| Overlay       | Grid, selection, hit target, preview, flightline, or diagnostic UI |
| Style profile | Versioned tokens and rendering rules selected by a Document        |

## Data model or interface

The compatibility profile ID is `textbook-monochrome-v1`.

```yaml
background: "#ffffff"
foreground: "#000000"
symbolStroke: 1
wireStroke: 1
annotationStroke: 0.8
junctionRadius: 1.75
fontFamily: "Georgia, Times New Roman, serif"
```

The proposed `razavi-textbook-v1` profile is also executable:

```yaml
foreground: "#202020"
wireStroke: 1.6
symbolStroke: 1.6
normalStroke: 1.6
emphasisStroke: 2.4
supplyStroke: 1.8
annotationStroke: 1.6
junctionRadius: 3
portOriginRadius: 3
strokeLinecap: butt
strokeLinejoin: miter
strokeMiterLimit: 4
scaleFormalStrokes: true
```

Unknown persisted profile IDs are blocking render errors; the renderer never
silently substitutes a profile. Semantic symbol roles resolve through the
selected profile. Legacy numeric primitive widths remain literal only under
`textbook-monochrome-v1`; Razavi output clusters them into profile-owned normal
or emphasis widths until the source asset is explicitly migrated.

Formal SVG has stable groups for routes, Junctions, symbols, and annotations.
The editor creates its grid and interaction overlay outside the formal group.

Annotations are semantic `instance-label`, `net-label`, `power-label`,
`plain-text`, `current`, `voltage`, and `figure-caption` objects. Current
annotations rotate the arrow independently so their text stays upright.
Explicit instance labels suppress only the renderer's default instance ID.
Their text and position are editable without changing stable instance IDs.
Net labels are formal electrical annotations tied to a logical Net; plain text
has no electrical meaning.

Derived visual diagnostics cover unplaced or unresolved symbols, symbol and
label overlap, short route segments, ambiguous Junction dots, unsatisfied
layout constraints, and optional export-page bounds. Diagnostics never mutate
geometry. Unresolved symbols and ambiguous Junction dots are blocking errors;
spacing and layout-quality findings are warnings.

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
- `textbook-monochrome-v1` keeps non-scaling formal strokes for byte
  compatibility. `razavi-textbook-v1` scales formal geometry and strokes
  together and emits no `vector-effect="non-scaling-stroke"`.
- Annotation attachment moves with an edited instance while its offset and
  semantic kind remain persisted.
- Instance-label drag is bounded around its symbol and Net-label drag is
  bounded around attached route geometry; free text is unconstrained.
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

Adding `razavi-textbook-v1` does not change existing or newly created Project
defaults yet. The default switch is an explicit RV-7 migration decision after
the acceptance board and export gates pass.

## Deterministic validation

- original SVG golden comparison
- all rotation/mirror transform tests
- repeated render equality
- formal versus overlay structural inspection
- browser export acceptance

## Open decisions

- Font embedding and cross-format metric calibration remain Phase 7 work.
