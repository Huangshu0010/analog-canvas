# Stable instance annotation translation

## Goal

Make a pure instance translation preserve the exact painted displacement and
relative distance of every attached Annotation, including labels whose visual
baseline position intentionally differs from their semantic transform offset.

## Dirty-State Note

Start state:

```text
## main...origin/main
```

The worktree is clean. The user explicitly requested this hotfix directly on
`main`, followed by commit and push.

## Owned Files

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing.test.ts`
- `packages/edit-engine/src/presentation.test.ts`
- `packages/edit-engine/src/authoring.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-10-stable-instance-annotation-translation/plan.md`
- `plan/log.md`

## Read-Only Files

- persisted Project/Document schema
- renderer and symbol geometry
- Agent API and edit union

## Shared Dependencies

- `move_instance` remains the single typed edit for human and Agent movement.
- Transform-aware label placement remains active for rotate/mirror operations.
- Pure translation must use the painted Annotation position as its source of
  truth; `offset` remains semantic transform state and must not be reinterpreted
  as a replacement visual position.

## Expected Work

1. Short-circuit attached-Annotation following when only position changes:
   apply the exact instance delta to `annotation.position`, preserving offset,
   alignment, rotation, and size.
2. Retain the existing transform-aware path for rotation and mirroring.
3. Add Edit Engine and browser regressions that move a transformed label more
   than once and assert a constant instance-to-label vector.
4. Audit other translation paths (ports, alignment, internal route labels) for
   the same semantic-offset misuse.

## Validation

- Focused Edit Engine Vitest.
- Focused editor Playwright regression.
- Editor/Edit Engine TypeScript and production builds.
- `git diff --check` and clean ownership review.

These checks cover the shared transaction contract and the actual GUI gesture
without expanding into unrelated symbol/render golden suites.

## Commit Intent

```text
fix(editor): preserve attached label distance on move
```

## Outcome

- `move_instance` now distinguishes pure translation from orientation changes.
  Translation applies the exact painted delta and preserves offset, alignment,
  rotation, and typography; rotate/mirror retain transform-aware edge and
  baseline placement.
- The shared translation helper also updates free/object anchor positions and
  is used by `move_port` and `align_instances`, closing the same stale-fallback
  failure in adjacent movement paths.
- Regression coverage includes deliberately divergent semantic/painted label
  coordinates, two consecutive instance moves, object-anchored markers, port
  movement, alignment, and a real rotated-component GUI drag.
- Validation passed: 60/60 Edit Engine and Agent service tests, three focused
  Playwright gestures, Edit Engine/editor TypeScript builds, and the editor
  production build. The only build notice is the existing large-chunk warning.
