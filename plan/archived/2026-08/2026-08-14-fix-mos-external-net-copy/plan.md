---
status: completed
experience: none
---

# Preserve external MOS bulk connectivity during copy preview and paste

## Goal

Prevent copying an NMOS or PMOS whose implicit body connection belongs to a
shared external Net from invalidating the transient copy-preview document or
creating an invalid pasted circuit.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .codex-main-dev.stderr.log
?? .codex-main-dev.stdout.log
```

The two untracked development-server logs were created during this diagnosis
and will be removed. The tracked worktree is otherwise clean. This target owns:

- `apps/editor/src/features/clipboard/clipboard.ts`
- `apps/editor/src/features/clipboard/clipboard.test.ts`
- `apps/editor/e2e/component-insert.spec.ts` when a browser regression test is
  needed
- `plan/2026-08-14-fix-mos-external-net-copy/plan.md`
- `plan/log.md`

Read-only dependencies:

- `packages/model/src/schema.ts`: transient preview documents must satisfy its
  materialized MOS bulk-binding invariant.
- `packages/render-svg/src/render.ts`: validates the preview before rendering.
- `apps/editor/src/interaction/interaction-state.ts`: interaction ownership is
  not changed by this target.

## Work

1. Model clipboard membership so a selected instance may retain a connection
   to an external named/global Net without pretending that Net was internal.
2. Build a schema-valid preview for that selection and emit paste edits which
   explicitly join copied terminals to existing external Nets.
3. Add regression coverage for a MOS selected from a shared bulk Net, covering
   preview construction and commit behavior; add a browser check only if it
   directly protects the production crash path.

## Validation

- `pnpm test:local apps/editor/src/features/clipboard/clipboard.test.ts`
- Focused editor browser test for MOS insert/copy when added
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): preserve shared MOS bulk nets during copy
```

## Outcome

Clipboard selections now retain a projected boundary Net for every selected
terminal whose electrical Net also reaches outside the copied group. The
preview therefore remains schema-valid, and paste reconnects each new terminal
to its existing external Net. A missing boundary Net is reported as a normal
cancelled placement rather than producing invalid edits.

Validation passed: focused clipboard unit tests, the full component-insert
browser spec (including the shared-MOS regression), `pnpm typecheck`,
`pnpm format:check`, `pnpm install --frozen-lockfile`, and the full
`pnpm ci:check` (559 unit tests, 103 browser tests, builds, performance,
export/PWA goldens, production and release smoke), plus `git diff --check`.
