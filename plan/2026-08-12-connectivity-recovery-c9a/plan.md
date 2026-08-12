---
status: completed
experience: none
---

# Surface current-document ERC diagnostics in the editor

## Goal

Expose derived ERC results in the existing Inspector without mixing them into
visual observations, and make a current-document result select its primary
object or endpoint.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target consumes the existing diagnostics envelope
and is intentionally limited to the active document. Cross-Cell navigation,
SPICE source navigation, filtering, and persistent diagnostic preferences stay
in later C9 targets.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-connectivity-recovery-c9a/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/derived` ERC engine, connectivity index, locator protocol
- existing visual/import diagnostics inspector sections

## Work

1. Derive ERC once from the revision-aware project index and pass only active
   document results to the Inspector.
2. Render a separate ERC count/list rather than changing visual diagnostic
   counts or labels.
3. Make terminal/port/instance/Net primary locators select or highlight their
   current-document target.
4. Add a browser regression for an unconnected component and diagnostic click.

## Validation

- `corepack pnpm typecheck`
- focused Playwright ERC inspector flow
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): surface current-document ERC diagnostics
```

## Outcome

The Properties shelf now shows a live, separate current-document ERC section
when electrical diagnostics exist. Each diagnostic locates its terminal, port,
instance, or Net primary target without changing visual/import diagnostic
counts. The existing hidden review-only diagnostics styling remains unchanged;
only the ERC section opts into visible editor presentation. Focused component
and browser tests plus workspace typecheck passed.
