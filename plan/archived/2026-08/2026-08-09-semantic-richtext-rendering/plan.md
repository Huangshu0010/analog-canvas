# Preserve semantic RichText formatting

## Goal

Make saved RichText content authoritative for a manually edited semantic
annotation, so multi-character subscripts and other explicit formatting render
identically after the floating editor commits.

## Dirty-State Note

The tracked worktree is clean. Existing untracked circuit exports, archived
plans, and a local probe are unrelated and remain untouched.

## Owned Files

- `apps/editor/src/App.tsx`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `packages/model/src/schema.ts`
- `plan/2026-08-09-semantic-richtext-rendering/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/render-svg/src/rich-text.ts`
- `packages/render-svg/src/schematic-text.ts`

## Shared Dependencies

- `Annotation.text` remains the semantic plain-text/electrical identity.
- Optional `Annotation.content` is the persisted explicit RichText formatting
  created by the canvas editor.
- An annotation with no `content` still receives canonical Razavi text
  composition from its semantic string.

## Expected Work

1. Render and reopen saved `annotation.content` when present.
2. Use the same AST for editor hit geometry.
3. Replace the stale-content normalization regression with a multi-character
   subscript round-trip regression.
4. Correct the shared `Annotation.content` contract comment so it describes
   the fallback-versus-explicit rendering rule.

## Validation

- Focused Render-SVG and editor tests.
- `pnpm typecheck`
- Render-SVG and editor builds.
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
fix(text): preserve explicit semantic rich text formatting
```

## Outcome

- Saved annotation RichText is now the visual source of truth while `text`
  remains the electrical/plain-text identity.
- New annotations without `content` continue to receive the active Razavi
  canonical composition, including its typography and subscript metrics.
- The renderer regression exercises an explicit `out` subscript, preventing a
  return to the `flatten -> reparse` loss path.
- Focused regression, workspace typecheck, and both production builds passed.
  The unfiltered Render-SVG test file retains four pre-existing golden failures:
  its expectations reference the older monochrome/geometry assets while the
  checked-in runtime resolves the newer Razavi assets.
