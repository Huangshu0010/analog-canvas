# ADR 0021: Coordinate domains and grid-normalization boundary

Status: `accepted`

Date: 2026-08-14

Owners: `packages/model`, `packages/edit-engine`, `packages/derived`,
`apps/editor`, `packages/agent-adapter`

## Context

Project page coordinates, browser pointer coordinates, renderer geometry, and
SVG bounds had reused structural `Point` and `Rect` shapes. The shapes look
compatible but obey different numerical rules. In particular, rich-text
measurement, route-relative annotation placement, curve geometry, and rotated
artwork legitimately yield floats. A Fit View path wrote such a derived float
bound back into an integer camera rectangle and crashed schema validation.

The Project is current-only. There is no supported inventory of legacy
non-grid Projects that justifies a silent compatibility normalizer.

## Decision

The product has five explicit coordinate domains:

| Domain | Data | Numerical rule | Persistence |
| --- | --- | --- | --- |
| Grid | document page points and camera rectangles | finite integers, each coordinate/extent a multiple of `presentation.grid` | Project or editor session only |
| Preview | interaction and temporary drag points | finite float | never persisted |
| Derived | renderer, text, curve, rotation, hit, and diagnostic geometry | finite float | never persisted |
| Client | browser/CSS/SVG screen coordinates | finite float | never persisted |
| Symbol-local | catalog artwork coordinate system | finite float | catalog only, never a Document page point |

Every persisted Document page point is grid-aligned: Instance placement,
Junction position, Route waypoints, free/object anchor position data and
fallbacks, drafting points/waypoints/controls, and drafting centers. A typed
edit carrying such a point is held to the same rule against its target
Document's grid.

Scalars are not reclassified as points. Route attachment `t`, normal offset,
text measurements, symbol primitive geometry, and continuous drafting
rectangle bearing retain their dedicated finite-number contracts. A route
anchor may therefore resolve to a non-grid derived display position while its
persisted anchor input remains grid-valid.

Camera is a GridRect. Its origin and dimensions are aligned to the active
Document grid. Derived visual bounds reach it only through `fitCameraToBounds`,
which rounds left/top outward with floor and right/bottom outward with ceil.
Pan, zoom, focus, Document activation, project replacement, and Agent semantic
fit use the same camera normalizer; no caller may assign an SVG or derived
viewBox directly.

Domain-crossing functions are named and one-way:

```text
Client/Preview Point --snap--> GridPoint --commit--> Project
DerivedRect --outward fit--> GridRect --set camera--> editor session
GridPoint --project--> DerivedPoint --render/hit/diagnose--> read-only output
```

Document parse, import/replacement, recovery restore, and transaction payload
validation reject a non-grid Project point with its exact object path. They do
not round or migrate it.

## Consequences

- The editor and Agent cannot persist a coordinate that the grid does not
  represent.
- Renderer precision is retained and cannot corrupt Model or camera state.
- Snapshot geometry accurately reports fractional resolved locations and
  bounds to an Agent.
- Existing broad structural aliases must be replaced at package boundaries;
  this is intentional contract work, not a cosmetic rename.
- Camera zoom becomes grid-quantized. This trades arbitrary one-unit viewport
  dimensions for deterministic, grid-stable navigation.

## Validation

- Model validation names a nested non-grid Point path.
- GUI, typed-edit, Agent, import/recovery paths reject the same invalid point.
- Derived text, route-relative anchors, curve controls, and rotated drafting
  output may be fractional and survive Snapshot/render validation.
- Every camera command emits a grid-aligned positive rectangle.
- A Project-coordinate scan accepts all current fixtures and rejects a single
  deliberate non-grid mutation without changing electrical topology.

## Related documents

- [`../specs/schematic-model.md`](../specs/schematic-model.md)
- [`../specs/edit-engine.md`](../specs/edit-engine.md)
- [`../specs/editor-interaction.md`](../specs/editor-interaction.md)
- [`0010-text-annotation-drafting-schema.md`](0010-text-annotation-drafting-schema.md)
- [`0014-resolved-route-geometry.md`](0014-resolved-route-geometry.md)
