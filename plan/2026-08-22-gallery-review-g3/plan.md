---
status: completed
experience: none
---

# Gallery Phase G3: Review Queue with Submission Quality Gates

## Goal

Open publishing to ordinary signed-in users behind two mechanisms the
owner specified: deterministic quality gates (no ERC errors; no floating
endpoints — every visible pin is wired, in a named net, or explicitly
NoConnect; no empty submissions) and a review queue (gated submissions
enter `pending`, invisible publicly, until the super-admin or an
appointed moderator approves them or rejects them with an optional
reason the submitter sees). Admin/moderator submissions keep publishing
directly. Gates run twice from one shared evaluator: authoritatively in
the worker (API cannot bypass) and live in the publish dialog (problems
listed before submitting).

## State and Ownership

Branched from `origin/main` (post PR #162) as `claude/gallery-review-g3`.

Owned paths:

- `packages/derived/src/submission-gates.ts` (+ test) and the package
  index export
- `worker/gallery.ts` (+ test): pending/rejected statuses, owner stamp,
  gate enforcement, review/mine routes, moderator-aware preview access
- `worker/auth.ts` (+ test): `users.role` column, appoint-moderator
  route, role in the session payload
- `apps/editor/src/features/editor-shell/gallery-publish.ts(.test.ts)`
  and `publish-gallery-dialog.tsx(.test.tsx)`: pending/gate outcomes,
  pre-submit gate list, submit-for-review variant
- `apps/editor/src/components/review-queue.tsx`,
  `my-submissions.tsx` (+ tests), `gallery-feed.tsx` (links),
  `account.tsx` (role field)
- `apps/editor/src/main.tsx` (`/review`, `/mine` routes),
  `apps/editor/src/app/App.tsx` (gate report + session plumbing),
  `styles.css`, `apps/editor/e2e/gallery.spec.ts`
- `docs/specs/community-gallery.md`, `docs/roadmap/…`, plan files

Shared dependencies: the ERC engine and connectivity index in
`@icm/derived` (consumed, not modified); the existing submissions
contract (extended: 201 gains `status`, 422 `quality-gate` added).

## Design

- `evaluateSubmissionGates(project, resolver)` → `{ok, failures[]}` with
  codes `erc-errors` (any `severity: "error"` ERC diagnostic),
  `floating-endpoints` (`ERC_UNCONNECTED_PIN`, `ERC_BULK_UNRESOLVED`,
  and `ERC_FLOATING_GATE` except when its single-member net carries a
  name — the "named port" escape), and `empty-project` (fewer than 2
  instances AND fewer than 3 drafting objects with at least one text —
  pure block diagrams stay submittable). Failures carry counts and up to
  5 example labels.
- Worker submission flow: anonymous → 401 (unchanged); bearer or
  admin/moderator session → gates skipped, `public` (unchanged
  behavior); ordinary session → gates (422 `{error:"quality-gate",
failures}`) → stored `pending` with `owner_user_id`. 201 returns
  `{id, status}`.
- Gallery schema (guarded ALTERs): `reject_reason`, `reviewed_at`,
  `reviewed_by`. Statuses: `public | pending | rejected | recycled`.
- Review routes (admin or moderator session; bearer also accepted):
  `GET /api/gallery/review` (pending, oldest first),
  `POST /api/gallery/<id>/approve`, `POST /api/gallery/<id>/reject`
  (optional reason ≤300). `GET /api/gallery/mine` (session) lists the
  caller's entries with status and reason. Preview route serves
  non-public entries only to reviewers or the owner.
- Auth: `users.role` (`user`/`moderator`, guarded ALTER), role included
  in the session user, `POST /api/auth/users/role` (admin session) sets
  the role for every account with a given email.
- Editor: dialog gains a gate panel (blocking for ordinary users,
  informational otherwise) and "Submit for review" copy; `/review` page
  (queue cards with preview, approve, reject-with-reason, and an
  admin-only appoint-moderator form); `/mine` page (status chips +
  rejection reason); feed header links per session.
- Deferred to a follow-up (recorded in the roadmap): owner editing and
  withdrawal of published entries re-entering review.

## Validation

- `vitest`: submission-gates, worker gallery review flow (pending
  invisibility, approve/reject + reason, gate 422, admin bypass,
  ownership), auth role tests, editor client/dialog/component tests
- `playwright`: gallery spec — ordinary-user dialog shows blocking gate
  failures; admin review page approves a mocked pending entry
- repository typecheck, prettier,
  `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: gates run identically client- and server-side and only for
  ordinary users; pending entries are invisible on every public surface;
  approve/reject transitions with the stored reason surface to the
  owner; moderators gain exactly review authority
- Primary checks: `packages/derived/src/submission-gates.test.ts`,
  `worker/gallery.test.ts`, `apps/editor/e2e/gallery.spec.ts`

## Commit Intent

Committed on `claude/gallery-review-g3` under the user's standing
commit-push-merge direction as:

```text
feat(worker): gallery review queue with submission quality gates
```

## Outcome

Delivered. `evaluateSubmissionGates` (@icm/derived) encodes the owner's
policy — zero ERC errors; zero floating endpoints with the wire/named-
net/NoConnect escapes; no near-empty projects (block diagrams pass) —
and runs identically in the worker (422 with structured failures) and
live in the publish dialog (blocking list for ordinary users,
informational for admin/moderator/bearer). Ordinary signed-in
submissions enter `pending` (invisible on every public surface,
preview/detail readable only by reviewers and the owner) until approved
to `public` or rejected with an optional stored reason; deciding twice
answers 409. Moderators are appointed in-app by email (`users.role` +
`POST /api/auth/users/role`), hold exactly review authority, and the
`/review` page (queue cards, approve/reject with reason, admin-only
appointment form) plus `/mine` (status chips, rejection reason) surface
the flow; the feed account menu links both. The root workspace gained
`@icm/derived` so the worker can import the evaluator. Spec and roadmap
updated; owner editing/withdrawal recorded as the phase's follow-up.

Validation: submission-gates 5, worker suites 47 (review walk-through,
reason surfacing, gate 422 with bearer/admin bypass, moderator
appointment), editor unit sweep 31 (editor-shell + components), full
unit run 460 green, gallery Playwright 10/10 (new: local blocking gates
on an empty project; review-queue approve), repository typecheck,
prettier, test-impact, diff checks.
