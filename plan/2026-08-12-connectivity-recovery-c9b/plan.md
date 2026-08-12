---
status: completed
experience: none
---

# Surface and navigate project ERC diagnostics

## Goal

Turn the existing current-Cell ERC shelf into a project diagnostic workbench:
show every derived ERC diagnostic with its Cell identity and navigate through
the canonical locator when an off-Cell entry is selected.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging [ahead 1]
```

The unpushed commit is the immediately preceding, non-overlapping hierarchy
browser test. This target only owns the ERC presentation consumer and its
browser coverage. ERC policy, locator, and navigation contracts are read-only.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-connectivity-recovery-c9b/plan.md`
- `plan/log.md`

## Work

1. Feed the shelf the project ERC envelope rather than a current-Cell filter.
2. Mark and display each diagnostic's source Cell without weakening the
   existing severity/locator behavior.
3. Prove a child diagnostic opens its Cell and selects the endpoint.

## Validation

- selection inspector unit tests
- focused editor Playwright ERC navigation
- workspace typecheck, `git diff --check`, and status

## Commit Intent

```text
feat(editor): navigate project ERC diagnostics
```

## Outcome

The ERC shelf now lists the full project envelope, exposes the owning Cell for
each entry, and keeps the existing locator action. Browser coverage proves a
child-Cell ERC item opens its Cell and focuses the endpoint. Focused unit and
Playwright tests plus workspace typecheck passed.
