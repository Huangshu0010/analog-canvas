# ADR 0010: Text, Annotation, and Peripheral Drafting Schema

Status: `proposed`

Date: `2026-08-08`

Owners: `packages/model`, `packages/edit-engine`, `packages/render-svg`,
`apps/editor`, `packages/agent-adapter`

## Context

The current `SchematicDocument.annotations` array holds a heterogeneous union
(`instance-label | net-label | power-label | plain-text | current | voltage |
figure-caption`). Each member is a single string with a position, rotation, and
coarse `sizeScale`; only `current` may use `routeAttachment`. The renderer
parses a few subscript/italic forms by regex; the editor has separate "add
text" and "add current arrow" entry points. This does not scale: every new
visual element (arrow, leader, callout, construction line, floating symbol,
guide) would further inflate `AnnotationKind`, attachment stays a `current`
special case, and there is no place for editor-only reference geometry that
must never export or carry connectivity.

The roadmap
(`docs/roadmap/text-annotation-peripheral-editing-plan.md`) defines a coherent
text, annotation, and peripheral editing system that separates electrical
semantics from non-electrical drafting and from editor-only guides. Four
decisions must be frozen before WP-A1 can implement the model, because they
change the persisted schema and the migration contract.

## Decision

Bump the persisted Project schema major version from `1` to `2` and introduce
the text/annotation/peripheral system in one coordinated, versioned migration.
The four frozen decisions are:

1. **RichText AST, V1 = six nodes.** Rich text is a structured document, not an
   executable formula or arbitrary LaTeX/SVG/HTML. V1 supports exactly:

   ```text
   RichTextRun = text | line-break | span(italic|bold|subscript|superscript)
               | fraction(numerator, denominator)
   ```

   A restricted import shorthand (`M_{1}`, `V_{DD}`, `\it{...}`,
   `\frac{a}{b}`) is parsed to the AST on submit and is never the persisted
   truth. Unparseable shorthand is stored as plain text with a visible prompt;
   no input is ever silently dropped.

2. **`annotations` narrows to SchematicAnnotation; non-electrical text moves
   to `drafting`.** The persisted `annotations` becomes
   `instance-label | net-label | power-label | route-marker`, where
   `route-marker.markerKind` is `current | voltage`. `plain-text` and
   `figure-caption` migrate into the new `drafting.objects` container as
   `DraftText`. Net naming remains electrical (`set_net_name`), never a text
   overlay.

3. **Guides persist for collaboration but never export.** A `Guide` is a
   horizontal/vertical reference line with `locked` and `visible` state. It is
   persisted (so collaborators share alignment state) but is always
   `export: false`: it never appears in formal SVG, PNG, PDF, or in the default
   Agent Snapshot. Snapshot returns Guide count and visibility by default;
   Guide coordinates require an explicit `includeEditorGuides: true` option.

4. **`floating-symbol` is decorative-only.** A `DraftFloatingSymbol` may
   reference only Symbol Catalog entries explicitly marked `decorative: true`,
   and those definitions must contain no terminal. A floating symbol never
   creates a Pin, Net, flightline, Junction, or SPICE instance. Electrical
   power/ground/ports must use real Component/Port, never a floating symbol.

A new `DraftingLayer` container on `SchematicDocument` holds `objects`
(persistent, exportable `DraftingObject[]`) and `guides` (persistent,
non-exporting `Guide[]`). All attachable drafting objects and route markers
share one `VisualAnchor` contract (`free | object | route`) that generalizes
the existing `RouteAnnotationAttachment`. Anchor resolution reads derived Route
geometry only; an unresolved anchor (deleted Route/object, removed segment,
non-orthogonal segment) preserves a last-known `fallbackPosition`, renders as a
visible warning, and offers re-attach/convert-to-free/delete — it never
silently re-attaches to another conductor.

## Alternatives considered

### Alternative A — keep expanding `AnnotationKind` additively

- Benefits: no schema major bump; each new visual element is one enum member.
- Costs: attachment stays a `current` special case; `annotations` remains a
  heterogeneous grab-bag; editor-only guides and non-electrical drafting have
  no clean home; export/connectivity ambiguity grows with every addition.
- Reason not selected: the roadmap's audit concludes this is a model-boundary
  problem, not a missing-button problem. Additive growth is the failure mode.

### Alternative B — do not bump the major version; migrate in place under version 1

- Benefits: no version-2 fork; one less migration path.
- Costs: the narrowed `annotations` and moved `plain-text`/`figure-caption`
  change the meaning of persisted fields. Silently rewriting old Projects under
  the same version violates the existing compatibility rule (any change to
  connectivity meaning or the persisted hierarchy requires an ADR and
  compatibility analysis). Readers could not distinguish pre- from post-migrate
  Projects.
- Reason not selected: the schema's own compatibility rule requires the bump.

### Alternative C — make Guides session-local, not persisted

- Benefits: simplest Guide model; no Snapshot exposure question.
- Costs: collaborators lose shared alignment state; an Agent that resumes work
  cannot recover guide positions.
- Reason not selected: persistence with `export: false` and a default-off
  Snapshot option preserves collaboration without polluting export or the
  default Agent view.

## Consequences

### Positive

- Electrical truth (`annotations`/SchematicAnnotation) is cleanly separated
  from non-electrical drafting (`drafting.objects`) and editor-only guides
  (`drafting.guides`).
- One `VisualAnchor` contract replaces the `current`-only attachment special
  case, so arrows, leaders, callouts, and markers can all attach to a Route or
  object with the same stretch/fallback semantics.
- RichText AST makes textbook formulas (subscript, superscript, italic, bold,
  fraction, line break) authorable and render-identical across canvas, formal
  SVG, PNG, and PDF.
- Guides stop being ambiguous: they never export and never carry connectivity,
  so "is this line electrical?" has one answer.
- Floating symbols cannot accidentally become fake electrical instances.

### Negative or limiting

- A schema major version bump requires a versioned, idempotent migration and
  must not change Net/Route/Junction/instance or rewrite original SPICE.
- Old Projects are upgraded on read to the single new truth; write-back must
  not regenerate the old `plain-text` shape.
- The V1 RichText AST is deliberately small; full LaTeX, arbitrary fonts,
  Bezier paths, freehand drawing, layer-tree editing, and auto-avoidance are
  explicit non-goals for this round.
- Snapshot gains drafting objects (with canonical RichText AST) and resolved
  anchors/diagnostics; clients that ignored unknown Snapshot fields are
  unaffected, but the default Snapshot shape grows.

## Compatibility and migration

`CURRENT_PROJECT_SCHEMA_VERSION` moves from `1` to `2` in WP-A1. The migration
is idempotent and testable, applied on read, and follows the roadmap table:

| Old annotation            | New location                          | Migration                                                            |
| ------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `instance-label`, `net-label`, `power-label` | `annotations` / SchematicAnnotation   | preserve semantics and attachment                                    |
| `current`                 | `route-marker/current`                | existing Route attachment migrated as-is                             |
| `voltage`                 | `route-marker/voltage` or `drafting.text` | route/object attachment when reliable; else free text with a review prompt |
| `plain-text`              | `drafting.objects[text]`              | string becomes a single `text` RichText run                          |
| `figure-caption`          | `drafting.objects[text]`              | preserve caption typography token and alignment                      |

The migration does not change Net/Route/Junction/instance and does not rewrite
original SPICE. The electrical topology hash of a migrated Project is unchanged.

## Validation

- An old (schema 1) Project migrates deterministically to schema 2; re-running
  the migration is a no-op (idempotent).
- Electrical topology hash is identical before and after migration.
- Migration round-trips the migration table for every old annotation kind.
- WP-A1 adds model/Edit Engine/derived tests for the new container, anchor
  resolution, fallback, and typed transactions; WP-A2 proves Guide never
  appears in export bytes and DraftingObject does not affect
  connectivity/flightline.

## Related documents

- [`../../docs/roadmap/text-annotation-peripheral-editing-plan.md`](../roadmap/text-annotation-peripheral-editing-plan.md)
- [`../specs/schematic-model.md`](../specs/schematic-model.md)
- [`../specs/edit-engine.md`](../specs/edit-engine.md)
- [`../specs/agent-api.md`](../specs/agent-api.md)
- [`../specs/editor-interaction.md`](../specs/editor-interaction.md)
- [`0007-snapshot-driven-agent-workflow.md`](0007-snapshot-driven-agent-workflow.md)
