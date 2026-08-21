---
status: active
experience: none
---

# Gallery Phase G2: Accounts and Sign-In (Dark-Shipped)

## Goal

Implement the complete G2 account layer from
`docs/roadmap/community-gallery-platform.md` so every provider lights up
the moment its secret exists, with no further code change: an `AuthDO`
(users, sessions) behind `/api/auth/*` offering GitHub OAuth, Google
OAuth, and email magic-link sign-in (HttpOnly session cookie, only token
hashes stored); display-name rename; super-admin derived from
`ADMIN_EMAILS`; sign-in/account UI on the gallery feed; and the publish
dialog accepting an admin session in place of the pasted passphrase.
Providers without secrets stay invisible (dark ship).

## State and Ownership

Branched from `origin/main` (post PR #154) as `claude/gallery-auth-g2`;
worktree clean.

Owned paths:

- `worker/auth.ts` (new: AuthDO + `/api/auth/*` routing) and
  `worker/auth.test.ts`
- `worker/index.ts` (dispatch + Env), `worker/gallery.ts`
  (admin-session acceptance) and `worker/gallery.test.ts`
- `wrangler.jsonc` (AUTH binding, migration v4)
- `.github/workflows/cloudflare.yml` (secret sync loop)
- `apps/editor/src/components/account.tsx` (+ test) — session client and
  feed account UI
- `apps/editor/src/components/gallery-feed.tsx` (header account area)
- `apps/editor/src/features/editor-shell/gallery-publish.ts(.test.ts)`
  and `publish-gallery-dialog.tsx(.test.tsx)` (admin-session publish)
- `apps/editor/src/styles.css`, `apps/editor/e2e/gallery.spec.ts`
- `docs/specs/community-gallery.md`,
  `docs/roadmap/community-gallery-platform.md`
- `plan/2026-08-22-gallery-auth-g2/plan.md`, `plan/log.md`

Shared dependencies: the gallery submissions contract (extended, not
broken: the bearer keeps working); provider HTTP contracts (GitHub,
Google, Resend) reached through an injectable fetch seam.

## Design

- `AuthDO` (fourth SQLite DO, singleton `auth`): `users(id, provider,
  provider_id UNIQUE(provider, provider_id), email, display_name,
  created_at)`, `sessions(token_hash, user_id, expires_at)`,
  `login_tokens(token_hash, email, expires_at)`, `login_rates(day,
  email_hash, count)`. Raw session tokens live only in the cookie; the DB
  stores SHA-256 hashes. Sessions last 30 days; magic links 15 minutes,
  single-use, 5/day per email.
- Public routes (worker forwards `/api/auth/*` to the DO verbatim):
  `GET providers` (which providers are lit), `GET me`, `GET
  github/start|callback`, `GET google/start|callback`, `POST email/start`,
  `GET email/callback`, `POST logout`, `POST profile` (rename, 1–40
  chars). OAuth `state` is double-submit: random value in a short-lived
  HttpOnly cookie compared on callback. GitHub uses only the verified
  primary email; Google requires `email_verified`. POSTs are same-origin
  gated like gallery submissions.
- Admin is computed per request: a session whose email is listed in
  `ADMIN_EMAILS` (comma-separated) is super-admin; rotation needs no
  re-login. Gallery submission and admin endpoints accept EITHER the
  legacy bearer OR an admin session (internal `session-user` op on
  AuthDO). Ordinary sessions still cannot publish — that is G3's review
  queue.
- Secrets (dark-ship per provider): `GH_OAUTH_CLIENT_ID`/`_SECRET`
  (GitHub Actions forbids the `GITHUB_` prefix, so the roadmap names
  change), `GOOGLE_CLIENT_ID`/`_SECRET`, `RESEND_API_KEY` (+ optional
  `AUTH_EMAIL_FROM`), `ADMIN_EMAILS`; each synced to the worker by the
  deploy workflow when present.
- Feed UI: account area in the feed header — signed-out shows the enabled
  providers (GitHub/Google links, email form); nothing renders while no
  provider is lit; signed-in shows the display name (click to rename),
  an Owner badge for admins, and Sign out.

## Validation

- `vitest`: `worker/auth.test.ts` (magic-link end-to-end, OAuth callback
  with mocked provider fetch, dark providers, state mismatch, rename,
  logout, admin flag), `worker/gallery.test.ts` (admin-session
  submission), editor account + publish-dialog unit tests
- `playwright`: `apps/editor/e2e/gallery.spec.ts` (feed sign-in states,
  admin-session publish without passphrase)
- repository typecheck, prettier,
  `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: providers ship dark until their secrets exist; sign-in
  round-trips set only hashed HttpOnly sessions; rename sticks within
  1–40 chars; `ADMIN_EMAILS` grants per-request super-admin; gallery
  publishing accepts bearer or admin session and nothing else
- Primary checks: `worker/auth.test.ts`, `worker/gallery.test.ts`,
  `apps/editor/e2e/gallery.spec.ts`

## Commit Intent

Committed on `claude/gallery-auth-g2` under the user's standing
commit-push-merge direction as:

```text
feat(worker): gallery accounts and sign-in (phase G2, dark-shipped)
```

## Outcome

Pending.
