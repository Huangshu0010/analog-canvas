---
status: completed
experience: none
---

# Hotfix: OAuth Callback "Illegal invocation" in the Workers Runtime

## Goal

First real GitHub sign-in on the deployed site failed with the generic
"Sign-in failed — try again" while `/api/auth/providers` and `/api/auth/me`
worked. Cause: `AuthDO.fetchLike` was initialized with the raw global
`fetch`, so `this.fetchLike(...)` invoked it with the DO instance as
`this` — the Workers runtime throws "Illegal invocation" for a rebound
native fetch, the callback's try/catch swallowed it, and every provider
exchange failed. Node's fetch ignores the receiver, which is why all unit
tests passed. Wrap the seam in an arrow function, and switch the GitHub
token exchange to the form-encoded format GitHub's documentation
guarantees (removing a second latent risk in the same path).

## State and Ownership

Branched from `origin/main` (post PR #158) as `claude/auth-fetch-binding`.

Owned paths: `worker/auth.ts`, `worker/auth.test.ts`,
`plan/2026-08-22-auth-fetch-binding/plan.md`, `plan/log.md`.

## Work

1. `fetchLike: typeof fetch = (input, init) => fetch(input, init)` with a
   comment marking the wrapper as load-bearing.
2. GitHub token exchange posts `application/x-www-form-urlencoded`.
3. Regression test: the default seam is never identical to the global
   `fetch` (the only shape of this bug Node can detect).

## Validation

- `vitest`: `worker/auth.test.ts`, `worker/gallery.test.ts`
- repository typecheck, prettier,
  `node scripts/check-test-impact.mjs --base origin/main`
- post-deploy: a real GitHub sign-in on the production site succeeds

## Test Impact

- Decision: tests-updated
- Contracts: the provider fetch seam is never the rebindable raw global
- Primary checks: `worker/auth.test.ts`

## Commit Intent

Committed on `claude/auth-fetch-binding` under the user's standing
commit-push-merge direction as:

```text
fix(worker): wrap the auth fetch seam for the Workers runtime
```

## Outcome

Delivered: the seam is arrow-wrapped (with the load-bearing comment), the
GitHub exchange is form-encoded, and the identity regression test pins
the wrapper. Worker suites green; production sign-in verified after
deploy (recorded in `plan/log.md`).
