---
status: completed
experience: none
---

# Gallery Platform Phase G1: Public Feed Foundation

## Goal

First phase of the community-gallery platform direction
(`docs/roadmap/community-gallery-platform.md`): the site opens at `/` as a
full-screen Pinterest-style feed of published example circuits; `/editor`
is the ordinary editor and `/g/<id>` opens one entry in it. A third
SQLite Durable Object stores entries (canonical strict-schema Project text
plus a server-rendered preview SVG — no client markup is ever stored or
served); publishing is admin-token-gated until Phase G2 sign-in lands, so
anonymous upload is impossible from day one; the admin has a restorable
recycle bin, bin-only hard delete, and batch re-serialization that keeps
long-lived entries inside the rolling schema window. While the gallery is
empty, the feed shows the bundled Library examples as tiles so the landing
page is never blank. Entries already persist a nullable owner column so
Phase G3 ownership needs no migration.

## State and Ownership

Branched from `origin/main` as `claude/community-gallery`; worktree clean
at target start. Another session owns palette/VDD/recent-panel work in a
separate worktree per the user's direction — this target does not touch
those areas; `App.tsx`/e2e merge conflicts, if any, are resolved at
delivery.

Owned paths:

- `worker/gallery.ts` (new) and `worker/gallery.test.ts`
  (node:sqlite-backed storage fake), `worker/index.ts`, `wrangler.jsonc`
  (GALLERY binding, migration v3)
- `apps/editor/src/main.tsx` (route split), new
  `apps/editor/src/components/gallery-feed.tsx` (+ test),
  `apps/editor/src/app/App.tsx` (gallery-entry boot load, back-to-gallery
  chrome), `apps/editor/src/styles.css`
- `apps/editor/e2e/gallery.spec.ts` (new, route-mocked) and the mechanical
  `goto("/")` -> `goto("/editor")` sweep across existing specs
- `docs/specs/community-gallery.md` (new) and the specs README row;
  `docs/roadmap/community-gallery-platform.md` (new roadmap)
- `plan/2026-08-21-community-gallery/plan.md`, `plan/log.md`

Shared dependencies: project-protocol and render-svg consumed inside the
Worker (already in the deploy build closure), the Cloudflare deploy
workflow, the `/` landing contract for every existing Playwright spec
(deliberately moved to `/editor`), and the new `GALLERY_ADMIN_TOKEN`
secret (admin and publish routes answer 401 until it is set).

## Work

1. `GalleryDO` tables (`gallery_entries` with nullable `owner_user_id`,
   `gallery_submissions` day counters) and internal fetch protocol;
   `routeGalleryRequest` with public list/entry/preview, admin-gated
   publish (G1), recycle/restore/bin-delete/recycled-list, and
   `maintenance/reserialize`.
2. Route split in `main.tsx` (feed at `/`, editor at `/editor`, entry at
   `/g/<id>`, analytics untouched); full-screen feed component with
   column-masonry tiles, bundled-example fallback tiles, and a New
   Circuit entry point; App boot loads a gallery entry by id and links
   back to the gallery.
3. Contract spec + roadmap; Playwright: new gallery spec plus the landing
   sweep; worker suite on a real in-memory SQLite.

## Validation

- focused `vitest`: `worker/gallery.test.ts`, gallery feed component test
- `playwright`: new `gallery.spec.ts` plus full existing suites after the
  `/editor` sweep (drafting, manual-editor, component-insert, hierarchy)
- repository typecheck, prettier, markdown links
- `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: submissions are strict-schema-validated, canonically
  re-serialized, size- and rate-limited, admin-gated in G1, and published
  immediately; the public list exposes only `public` entries; previews are
  server-rendered and served as images; recycle is restorable and hard
  delete is bin-only; re-serialization upgrades entries inside the rolling
  window and reports failures without destroying records; `/` renders the
  feed with bundled fallback tiles, `/editor` keeps every existing editor
  behavior, `/g/<id>` opens a gallery entry
- Primary checks: `worker/gallery.test.ts`,
  `apps/editor/e2e/gallery.spec.ts`, existing Playwright suites at
  `/editor`

## Commit Intent

Committed on `claude/community-gallery` under the user's standing
commit-push-merge direction as:

```text
feat(gallery): public feed foundation (platform phase G1)
```

## Outcome

Phase G1 delivered. `GalleryDO` (third SQLite Durable Object, wrangler
migration v3) stores published entries as canonical strict-schema Project
text plus a server-rendered preview SVG with a nullable owner column ready
for G3; `routeGalleryRequest` serves the public list/entry/preview surface,
admin-gated publishing (401 for anyone without the bearer while G2 sign-in
is pending — anonymous upload impossible from day one), the restorable
recycle bin with bin-only hard delete, per-hashed-IP daily quotas, and
batch re-serialization that keeps entries inside the rolling schema window.
The site now lands on `/` as a full-screen masonry feed (tiles link to
`/g/<id>`, which the editor opens through the protocol boundary; bundled
Library examples render as starter tiles whenever the gallery is empty or
unreachable, so the landing page is never blank), `/editor` keeps the
entire existing editor (every Playwright spec moved its landing there), and
the brand mark links back to the gallery. Root workspace dependencies for
the Worker (`@icm/model`, `project-protocol`, `render-svg`, `symbols`) were
added with hand-maintained lockfile link entries (no local pnpm). The
normative contract is `docs/specs/community-gallery.md` and the phased
platform direction (G2 sign-in, G3 ownership, G4 feed experience) is
`docs/roadmap/community-gallery-platform.md`. Validation: worker suite on
real in-memory SQLite (8 contracts: publish/canonicalize/preview,
previous-schema upgrade, publish gate, field/origin/size rejection, rate
limiting, recycle lifecycle, re-serialization), feed component tests, the
new gallery Playwright spec (4 scenarios), the COMPLETE Playwright suite
(179 passed) on the new routing, repository typecheck, prettier, markdown
links, test-impact, and diff checks all green; feed and tile-to-editor
flow verified live. Deploy note: set the `GALLERY_ADMIN_TOKEN` secret to
enable publishing/administration.
