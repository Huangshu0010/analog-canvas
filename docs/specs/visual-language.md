# Visual Language

Status: `accepted`

Version: `1.6`

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
normalStroke: 1.2
emphasisStroke: 2.16
supplyStroke: 1.8
annotationStroke: 1.6
junctionRadius: 3.779070
portOriginRadius: 3.779070
strokeLinecap: butt
strokeLinejoin: miter
strokeMiterLimit: 4
scaleFormalStrokes: true
fontFamily: "Arial, Helvetica Neue, Helvetica, sans-serif"
mathWeight: 700
mathStyle: italic
instanceFontSize: 16
netFontSize: 16
powerFontSize: 16
annotationFontSize: 16
captionFontSize: 14
subscriptScale: 0.68
subscriptBaselineShift: 0.30em downward
labelGap: 6
supplyBarWidth: 20
currentArrowLength: 53.488372
arrowHeadLength: 15.116279
arrowHeadWidth: 8.720930
currentLabelGap: 6.976744
polarityOffsetX: 12
polarityHalfGap: 8
```

Unknown persisted profile IDs are blocking render errors; the renderer never
silently substitutes a profile. Semantic symbol roles resolve through the
selected profile. Legacy numeric primitive widths remain literal only under
`textbook-monochrome-v1`; Razavi output clusters them into profile-owned normal
or emphasis widths until the source asset is explicitly migrated. Migrated
Visio assets use exact reviewed roles (`1.2` normal and `2.16` emphasis) and
retain finite-decimal geometry.

For Razavi formal output, a positioned signal Port renders as a filled origin
circle. A Port attached to a `power-label` renders a supply bar instead of an
origin circle. Explicit Junctions render independently; device-pin anchors,
ordinary corners, and geometric crossings never acquire a dot from appearance
or degree alone. Current and voltage annotation geometry is derived from the
annotation kind and profile tokens, not text glyphs or editor overlays.

Formal SVG has stable groups for routes, Junctions, symbols, and annotations.
The editor creates its grid and interaction overlay outside the formal group.

Annotations are semantic `instance-label`, `net-label`, `power-label`,
`plain-text`, `current`, `voltage`, and `figure-caption` objects. Current
annotations rotate the arrow independently so their text stays upright.
Explicit instance labels suppress only the renderer's default instance ID.
Their text and position are editable without changing stable instance IDs.
Net labels are formal electrical annotations tied to a logical Net; plain text
has no electrical meaning.

Under `razavi-textbook-v1`, instance identifiers and recognized voltage,
current, power, and pin labels are composed into deterministic SVG
`<tspan>` runs. An explicit underscore selects the subscript; otherwise an
instance designator or leading `V`/`I` is the base. Trailing `+` and `-` signs
remain upright. Notes and figure captions are never parsed implicitly. The
persisted annotation string remains unchanged, and the same composed formal
SVG scene feeds SVG, PNG, and PDF export.

Derived visual diagnostics cover unplaced or unresolved symbols, symbol and
label overlap, short route segments, ambiguous Junction dots, unsatisfied
layout constraints, and optional export-page bounds. Diagnostics never mutate
geometry. Unresolved symbols and ambiguous Junction dots are blocking errors;
spacing and layout-quality findings are observations.

Every finding declares `category`, `confidence`, and `gateEligible`.
Structural findings describe high-confidence model, topology, or explicit
constraint conditions. Visual observations describe heuristic geometry and
require inspection of the formal render. A gate-ineligible observation must
never become an automatic layout objective merely because a recipe lists its
code. Where deterministic primitive bounds exist, overlap analysis uses the
active symbol variant's visible geometry and clusters repeated overlaps.

## Invariants

- Formal output is black on white with no gradients, shadows, or decorative
  frames.
- Symbol geometry uses square line caps and miter joins unless a reviewed
  symbol explicitly requires another choice.
- Instance transforms apply local x-coordinate mirror, then rotation, then
  translation, matching the model coordinate contract.
- Instance and pin text is emitted outside component transforms, so component
  rotation and mirroring cannot rotate or mirror its glyphs.
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
- Port-origin circles and supply bars are mutually exclusive presentations of
  their attached semantic Port.
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
