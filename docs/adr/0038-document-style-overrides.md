# ADR 0038: Document Style Overrides

Status: accepted

Date: 2026-08-21

Owners: `packages/model`, `packages/project-protocol`, `packages/derived`,
`packages/edit-engine`, `packages/render-svg`, `apps/editor`

## Context

The approved style profiles are the single visual authority for base values:
typography sizes, stroke widths, and junction-dot radius. Users asked for one
document-wide way to tune font size, wire thickness, symbol and drafting
stroke weight, and dot size — with today's rendering as the untouched default
and bounded freedom on top. Per-object mechanisms (annotation `sizeScale`,
drafting `strokeScale`) already exist and stay unchanged; they compose after
the document-level intent.

## Decision

Schema 21 adds an optional `presentation.styleOverrides` object of bounded
scale factors, each `0.5–2` and independent: `fontScale` (whole typography
system), `wireStrokeScale` (wire strokes), `symbolStrokeScale` (symbol
artwork strokes including emphasis, ground, supply, and power-rail bars),
`annotationStrokeScale` (drafting/annotation strokes), and
`junctionRadiusScale`. An absent factor means exactly `1.0`; a document
without overrides resolves to the base profile object itself and renders
byte-identically.

`resolveDocumentStyleProfile(presentation)` in `@icm/derived` is the single
composition point; every consumer (derived geometry, both render paths,
exporters, editor) resolves through it. The base profiles remain the only
source of base values — overrides are explicit persisted user intent scaled
on top, never a second style authority.

The existing `set_presentation_style` typed edit gains an optional
`styleOverrides` payload: omitted leaves the persisted value untouched,
`null` clears it, an object replaces it whole. GUI and Agent use the same
edit; changes are transactional and undoable.

Per ADR 0023's rolling window, `packages/project-protocol` reads schema 21
and schema 20; the direct upgrade stamps the current version (the new field
is optional). Schema 19 support rolls off. Persistence writes only schema 21.

## Consequences

- Uniform one-knob restyling of a whole document without touching the
  reviewed profile or symbol contracts; defaults remain pixel-identical.
- The bounded range keeps output legible and export-safe; anything outside
  `0.5–2` is a schema rejection, not a clamped surprise.
- Fixtures, goldens, and prior projects are unaffected until a document
  explicitly opts in.
- One more rolling-window advance: schema-19 files now require re-saving
  through a schema-20-capable build first.
