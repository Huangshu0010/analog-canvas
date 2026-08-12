---
status: completed
experience: none
---

# WP-R5 — Project Search Index (core)

## Goal

Deliver the testable core of WP-R5 (roadmap §8 R5): a deterministic
case-insensitive project search index over instances, nets, and ports,
returning `ObjectLocator`s (ADR 0015) ranked by exact > prefix > substring with
no fuzzy ranking. Searchable fields: instance id, symbol, `spice.name`,
properties; net id + name; port id + name.

Deferred to R9/R10 (e2e-gated editor behavior): the `Ctrl+F` React UI, the
`HierarchyFrame[]` document-stack migration, and `navigateTo`'s viewport
wiring. Those mutate editor interaction state and need Playwright; the index
itself is pure and unit-testable, so it lands now as the search backend the UI
will consume.

## State and Ownership

```text
## roadmap/connectivity-routing-debugging
(clean — R0..R4 committed)
```

Owned paths:

- `packages/derived/src/project-search.ts` (NEW)
- `packages/derived/src/project-search.test.ts` (NEW)
- `packages/derived/src/index.ts` (re-export)
- `plan/2026-08-12-wp-r5-project-search-index/plan.md` (this file)
- `plan/log.md` (entry)

Read-only: `packages/model` schema shapes (`CircuitProject`, `Instance`,
`Net`, `Port`). No editor code is modified.

Shared: the `ObjectLocator` shape matches ADR 0015 (core fields; full
`hierarchyPath`/`endpoint`/`sourceRef` populated by navigation in R9/R10).

## Work

1. `project-search.ts`:
   - `ObjectLocator` (ADR 0015 core: `documentId`, `kind`, `objectId`).
   - `SearchField` (`instance-id` | `symbol` | `spice-name` | `property` |
     `net-name` | `net-id` | `port-name` | `port-id`), `MatchType` (`exact` |
     `prefix` | `substring`), `SearchResult` (`locator`, `label`, `field`,
     `matchType`).
   - `buildProjectSearchIndex(project)` → `{ search(query: string):
     SearchResult[] }`. Empty/whitespace query returns `[]`. Lowercase compare;
     best match per object (exact > prefix > substring); deterministic tie-break
     by `(documentId, kind, objectId, field)`.
2. `index.ts` re-export.
3. `project-search.test.ts`: exact beats prefix beats substring; case-
   insensitivity; instance `spice.name` and a property value both match;
   net name and port name; empty query returns `[]`; deterministic ordering.

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run packages/derived/src/`
- `pnpm exec prettier --check` on new `.ts` files
- `git diff --check`

## Commit Intent

```text
feat(derived): add deterministic project search index (WP-R5)
```

## Outcome

Delivered the testable core of WP-R5: a deterministic project search index over
instances, nets, and ports, returning ADR 0015 `ObjectLocator`s ranked exact >
prefix > substring with no fuzzy ranking. Pure backend; the `Ctrl+F` UI and
`HierarchyFrame[]` document-stack migration are deferred to R9/R10 (e2e-gated
editor behavior).

- `packages/derived/src/project-search.ts`: `ObjectLocator`, `SearchField`,
  `MatchType`, `SearchResult`, `buildProjectSearchIndex(project)` returning
  `{ search(query) }`. Searchable fields: instance id, symbol, `spice.name`,
  properties (excluding `spice.name`, which is dedicated); net id + name; port
  id + name. Best match per object; deterministic ordering.
- `packages/derived/src/index.ts`: re-export.
- `packages/derived/src/project-search.test.ts` (7 tests): empty query; case-
  insensitivity; exact > prefix > substring ranking; prefix vs substring; property
  value match; `spice.name` match with label; deterministic ordering.

Validation: workspace `pnpm typecheck` passed; `vitest run packages/derived/src/`
passed (99 tests, was 92); `prettier --check` on the new `.ts` files passed;
`git diff --check` clean.

`status: completed`, `experience: none`.
