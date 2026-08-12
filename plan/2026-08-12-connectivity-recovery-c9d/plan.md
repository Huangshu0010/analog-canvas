---
status: completed
experience: none
---

# Surface navigable project visual diagnostics beside ERC

## Goal

Consume the existing unified diagnostic envelope in the editor: merge project
ERC results with every document's adapted visual diagnostics in one persistent
panel, with domain/severity filtering and canonical locator navigation.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. SPICE diagnostics remain in the import review because
their source spans have no stable schematic locator. Existing detailed Import
Review visual lists remain intact during this additive migration.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.test.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `docs/roadmap/connectivity-recovery-status.md`
- `plan/2026-08-12-connectivity-recovery-c9d/plan.md`
- `plan/log.md`

## Work

1. Derive project-scoped visual envelopes through the connectivity object index.
2. Merge visual and ERC diagnostics deterministically.
3. Add a persistent domain/severity-filtered panel, preserving Cell identity
   and canonical navigation for both domains.
4. Retain existing Import Review detail surfaces until SPICE receives a
   compatible locator adapter.

## Validation

- diagnostic and selection-inspector unit tests
- focused browser navigation/filter flow
- workspace typecheck, `git diff --check`, and status

## Commit Intent

```text
feat(editor): unify ERC and visual diagnostics
```

## Outcome

Project ERC and adapted visual diagnostics now share one persistent editor
workbench. Its domain and severity filters preserve the full result set while
canonical locators retain cross-Cell navigation. The superseded standalone ERC
section was removed; Import Review still owns SPICE diagnostics because source
spans have no schematic locator.

Validation passed: three focused diagnostic/selection Vitest files (20 tests),
three focused Playwright navigation/filter flows, workspace typecheck, targeted
Prettier, and `git diff --check`.
