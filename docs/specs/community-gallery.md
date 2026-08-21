# Community Gallery

Status: `accepted` (Phase G1 surface)

Primary owners: `worker/gallery.ts`, `apps/editor` landing feed

Roadmap: [community gallery platform](../roadmap/community-gallery-platform.md)
(G1 public feed foundation → G2 sign-in → G3 ownership → G4 feed
experience). This specification describes the currently shipped surface and
names the clauses later phases replace.

## Trust boundary

The only accepted input is Project JSON that passes the strict protocol
boundary (`parseProject`; the rolling previous-version upgrade applies).
Everything stored and served — canonical Project text and the preview SVG —
is derived server-side from that validated model. Client-supplied markup is
never stored, echoed, or served. Previews are rendered by `@icm/render-svg`
from the entry's top document and served as `image/svg+xml` with a
restrictive content-security-policy.

## Public surface

- `GET /api/gallery` — newest-first `public` entries
  (`{entries, nextCursor}`; keyset cursor; limit clamps at 60). Recycled
  entries never appear.
- `GET /api/gallery/<id>` — one public entry with its canonical
  `projectText`.
- `GET /api/gallery/<id>/preview.svg` — the server-rendered preview.
- `/` serves the full-screen feed; each tile links to `/g/<id>`, which the
  editor opens through the ordinary protocol boundary. `/editor` is the
  plain editor; `/editor?example=<id>` opens a bundled example. While the
  gallery is empty or unreachable the feed shows the bundled Library
  examples, so the landing page is never blank.

## Publishing

`POST /api/gallery/submissions` (same-origin) publishes immediately with:
trimmed `name` (required, ≤120), optional `author` (≤40) and `description`
(≤300), `projectText` ≤2 MiB. The Worker validates, stamps the canonical
serialization, renders the preview, and stores the entry as `public`.
Submissions count against a per-submitter (hashed IP) limit of 10 per UTC
day.

Phase G1 gate: publishing additionally requires the admin bearer until
Phase G2 sign-in replaces it with session identity — anonymous upload is
impossible from day one, which is also the end state. Entries persist a
nullable owner column so G3 ownership requires no migration.

## Administration

Admin routes require `Authorization: Bearer <GALLERY_ADMIN_TOKEN>` (a
Cloudflare secret; every admin route answers 401 until it is set):

- `POST /api/gallery/<id>/recycle` — soft delete into the restorable bin;
  the entry disappears from every public surface.
- `POST /api/gallery/<id>/restore` — back to `public`.
- `DELETE /api/gallery/<id>` — permanent, and only for entries already in
  the bin (`409` otherwise).
- `GET /api/gallery/recycled` — the bin.
- `POST /api/gallery/maintenance/reserialize` — re-parse and re-serialize
  every stored entry through the current protocol and refresh its preview;
  run once per schema advance while the rolling window still reads the old
  version. Failures are reported per entry and never destroy the record;
  the independently stored preview keeps expired entries browsable.

## Retention and privacy

Entries are public content; the recycle bin is the moderation mechanism
(publish-first by owner decision). Submitter identity is a salted hash of
the connecting IP used only for the daily quota; no account data exists in
Phase G1. Sign-in, per-user ownership, and owner-scoped editing arrive in
Phases G2–G3 as recorded in the roadmap.
