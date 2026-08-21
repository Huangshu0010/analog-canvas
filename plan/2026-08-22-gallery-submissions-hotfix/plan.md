---
status: completed
experience: none
---

# Hotfix: Publish Dialog Posts to the Real Submissions Endpoint

## Goal

The shipped publish dialog posted to `/api/gallery`, but the worker's
submissions endpoint is `/api/gallery/submissions`; the fallthrough 404
surfaced to the owner as "The gallery rejected the submission
(not-found)" on a correct form (user-reported in production). The
route-mocked e2e scenario mocked the same wrong URL, so it could not
catch the drift. Point the client at the documented endpoint and make the
mock match it exactly so any future path drift fails the test.

## State and Ownership

Branched from `origin/main` (post PR #154) as
`claude/gallery-submissions-path`; worktree clean apart from unrelated
untracked G2 work-in-progress (`worker/auth.ts`,
`plan/2026-08-22-gallery-auth-g2/`), excluded from this commit.

Owned paths:

- `apps/editor/src/features/editor-shell/gallery-publish.ts` (+ test)
- `apps/editor/e2e/gallery.spec.ts`
- `plan/2026-08-22-gallery-submissions-hotfix/plan.md`, `plan/log.md`

## Work

1. Client URL → `/api/gallery/submissions`.
2. Unit test asserts the exact URL; the e2e publish scenario mocks the
   submissions path specifically (list mock stays on `/api/gallery`).

## Validation

- `vitest`: gallery-publish client tests
- `playwright`: gallery spec publish scenario
- prettier, `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`
- post-deploy: a real publish against production succeeds

## Test Impact

- Decision: tests-updated
- Contracts: the editor publishes to the documented
  `/api/gallery/submissions` endpoint; the e2e mock is pinned to that
  exact path
- Primary checks:
  `apps/editor/src/features/editor-shell/gallery-publish.test.ts`,
  `apps/editor/e2e/gallery.spec.ts`

## Commit Intent

Committed on `claude/gallery-submissions-path` under the user's standing
commit-push-merge direction as:

```text
fix(editor): publish to the real gallery submissions endpoint
```

## Outcome

Delivered: the publish client posts to `/api/gallery/submissions`; the
unit test pins the URL and the e2e mock now matches the real path only.
Validation: client tests and the gallery publish scenario green locally;
production verification recorded in `plan/log.md` after deploy.
