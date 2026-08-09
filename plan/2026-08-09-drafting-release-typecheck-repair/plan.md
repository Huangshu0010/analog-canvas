# Drafting release typecheck repair

## Goal

Repair only the TypeScript errors introduced by the completed, uncommitted
drafting interaction work, so release validation does not mistake Vite's
transpile-only build for a type-safe editor. This is an integration repair, not
new drafting behavior.

## Dirty-state decision

The user explicitly handed over the completed drafting work in the shared
worktree. It owns broad uncommitted changes to `App.tsx`, drafting tests,
model, edit-engine, derived, renderer, styles, and `plan/log.md`; this target
may edit only `App.tsx` at reported type-error sites and add no feature
behavior. The independent Razavi catalog fixture errors are pre-existing in
the combined worktree and remain out of scope.

## Ownership

Owned: `apps/editor/src/App.tsx`, this plan, and a factual log entry only if
the repair is independently committed.

Read-only: all drafting contract, renderer, schema, edit-engine, tests, and
Razavi files.

## Work

1. Restore discriminated-union narrowing before accessing arrow and
   construction-line fields.
2. Preserve free-anchor semantics while rotating geometry.
3. Make scale stepping retain each control's literal union.
4. Wrap command callbacks so React receives event handlers rather than command
   function parameters.
5. Fix the closure-based snap candidate narrowing without changing snap
   priority or distance.
6. Re-run editor typecheck. Do not repair Razavi fixture failures here.

## Validation

- `pnpm typecheck`, recording remaining errors by owner.
- Focused editor/drafting tests as appropriate.
- `pnpm --filter @icm/editor build`, `git diff --check`.

## Commit intent

Commit only after the supplied drafting target itself is ready to stage its
complete owned file set; otherwise leave this repair coupled to that target and
record no false standalone completion.
