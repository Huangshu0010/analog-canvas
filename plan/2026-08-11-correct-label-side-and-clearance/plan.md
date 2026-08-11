---
status: completed
experience: none
---

# Correct instance-label side inference and clearance

## Goal

Keep instance-name annotations on their intended exterior side through all
rotations and set default labels to a uniform 1.5-unit glyph-edge clearance
from the visible symbol geometry.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns the derived label-side/default-placement
logic, its focused tests, and plan/log entries.

- `packages/derived/src/instance-label-placement.ts`
- `packages/derived/src/instance-label-placement.test.ts`
- `apps/editor/src/features/wiring/route-interaction-geometry.test.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `plan/2026-08-11-correct-label-side-and-clearance/plan.md`
- `plan/log.md`

Read-only: annotation persistence/schema, edit transactions, symbols, and
text rendering. This target changes no annotation protocol.

## Work

1. Infer label side from the exterior visible-boundary escape before using
   centre displacement, so a side label with a vertical baseline offset does
   not change side after rotation.
2. Build all default anchors from visible geometry and 1.5-unit clearance,
   including MOS/BJT labels, rather than view-box padding or typography gaps.
3. Add rotation and clearance regression coverage.

## Validation

- focused derived and edit-engine label tests
- affected TypeScript and editor builds
- `git diff --check` and `git status --short --branch`

## Commit Intent

```text
fix(labels): correct rotated text side and clearance
```

## Outcome

- Corrected side inference to prioritize the unique exterior visible-boundary
  escape. The baseline offset of a right-side MOS/BJT label can therefore no
  longer make it behave as a bottom label when the instance rotates.
- Moved all renderer-owned default anchors (ports, passive/source side labels,
  MOS/BJT names, and bottom labels) to visible geometry plus a uniform
  1.5-unit clearance. The upright helper still accounts for glyph baseline on
  top/bottom labels.
- Preserved annotation persistence, attachments, locks, text formatting, and
  edit behaviour; no annotation protocol/schema changed.
- Focused label tests and derived/edit-engine/editor builds pass.
