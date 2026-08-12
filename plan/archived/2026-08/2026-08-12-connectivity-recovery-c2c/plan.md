---
status: completed
experience: none
---

# Render explicit No Connect markers

## Goal

Make persisted No Connect declarations visible in the formal SVG scene so the
editor canvas and every formal SVG export communicate the same electrical
intent.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns the formal rendering behaviour and its
focused tests; it deliberately does not add No Connect editing gestures or
selection semantics.

- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `plan/2026-08-12-connectivity-recovery-c2c/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/model` NoConnect schema
- `packages/derived` endpoint resolution
- `apps/editor` consumes the formal SVG scene but is not edited by this target

## Work

1. Resolve terminal and port No Connect endpoints to their formal positions.
2. Render a deterministic, explicit cross marker in its own formal scene
   layer, above symbols and ports.
3. Add a renderer regression proving terminal and port declarations render.

## Validation

- `corepack pnpm --filter @icm/render-svg test`
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(render): render explicit NoConnect markers
```

## Outcome

Added a deterministic formal-scene No Connect cross for both terminal and port
declarations. The layer is omitted when empty, preserving existing SVG golden
output. Focused renderer tests and workspace typecheck passed.
