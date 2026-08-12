---
status: completed
experience: none
---

# Feed editor route display and hit targets from resolved geometry

## Goal

Make the editor's shared route-polyline records, which drive displayed hit
targets, drag gestures, route markers, and highlight overlays, adapt from the
active document's `ResolvedRouteGeometry` rather than independently invoking
`routePolyline` per route.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target changes the editor's read model only;
wire-commit, snap, transaction, and existing single-object helper calls remain
unchanged. The resolved geometry contract is a read-only dependency.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/app/App.test.tsx`
- `plan/2026-08-12-connectivity-recovery-c3e/plan.md`
- `plan/log.md`

## Work

1. Adapt the indexed route geometry into the existing interaction record shape.
2. Keep every display/hit/marker/highlight consumer on that one record list.
3. Protect route order and unresolved-route omission with a focused test.

## Validation

- focused App/route interaction tests and selected Playwright route flow
- workspace typecheck, `git diff --check`, and status

## Commit Intent

```text
refactor(editor): consume resolved route geometry for hits
```

## Outcome

The editor's route record list now adapts the active document's indexed
resolved geometry. SVG route hit paths, selection/drag/tap calculations,
route-marker attachment, annotation hit regions, and Net overlays all consume
that shared record list. Focused App/interaction tests and route Playwright
flows passed.
