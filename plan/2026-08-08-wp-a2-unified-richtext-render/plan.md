# WP-A2: Unified RichText SVG Renderer, Route-Marker Rendering, Legacy-Kind Removal

## Goal

Build the single RichText SVG renderer (subscript/superscript/italic/bold/
fraction -> tspan) shared by canvas, formal SVG, PNG, and PDF; render route-
markers fully (current arrow + voltage polarity via the VisualAnchor); and
remove the legacy `plain-text`/`current`/`voltage`/`figure-caption` annotation
kinds now that route-marker + drafting.text carry their content.

## Dirty-State Decision

Worktree is clean of tracked changes (concurrent worker settled; HEAD is the
WP-A1 gate, 229/229 green). Proceed on a clean base.

## Owned Files

- `plan/2026-08-08-wp-a2-unified-richtext-render/plan.md`
- `packages/render-svg/src/rich-text.ts` (new, the unified AST -> tspan renderer)
- `packages/render-svg/src/schematic-text.ts` (delegate the simple-string path
  to a RichText AST built from parseSchematicMath; keep the legacy string API)
- `packages/render-svg/src/render.ts` (route-marker rendering via VisualAnchor;
  drafting text uses the unified renderer; remove legacy-kind branches)
- `packages/render-svg/src/rich-text.test.ts` (new)
- `packages/render-svg/src/render.test.ts` (update expectations)
- `packages/render-svg/src/drafting-render.test.ts` (drafting text now rich)
- `packages/model/src/schema.ts` (remove legacy annotation kinds)
- `packages/model/src/migration-v1-to-v2.ts` (migration targets only route-
  marker/drafting; still reads the removed kinds on the v1 input side)
- `packages/model/src/schema.test.ts` and affected model tests
- `packages/edit-engine/src/transaction.ts` (annotation edit kinds: the union
  no longer accepts removed kinds as output)
- `fixtures/**` goldens regenerated after rendering changes
- `plan/log.md`

## Read-Only Files

- `apps/editor/src/**`, `packages/agent-adapter/src/**` — consume the renderer;
  the editor still creates plain-text annotations and will be updated in WP-A3.
  NOTE: removing legacy kinds may require minimal editor/agent-adapter edits if
  they typecheck against the removed enum members; those are owned here as
  necessary fallout, not new features.

## Shared Dependencies

- `RichTextDocument`/`RichTextRun` AST (model) — the renderer's input.
- `SchematicStyleProfile` typography tokens (subscriptScale,
  subscriptBaselineShiftEm, mathWeight, mathStyle) — extended with a
  superscript convention reusing the subscript scale with positive shift.
- `VisualAnchor` resolver (derived/anchor.ts) — route-marker placement.

## Expected Work

1. `rich-text.ts`: `renderRichTextDocument(doc, profile)` -> tspan string.
   Nodes: text (escaped), line-break, span(italic|bold|subscript|superscript)
   with inherited style, fraction (numerator/denominator stacked via tspan
   with vertical shift). Bounded by the model AST limits.
2. `schematic-text.ts`: `renderSchematicTextContent` builds a RichText AST from
   `parseSchematicMath` and delegates, so the legacy string path and the AST
   path share one renderer. Monochrome stays byte-stable (flat escape).
3. `render.ts`: route-marker renders as the current arrow (current) or +/-/
   text (voltage) using its VisualAnchor (resolved position/rotation), matching
   the pre-migration current/voltage rendering; drafting text uses the unified
   rich renderer. Remove the plain-text/current/voltage/figure-caption branches.
4. Remove the legacy kinds from `AnnotationKindSchema`; migration still
   translates them on the v1 input.
5. Regenerate goldens; update tests.

## Validation

- `npx vitest run` -> all green
- `npx tsc -p tsconfig.check.json --noEmit` -> clean
- rich-text test: `V_{in}^{+}`, `\frac{g_m}{r_o}`, italic/bold render to the
  expected tspan structure
- route-marker current arrow renders at the resolved anchor; voltage renders
  polarity
- goldens regenerated and `--check` stable
- `git diff --check`, `git status --short --branch`

## Commit Intent

```text
feat(render): unified RichText renderer and route-marker rendering (WP-A2)
```

## Scope note (revised during work)

Removing the legacy `plain-text`/`current`/`voltage`/`figure-caption` kinds is
deferred to WP-A3. The editor UI (`App.tsx`) creates those kinds interactively
("add text" -> plain-text, "add current arrow" -> current); removing them
without the WP-A3 editor rewrite would leave the editor unable to create
annotations. WP-A3 rebuilds the editor to author drafting text / route-markers
directly, and removes the legacy kinds in the same change. WP-A2 delivers the
two render-side acceptance items: the unified RichText tspan renderer (sub/
super/italic/bold/fraction) shared by canvas/formal/PNG/PDF, and full
route-marker arrow/polarity rendering via the VisualAnchor.
