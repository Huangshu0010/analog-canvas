# ADR 0011: Retire Visio/VSS as Visual Authority

Status: `accepted`

Date: `2026-08-09`

Owners: `packages/symbols`, `packages/render-svg`, `fixtures/visual-reference`,
`docs`

## Context

The repository previously treated `lib/circuit.vss`, its decoded master IR,
Visio-exported SVGs, and `generate-visio-*` scripts as a development-time
source for Razavi-style symbols. That route introduced separate coordinate,
marker, and stroke conventions before browser SVG rendering. Its results do
not match the approved Razavi textbook screenshot. Repeated parameter tuning
cannot make an unapproved source authoritative.

The user supplied the approved screenshot and designated it as the sole visual
reference. The product needs an unambiguous boundary so a future contributor,
Agent, script, or build target cannot silently reintroduce VSS-derived visual
geometry.

## Decision

`fixtures/visual-reference/razavi-reference-v1/manifest.json` and the raster
assets it hashes are the **sole authority** for all visual decisions: component
geometry, stroke hierarchy, arrowheads, typography, annotations, and visual
acceptance tests.

The following are retired historical archives, not product inputs:

- `lib/circuit.vss`;
- `tools/vss-import/`;
- `scripts/generate-visio-*.mjs`;
- `fixtures/symbols/vss-ir/`, `fixtures/visual-reference/visio-*`, and VSS
  review/contact-sheet artifacts.

The root package exposes no VSS/Visio generation, export, review, or check
command. New code, tests, documentation, and agent guidance MUST NOT invoke,
extend, or cite this archive as visual evidence. A historical asset may retain
VSS provenance temporarily while it is re-authored from the raster reference,
but that metadata is not an authorization to regenerate or visually calibrate
the asset from VSS.

## Alternatives considered

### Keep VSS as a secondary visual reference

- Benefit: fewer immediate migrations.
- Cost: conflicting authorities make every visual discrepancy ambiguous.
- Reason not selected: the approved screenshot must win deterministically.

### Delete all VSS files immediately

- Benefit: no accidental reuse.
- Cost: breaks historical commits and existing provenance checks before all
  legacy entries have raster-authored replacements.
- Reason not selected: archive first, then remove only after each dependency
  has been migrated deliberately.

## Consequences

### Positive

- One visual oracle makes pixel-diff acceptance meaningful.
- The active developer interface cannot accidentally run a VSS generator.
- Symbol work separates electrical pin semantics from visual authoring.

### Negative or limiting

- Legacy source files remain in the repository temporarily and must be treated
  as read-only archive material.
- Catalog provenance migration is required before the archive can be physically
  removed.
- VSS tooling is unavailable through supported commands, even for exploratory
  comparison.

## Compatibility and migration

Existing Projects and SPICE semantics are unchanged. This is a visual-source
boundary, not an electrical-model change.

Each legacy catalog entry must be migrated in a bounded target:

1. measure and crop the approved raster reference;
2. author final Symbol DSL geometry directly from that reference;
3. replace `vss-master-ir` generation provenance with
   `razavi-raster-reference` provenance;
4. add fixed browser/SVG raster-diff acceptance;
5. only then remove the corresponding archive dependency.

No migration may use VSS coordinates, markers, line weights, or fonts as a
fallback. If the raster reference lacks sufficient evidence, the entry remains
unreviewed rather than using VSS to fill the gap.

## Validation

- Root package scripts contain no `visio` or `vss` command.
- Active Razavi catalog checks run without invoking a VSS/Visio generator.
- New visual fixtures name and hash the raster reference manifest.

## Related documents

- [`../specs/razavi-textbook-style.md`](../specs/razavi-textbook-style.md)
- [`../overall-product-plan.md`](../overall-product-plan.md) (older VSS
  workflow statements are superseded by this ADR)
- [`../../fixtures/visual-reference/razavi-reference-v1/manifest.json`](../../fixtures/visual-reference/razavi-reference-v1/manifest.json)
