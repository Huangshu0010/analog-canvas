---
status: completed
experience: none
---

# Stabilize Wire Sessions and Snap Resolution

## Goal

Eliminate intermittent manual-Wire failures by making Wire activation idempotent,
preventing a draft from silently using stale document references, excluding its
own source from endpoint snapping, and rejecting genuinely ambiguous coincident
targets instead of choosing one by incidental ordering.

## State and Ownership

Start state from `git status --short --branch` in the isolated worktree:

```text
## codex/wire-move-consistency
```

The original worktree contains unrelated, uncommitted authoring-input changes
that overlap this target. They are left untouched. This target runs from the
clean `origin/main` commit in `E:\interactive Circuit maker-wire-move-consistency`.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/interaction/interaction-state.ts`
- `apps/editor/src/interaction/interaction-state.test.ts`
- `apps/editor/src/snap/engine.ts`
- `apps/editor/src/snap/engine.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-13-wire-session-snap-consistency/plan.md`
- `plan/log.md`

Shared contracts:

- `packages/edit-engine/src/routing-planner.ts` defines persisted WireSource
  references and is read-only for this target.
- `docs/specs/connectivity-and-routing.md` and ADR 0014 define route ambiguity
  and geometry semantics and are read-only for this target.

## Work

1. Preserve an active Wire session when Wire is reactivated and attach the
   document revision at which its source was resolved.
2. Cancel the draft explicitly when a different transaction changes that
   revision, avoiding stale route-tap and endpoint references.
3. Exclude the active source from snap candidates and surface equal best
   coincident candidates as ambiguity instead of silently selecting by ID.
4. Add reducer, snap-engine, and editor regression coverage and document the
   accepted interaction behavior.

## Validation

- `corepack pnpm exec vitest run apps/editor/src/interaction/interaction-state.test.ts apps/editor/src/snap/engine.test.ts`
- Focused Playwright cases added to `apps/editor/e2e/manual-editor.spec.ts`
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): stabilize wire sessions and snap targets
```

## Outcome

Wire reactivation now preserves the active source and bends. Every source is
tagged with its resolving Document revision. The shared transaction boundary
synchronously cancels a draft after any other successful mutation, while Wire
commit validates the source revision and declares itself as the completing
transaction. Point snap excludes the source, returns all equal best coincident
targets, and rejects ambiguity instead of choosing by object ID. Focused unit,
typecheck, build, and browser regressions passed; the full gate's initial status
race was fixed and its four affected scenarios pass together.
