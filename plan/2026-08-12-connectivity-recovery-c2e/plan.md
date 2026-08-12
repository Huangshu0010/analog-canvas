---
status: completed
experience: none
---

# Feed editor flightlines from the connectivity index

## Goal

Make the editor's flightline count and overlay consume the active document's
`NetConnectivityRecord.flightlines` instead of independently deriving
flightlines, completing the main production consumer migration for the index.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target only changes the editor read consumer. Net
derivation and flightline rendering interaction remain read-only dependencies.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/app/App.test.tsx`
- `plan/2026-08-12-connectivity-recovery-c2e/plan.md`
- `plan/log.md`

## Work

1. Flatten active-document indexed net records in deterministic Net order.
2. Remove the editor's direct `deriveFlightlines` call.
3. Preserve focused manual/imported flightline behavior in tests.

## Validation

- focused App/flightline tests and selected Playwright flow
- workspace typecheck, `git diff --check`, and status

## Commit Intent

```text
refactor(editor): consume indexed flightlines
```

## Outcome

The editor now flattens the active document's indexed Net records in document
Net order for flightline count and overlay rendering. It no longer directly
calls `deriveFlightlines`; manual guidance, imported focus, and highlighted-Net
flows remained green.
