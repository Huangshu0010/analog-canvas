---
status: completed
experience: none
---

# Extract Wire Editing Contract

## Goal

Move the wire endpoint source contract and deterministic edit construction out
of the React interaction reducer and `App.tsx`, so electrical merge/connect,
route persistence, free anchors, and route taps have one pure proposal layer.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/fix-ci-baseline
```

The worktree is clean. This target owns:

- `apps/editor/src/App.tsx` (wire proposal calls only)
- `apps/editor/src/interaction-state.ts` (WireSource import/re-export only)
- `apps/editor/src/route-interaction-geometry.ts` (type import only)
- `apps/editor/src/wire-editing.ts`
- `apps/editor/src/wire-editing.test.ts`
- `plan/2026-08-10-extract-wire-editing-contract/plan.md`
- `plan/log.md` (close-out entry only)

Read-only dependencies are `wire-path.ts`, the edit-engine/model contracts,
and existing wire/routing E2E specifications. Transaction execution, status
messages, counters, and interaction-state transitions remain in `App.tsx`.

## Work

1. Establish a UI-independent `WireSource` contract and retain a compatibility
   type re-export from the interaction-state module.
2. Extract pure builders for a complete wire transaction, free junction
   anchors, and snapped route-tap anchors.
3. Replace App's hand-built edits with proposal calls and add deterministic
   tests for new nets, net merges, prelude ordering, IDs, and grid snapping.

## Validation

- Focused Vitest for wire editing, wire paths, route interaction geometry,
  interaction state, and App rendering
- Focused Playwright wire creation, route tapping, junction, and net-merge
  scenarios
- `pnpm typecheck`
- `pnpm --filter @icm/editor build`
- Changed-file Prettier
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
refactor(editor): centralize wire editing contract
```

## Outcome

Established `wire-editing.ts` as the UI-independent owner of `WireSource` and
the pure edit builders for complete wires, free anchors, and route taps. The
interaction reducer now consumes and compatibility-re-exports that type rather
than defining an electrical transaction contract. `App.tsx` keeps suffix
allocation, transaction execution, messages, and state transitions, but no
longer hand-orders merge/connect/route edits.

Validation passed: 25 focused Vitest tests and six focused manual-editor
Playwright wire flows, followed by the full 423-test Vitest suite and all 59
Playwright flows; repository typecheck, editor production build, changed-file
Prettier, and `git diff --check` also passed. The existing large-chunk build
warning remains unchanged.
