---
status: completed
experience: none
---

# Make empty-canvas Port placement complete

## Goal

Make the `P` shortcut and normal Free Net Port placement complete on an empty
canvas. An explicitly supplied Port name or a named contact remains
authoritative; otherwise placement allocates a deterministic, unused local Net
name instead of rejecting the click after the preview has started.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-unification...origin/codex/insert-unification
```

The isolated worktree is clean. Owned paths:

- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- this plan and `plan/log.md`

Read-only: the model Net contract, Edit Engine transaction semantics, and the
Port dialog continue to accept explicit names and are not changed.

## Work

1. Allocate the first unused `NET<n>` name only when a Free Net Port has no
   supplied name and its placement contact has no name.
2. Keep named-contact inheritance and explicit user override behavior intact.
3. Change the `P` browser regression to place an empty-canvas Port without
   entering a name, and assert the generated name and completed placement.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep="Port shortcut starts ordinary component placement"`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: Port placement always creates a named Net; explicit names and
  named contacts take precedence over the deterministic fallback.
- Primary checks: the focused browser shortcut workflow exercises the actual
  picker, transient placement, transaction, net label, and status path.

## Commit Intent

```text
fix(editor): complete unnamed port placement
```

## Outcome

Completed the late-failure repair: an isolated Free Net Port now allocates the
first unused `NET<n>` name. Explicit text and a named placement contact still
take precedence. The focused browser regression uses `P`, leaves the name
blank, and confirms that the transaction creates `NET1` and the Port instance.

Validation passed: focused browser regression, workspace typecheck, Prettier,
test-impact, and diff checks. A separate observation remains out of scope:
the Port success status says "click to place another" although the current
interaction exits after the first Port commit.

Commit: `fix(editor): complete unnamed port placement` on the current branch
HEAD.
