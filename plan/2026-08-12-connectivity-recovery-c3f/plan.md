---
status: completed
experience: none
---

# Remove remaining editor direct route-polyline reads

## Goal

Finish the editor's resolved-geometry read migration by replacing the three
remaining direct `routePolyline()` calls used for Net focus and Net-label
placement with the indexed geometry/interaction record already used by canvas
rendering and hit testing.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging [ahead 1]
```

The unpushed preceding commit is the non-overlapping indexed-flightline
migration. This target owns only editor read consumers, not planner or derived
geometry implementation.

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-connectivity-recovery-c3f/plan.md`
- `plan/log.md`

## Work

1. Focus searched Nets through project indexed geometry.
2. Place Net-label editing through the shared interaction record.
3. Remove the editor's direct `routePolyline` import and preserve label flow.

## Validation

- focused App/route tests and Playwright Net-label/search flow
- workspace typecheck, `git diff --check`, and status

## Commit Intent

```text
refactor(editor): finish resolved route reads
```

## Outcome

Removed the editor's remaining direct `routePolyline` reads. Net-result focus
uses project geometry, while Net-label creation and inline placement use the
same interaction records as display and hit testing. Focused labels/search
browser flows and App/geometry tests passed.
