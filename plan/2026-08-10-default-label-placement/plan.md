# Semantic default instance-label placement

## Goal

Place newly authored component labels away from terminal escape lanes using
symbol-class semantics: passive/source side labels, Port reverse-endpoint
labels, and MOS labels on the gate-opposite lower body side.

## Dirty-State Decision

The branch `codex/modernize-editor-chrome` has concurrent canvas-drag,
selection, route/stretch, and editor-interaction edits. `App.tsx` is shared,
but the existing `defaultInstanceLabel` function is a distinct local hunk.
This target will introduce an isolated placement module and stage only that
call-site hunk; all concurrent files and unrelated App hunks remain unstaged.

## Owned Files

- `apps/editor/src/default-instance-label-placement.ts`
- focused unit test for the placement module
- default-label call-site hunk in `apps/editor/src/App.tsx`
- this plan and a factual `plan/log.md` entry

## Read-Only Dependencies

- symbol catalog geometry and schema
- all current editor drag/selection work, netlists, and `lib/circuit.vss`

## Design

Resolve a local label anchor then transform it with the instance placement:

- resistor, capacitor, inductor, and independent sources: local right side;
- `port`: local left of the visible Port dot/lead, i.e. reverse terminal side;
- NMOS/PMOS variants: gate-opposite local right side, modestly below center;
- all other symbols: existing bottom-center fallback.

Text remains screen-upright. Alignment is chosen from the transformed anchor
direction so a mirrored or rotated instance still places the text outward.
Persisted label annotations and manually moved/locked labels remain unchanged.

## Result

- Implemented the shared resolver in `@icm/render-svg` and use it for both
  renderer fallback labels and editor-authored editable labels.
- Side label anchors use an outward alignment after rotation/mirroring; MOS
  ignores its optional bulk pin when choosing the gate-opposite label side.
- Existing annotations retain their stored position, offset, alignment, and
  lock state because the resolver runs only when no explicit instance label
  exists.

## Spacing Follow-up

Human review accepts the MOS offset but finds passive/source/Port side labels
too distant. Keep the MOS gap unchanged and reduce only the non-MOS side gap
to 50% of its measured visual-boundary distance. The concurrent worktree
changes remain unrelated and unstaged.

## Compact Spacing Follow-up

Human review requests one further 50% reduction. Non-MOS side labels therefore
use 25% of the original side gap; MOS remains unchanged.

## Fixed-Gap Follow-up

Human review of the live editor requests an explicit 1.5-unit clearance rather
than a proportional gap. This follow-up owns only
`packages/render-svg/src/default-instance-label-placement.ts` and its focused
test, plus this plan and the factual log. The concurrent dirty editor and
dragging files remain unrelated and unstaged. The renderer and editor both
consume this shared resolver, so a focused resolver test plus both package
builds verify the registration path.

## Fixed-Gap Result

`compactSideGap` is now exactly `1.5` canvas units. The focused resolver test
locks the corresponding passive/source/Port anchors. Browser verification on
the active Vite editor at `127.0.0.1:4173` placed a new resistor and confirmed
the authored `instance-label` anchor from the shared resolver. Its apparent
ink-to-glyph gap remains larger than 1.5 pixels only because the symbol viewBox
has intentional interior whitespace; the authored offset itself is 1.5 units.

## Validation

- focused placement unit test for no-rotation, rotation, and mirror cases
- focused App test or TypeScript build
- `git diff --check` and staged-diff review

## Commit Intent

`fix(editor): place default labels by symbol semantics`
