# ADR 0010: Text, Annotation, and Peripheral Drafting Schema

Status: `accepted`

Date: `2026-08-08` (revised `2026-08-08` to freeze six contract gaps surfaced
in WP-A0 review: `VisualAnchor.fallbackPosition`, delete semantics, RichText
node-kind count and resource bounds, deterministic `voltage` migration,
`electricalTopologyHash`, and A1a/A1b integration-gate sequencing)

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

1. **RichText AST, V1 = four node kinds; `span` has four styles.** Rich text is
   a structured document, not an executable formula or arbitrary LaTeX/SVG/HTML.
   V1 supports exactly four `RichTextRun` discriminants:

   ```text
   RichTextRun = text | line-break
               | span(style: italic | bold | subscript | superscript; children)
               | fraction(numerator: RichTextDocument, denominator: RichTextDocument)
   ```

   Resource bounds are part of the frozen contract so recursive Zod schemas and
   Agent payloads have a stable budget: maximum nesting depth 4, maximum 64
   runs per document, maximum 256 characters per `text` run, and a
   `fraction` numerator/denominator must each be non-empty (an empty draft is
   rejected at submit, not persisted).

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
the existing `RouteAnnotationAttachment`. The `object` and `route` variants
persist a `fallbackPosition` (last-known resolved point) so a deleted or moved
target can still render. Anchor resolution reads derived Route/object geometry
only; an unresolved anchor (deleted Route/object, removed segment,
non-orthogonal segment) renders at `fallbackPosition` as a visible warning and
offers re-attach/convert-to-free/delete — it never silently re-attaches to
another conductor. "Warning state" is a **derived diagnostic**, computed by the
anchor resolver at resolve time; it is not a persisted boolean.

```typescript
type VisualAnchor =
  | { kind: "free"; position: Point }
  | { kind: "object"; objectId: StableId; localOffset: Point;
      fallbackPosition: Point }
  | { kind: "route"; routeId: StableId; segmentIndex: number; t: number;
      normalOffset: number; direction: "forward" | "reverse";
      orientation: "follow" | "horizontal"; fallbackPosition: Point };
```

In V1, `object` anchors may target only an Instance, Port, or Junction. A
DraftingObject may **not** anchor to another DraftingObject (no drafting-to-
drafting attachment, no cycles). A Route target uses the `route` variant
exclusively.

### Delete semantics for anchor targets (frozen)

Target deletion never cascades to the attached object and is never rejected
merely because an attachment exists:

- Deleting a Route or an Instance/Port/Junction that an anchor targets does
  **not** delete the attached DraftingObject/route-marker, and does **not**
  reject the delete.
- The same transaction that deletes the target writes the object's last
  resolved position into its `fallbackPosition`, then the anchor becomes
  unresolved (the resolver reports the warning diagnostic on next resolve).
- A locked DraftingObject whose target is deleted is handled by a **content
  lock does not block fallback maintenance** rule: the system may update
  `fallbackPosition` and mark the anchor unresolved despite `locked: true`,
  because this is integrity maintenance, not a user content edit. Deleting the
  target itself is still governed by the target's own lock (a locked Instance
  rejects its own delete as today).

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

`CURRENT_PROJECT_SCHEMA_VERSION` moves from `1` to `2`. The migration is
idempotent and testable, applied on read, and follows the roadmap table:

| Old annotation            | New location                          | Migration                                                            |
| ------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `instance-label`, `net-label`, `power-label` | `annotations` / SchematicAnnotation   | preserve semantics and attachment                                    |
| `current`                 | `route-marker/current`                | existing Route attachment migrated as-is                             |
| `voltage`                 | `route-marker/voltage` or `drafting.text` | deterministic rule below                                             |
| `plain-text`              | `drafting.objects[text]`              | string becomes a single `text` RichText run                          |
| `figure-caption`          | `drafting.objects[text]`              | preserve caption typography token and alignment                      |

**`voltage` migration is a deterministic rule, not a heuristic.** Schema 1
permits `routeAttachment` only on `current`, so a `voltage` annotation never
carries a Route attachment. The migration therefore:

- If the `voltage` annotation has a resolvable `attachedObjectId` (an Instance,
  Port, or Junction), migrate to `route-marker/voltage` with an `object` anchor
  using that target and the existing `offset`.
- Otherwise migrate to a free `DraftText` preserving `position`, `offset`,
  `rotation`, and `alignment`, and emit a **migration diagnostic** (stable
  `code`, the source annotation id, and a human note). The migration **must
  not** guess a Route, `segmentIndex`, or `t` from proximity, and must not
  snap to a nearby conductor.

A migration diagnostic is the single channel for "this object needs review" —
there is no ad-hoc persisted `needsReview` boolean and no temporary scattered
field.

The migration does not change Net/Route/Junction/instance and does not rewrite
original SPICE.

### Topology identity: `electricalTopologyHash`

The Agent Snapshot's existing `topologyHash` covers the whole Snapshot document
minus diagnostics — including annotations, placement, Route geometry, and
Junction expression — so the schema-2 annotation move would change it. That
breaks the "migration preserves topology identity" guarantee. WP-A1 therefore
introduces `electricalTopologyHash`, covering only electrical facts:

- instances (id, symbolId, variantId) and their pin inventory;
- ports (id, direction);
- Nets (scope, terminal membership, port membership);
- hierarchical instance-reference edges.

It excludes placement/rotation/mirror, Route geometry, Junction placement,
annotations, drafting objects, guides, and diagnostics. The migration
invariant is restated against `electricalTopologyHash`: a schema-1 Project's
`electricalTopologyHash` equals its migrated schema-2 form's. The Snapshot
field is renamed/typed accordingly in WP-A1 (the agent-api spec is updated in
this revision); clients that compared opaque hashes are unaffected because the
covered set only shrinks.

### Sequencing: A1a -> A1b -> integration gate

Because old annotation kinds are consumed by the renderer, editor, and
agent-adapter, the version switch cannot land atomically while those packages
stay read-only. WP-A1 is staged:

- **A1a** — add the v2 types, the migration function, and the anchor resolver,
  but do **not** change `CURRENT_PROJECT_SCHEMA_VERSION`. Old kinds remain
  accepted; v2 is parse-only.
- **A1b / WP-A2** — add minimal compatible consumption in the renderer and
  Snapshot (read drafting objects; keep rendering the old kinds until the
  switch).
- **Integration gate** — once every consumer is green on both old and new
  shapes, flip `CURRENT_PROJECT_SCHEMA_VERSION` to 2 and remove the old
  runtime kinds in one commit. `main` is never left in a "migrates but
  text/markers vanish" state.

### Decorative-symbol validation uses the resolver

The `floating-symbol.symbolId` -> `decorative: true` invariant cannot be
enforced by the model Zod schema alone (it needs the Symbol Catalog). It is
enforced by the **Edit Engine** at `upsert_drafting_object` time using the
Symbol Resolver, mirroring how `add_instance` validates a resolvable Symbol. A
floating symbol referencing a non-`decorative` entry, or a `decorative` entry
whose definition contains a terminal, is rejected by the Edit Engine, not by
the model schema.

## Validation

- An old (schema 1) Project migrates deterministically to schema 2; re-running
  the migration is a no-op (idempotent).
- `electricalTopologyHash` is identical before and after migration (placement,
  Route geometry, Junction placement, annotations, drafting, and guides are
  excluded from the hash).
- Migration round-trips the migration table for every old annotation kind,
  including the deterministic `voltage` rule and its migration diagnostic for
  the free-text case.
- A DraftingObject whose anchor target is deleted is retained with
  `fallbackPosition` updated and the anchor marked unresolved by the resolver;
  the delete is neither cascaded nor rejected.
- A `floating-symbol` referencing a non-`decorative` or terminal-bearing entry
  is rejected by the Edit Engine via the Symbol Resolver.
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
