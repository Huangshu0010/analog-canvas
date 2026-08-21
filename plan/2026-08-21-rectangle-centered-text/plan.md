---
status: completed
experience: none
---

# Centered Click-to-Edit Text Inside Drafting Rectangles

## Goal

Double-clicking the interior of a drafting rectangle creates (or reopens) a
rectangle label: one drafting text object anchored to that rectangle's center
with `alignment: "middle"`. Object-anchored drafting text renders its RichText
block vertically centered on the resolved anchor position, so the label stays
centered when the rectangle moves or resizes. This enables block-diagram
authoring (PFD / VCO / "Integrated Circuit" style boxes) without new persisted
schema: `VisualAnchor.kind === "object"` already exists; the editor simply
never produced it and the anchor resolver never looked up drafting objects.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/variable-resistor
 M apps/editor/src/features/editor-shell/shapes-panel.test.ts
 M apps/editor/src/features/editor-shell/shapes-panel.tsx
 M plan/2026-08-21-variable-resistor/plan.md
?? CLAUDE.md
```

The dirty paths belong to the still-active variable-resistor target being
finished by another session. They do not overlap this target's owned files and
are left untouched; this target proceeds beside them and stages only its own
files. `CLAUDE.md` is a separate user-requested documentation file, not part of
this target.

Owned paths:

- `packages/derived/src/anchor.ts` and `anchor.test.ts`
- `packages/derived/src/drafting-geometry.test.ts`
- `packages/render-svg/src/render.ts`, `rich-text.ts`, and their tests
- `apps/editor/src/features/drafting/rectangle-label.ts` (new) and test
- `apps/editor/src/features/text-editing/rich-text-editor.tsx`
- `apps/editor/src/app/App.tsx` (double-click integration only)
- `apps/editor/e2e/drafting.spec.ts`
- `plan/2026-08-21-rectangle-centered-text/plan.md`, `plan/log.md`

Shared dependencies: resolved drafting geometry contract (ADR 0010 single
resolver; the Snapshot geometry schema shape is unchanged), formal SVG output
consumed by both the editor canvas (`buildSvgScene`) and exporters, and the
editor-interaction double-click editing-intent rule. Read-only:
`docs/specs/editor-interaction.md`, `docs/specs/schematic-model.md`,
`apps/editor/src/canvas/canvas-hit-resolver.ts` (deliberately not extended —
interior detection is geometric, so pointer/marquee flows are untouched).

## Work

1. `@icm/derived` anchor resolution: `findObjectPlacement` also resolves a
   drafting rectangle target to its persisted center (other drafting kinds
   remain unresolved -> fallback + existing missing-target diagnostic).
2. `@icm/render-svg`: object-anchored drafting text paints its measured
   RichText block vertically centered on the resolved position; free and
   route-anchored text keep today's baseline behavior byte-for-byte.
3. New pure module `apps/editor/src/features/drafting/rectangle-label.ts`:
   top-most/smallest containing-rectangle lookup for a canvas point, existing
   label lookup (object-anchored text targeting the rectangle), and centered
   label proposal (empty content, `alignment: "middle"`, zero local offset,
   fallback at the rectangle center).
4. `App.tsx` pointer-tool double-click: after the existing annotation branch,
   resolve the click point against rectangle interiors; open the existing
   label's editing session or transact the proposed label and open it.
   Existing empty-commit semantics already delete an untouched empty label.
5. Inline editor nicety: mirror the session alignment onto the contentEditable
   `text-align` so centered labels edit as centered.
6. Focused tests at each layer plus one Playwright scenario (draw rectangle,
   double-click interior, type, commit, assert centered text in the SVG).

## Validation

- `pnpm test:local packages/derived/src/anchor.test.ts packages/derived/src/drafting-geometry.test.ts packages/render-svg/src apps/editor/src/features/drafting apps/editor/src/features/text-editing`
- `pnpm test:e2e:local apps/editor/e2e/drafting.spec.ts`
- `pnpm test:impact -- --base HEAD`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: object-anchor resolution now includes drafting rectangles;
  vertical centering of object-anchored drafting text in formal SVG; interior
  double-click creates/edits exactly one centered rectangle label; free-text
  rendering unchanged
- Primary checks: `packages/derived/src/anchor.test.ts`,
  `packages/render-svg/src/render.test.ts` (or the existing render test
  entry), `apps/editor/src/features/drafting/rectangle-label.test.ts`,
  `apps/editor/e2e/drafting.spec.ts`

## Commit Intent

Committed on `claude/block-diagram-authoring` at the user's direction as:

```text
feat(editor): centered click-to-edit rectangle labels
```

## Outcome

Delivered as designed with no persisted-schema change. `findObjectPlacement`
now resolves a drafting-rectangle anchor target to its center; render-svg
paints object-anchored drafting text vertically centered on the resolved
position (free/route text byte-identical, guarded by a regression test); a new
pure `rectangle-label` module owns interior lookup (smallest containing
rectangle, boundary inclusive, rotation aware), label lookup, and the centered
empty-label proposal (single line-break seed, deleted again by the existing
empty-commit rule). The canvas double-click opens or creates the label only on
empty interior space — electrical hits under the pointer keep their own
double-click meaning — and the inline editor mirrors the committed alignment.
Validation: 26 focused unit tests across derived/render-svg/editor plus the
full drafting Playwright suite (27 passed, including the new scenario covering
create, centering math, reuse, resize re-centering, and empty-commit cleanup);
repository typecheck; `test:impact --base HEAD`; `git diff --check` clean.
During the target the variable-resistor session merged as PR #138 and the
worktree moved to `main`. At the user's direction the change is committed on
`claude/block-diagram-authoring`; the local canonical gate cannot run here
(`pnpm` is not on this machine's PATH), so mainline delivery relies on the
remote required checks before merge.
