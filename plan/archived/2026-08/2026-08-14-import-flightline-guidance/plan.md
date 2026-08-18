---
status: completed
experience: none
---

# Restore imported-net flightline guidance during placement

## Goal

Keep SPICE-imported, still-unrouted Nets visible as flightline guidance while
their initially unplaced symbols are being placed and wired. Preserve the
agreed dismissal behavior: a Net Label, Net highlight, or ordinary geometry
edit hides the guidance; routing one imported Net must not hide guidance for
the remaining imported Nets.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/import-flightline-guidance...origin/main
```

The dedicated worktree is clean. The parent worktree has unrelated recovery
work and is not touched.

- `packages/model/src/schema.ts`
- `packages/model/src/factories.ts`
- `packages/edit-engine/src/transaction.ts`
- `apps/editor/src/app/App.tsx`
- focused unit/browser tests and this plan/log entry

Read-only shared dependencies:

- `docs/specs/connectivity-and-routing.md`
- `packages/derived/src/connectivity.ts`
- SPICE importer source-binding contract

## Work

1. Add a small persisted per-Document imported-flightline guidance state so
   source provenance and routing-guidance visibility are not overloaded into
   `sourceStatus`.
2. Keep guidance active across `place_instance` and ordinary Wire commits,
   letting derived connected components remove only satisfied flightlines.
3. Dismiss guidance on Net Label authoring/removal and ordinary geometry edits;
   hide all guidance while a Net is highlighted.
4. Add focused contracts for the placement, routing, dismissal, and highlight
   paths.

## Validation

- focused model/edit-engine unit tests
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "flightline"`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): preserve imported flightline guidance during placement
```

## Outcome

Added a persisted imported-flightline guidance state. New SPICE imports start
active; placement and normal Wire commits retain guidance so derived topology
removes only satisfied flightlines. Net Label changes, route/instance geometry
edits, and visual route deletion dismiss it. Net highlight hides every
flightline only while the highlight is active.

Validation passed: focused edit-engine/SPICE tests (24 tests), isolated
flightline browser tests (3 tests), full workspace build, typecheck, Prettier,
and `git diff --check`.
