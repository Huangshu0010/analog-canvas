---
status: completed
experience: none
---

# Consume resolved routing geometry in route anchors and drafting

## Goal

Remove the remaining route-anchor/drafting direct polyline read by supplying
resolved document geometry to visual-anchor resolution, while retaining the
existing anchor placement contract and fallback diagnostics.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns derived anchor/drafting read paths.
`routes.ts` attachment-placement math is a read-only compatibility primitive;
Edit Engine mutation remains outside the target.

- `packages/derived/src/anchor.ts`
- `packages/derived/src/anchor.test.ts`
- `packages/derived/src/drafting-geometry.ts`
- `packages/derived/src/drafting-geometry.test.ts`
- `docs/roadmap/connectivity-recovery-status.md`
- `plan/2026-08-12-connectivity-recovery-c3j/plan.md`
- `plan/log.md`

## Work

1. Resolve route anchors from `ResolvedDocumentRoutingGeometry` instead of
   direct `routePolyline()` calls.
2. Resolve one geometry result per drafting object and pass it through all
   nested anchor calculations.
3. Preserve anchor positions, rotations and invalid-target diagnostics.
4. Record the narrowed compatibility boundary after the static consumer audit.

## Validation

- focused anchor/drafting/geometry tests
- workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
refactor(derived): consume resolved geometry in drafting anchors
```

## Outcome

Route anchors accept shared resolved document geometry and drafting resolves it
once per object before passing it through nested anchors. The remaining direct
polyline calls are now limited to geometry derivation and Edit Engine mutation
or validation; static audit confirms no production read consumer remains.

Validation passed: 29 focused anchor/drafting/geometry tests, workspace
typecheck, targeted Prettier, static consumer audit, and `git diff --check`.
