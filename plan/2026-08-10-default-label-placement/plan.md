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

## Validation

- focused placement unit test for no-rotation, rotation, and mirror cases
- focused App test or TypeScript build
- `git diff --check` and staged-diff review

## Commit Intent

`fix(editor): place default labels by symbol semantics`
