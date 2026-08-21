# Community Gallery Platform

Status: `active`

Owner direction (2026-08-21): the site opens as a full-screen gallery feed
(Pinterest-style tiles of example circuits); every circuit is openable and
editable; ordinary users may modify only their own published entries while
the site owner is super-admin over all content; publishing requires signing
in with Google or email, while anonymous visitors can browse and use
everything read-only.

This roadmap frames the cross-module outcome; each phase lands as its own
bounded target under `plan/` with the normal delivery gate. The normative
server contract lives in
[`../specs/community-gallery.md`](../specs/community-gallery.md).

## Phase G1 — Public feed foundation (this phase)

- `GalleryDO` (SQLite, third Durable Object) stores published entries:
  canonical strict-schema Project text plus a server-rendered preview SVG;
  nothing client-authored is ever stored or served as markup.
- Public read API: list, entry, preview image. Publishing exists but is
  admin-token-gated until real sign-in lands (anonymous upload stays
  impossible from day one, which is the end-state rule anyway).
- Admin API (bearer `GALLERY_ADMIN_TOKEN`): recycle (soft, restorable),
  restore, hard-delete from the bin only, recycled list, and batch
  re-serialization that keeps long-lived entries inside the rolling schema
  window (previews stored independently so browsing survives an expired
  entry).
- The site opens at `/` as the full-screen feed; `/editor` is the editor;
  `/g/<id>` opens one gallery entry in the editor. While the gallery is
  empty the feed shows the bundled Library examples as tiles so the landing
  page is never blank.
- Entries already carry a nullable owner column so G3 needs no migration.

Acceptance: feed loads from the deployed worker; a seeded entry renders as
a tile, opens in the editor, and survives recycle/restore; all existing
editor behavior reachable at `/editor` unchanged.

## Phase G2 — Accounts and sign-in

- `AuthDO` (users, sessions): Google OAuth code flow on the worker plus
  email magic-link sign-in behind a mail-provider credential; HttpOnly
  session cookie; sign-in UI on the feed and in the editor chrome.
- Super-admin role assigned automatically to the owner's sign-in identity
  (`ADMIN_EMAILS` secret), replacing bearer-token administration in the UI.
- External prerequisites the owner must provision (Claude cannot create
  accounts or handle credentials): a Google OAuth client
  (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` secrets), `ADMIN_EMAILS`, and
  — for email sign-in — a transactional mail provider key; email sign-in
  ships dark until its secret exists.

Acceptance: sign in/out round-trips on the deployed site; the owner's
account sees admin affordances; no credential material ever transits or is
stored beyond the provider contract.

## Phase G3 — Ownership and editing

- Publishing requires a session; entries record their owner; owners can
  update or recycle their own entries ("modify my content"), the
  super-admin can do so for any entry.
- Editor gains "publish to gallery / update my tile" against the signed-in
  identity; anonymous visitors keep full read-and-local-edit freedom
  without any way to write back.

Acceptance: two ordinary accounts cannot touch each other's tiles; the
admin can; anonymous writes are impossible at the API, not just the UI.

## Phase G4 — Feed experience

- Masonry/infinite scroll, per-author filtering, in-feed admin recycle-bin
  view, and seeded starter content curation.

Each phase closes by updating this file's status line for that phase.
