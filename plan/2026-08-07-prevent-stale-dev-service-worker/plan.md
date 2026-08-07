# Prevent Stale Development Service Worker

## Goal

Ensure a fresh local Vite development session cannot remain controlled by a
previously installed production PWA service worker on the same loopback origin.

## Dirty-State Decision

The worktree began clean on `main...origin/main` at commit `f72e284`.

## Owned Files

- `apps/editor/src/main.tsx`
- `plan/2026-08-07-prevent-stale-dev-service-worker/plan.md`
- `plan/log.md`

## Expected Work

Keep production registration unchanged. In development only, unregister any
existing registrations and reload once when the current page was controlled so
the next navigation comes from Vite.

## Validation

- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e`
- `git diff --check`

## Outcome

Production continues to register `/sw.js`. Development unregisters stale
registrations and reloads once only when the current page was controlled.
TypeScript, the workspace build, and all 10 Playwright flows passed.

## Commit Intent

Commit as `Prevent stale PWA cache in development`.
