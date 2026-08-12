---
status: completed
experience: none
---

# WP-R9 — Diagnostic Aggregation (envelope + visual adapter)

## Goal

Deliver the testable data layer of WP-R9 (roadmap §8 R9, §5.6): a unified
`Diagnostic` envelope and an aggregation that merges ERC diagnostics (R8,
already envelope-shaped) with the existing `VisualDiagnostic` observations
behind an adapter, producing one domain-tagged, sorted list. This is the data
source the diagnostic UI panel consumes; the React panel + `navigateTo`
viewport wiring are deferred to an e2e-gated target.

## State and Ownership

```text
## roadmap/connectivity-routing-debugging
(clean — R0..R8 committed)
```

Owned paths:

- `packages/derived/src/diagnostics/diagnostic.ts` (NEW)
- `packages/derived/src/diagnostics/diagnostic.test.ts` (NEW)
- `packages/derived/src/index.ts` (re-export)
- `plan/2026-08-12-wp-r9-diagnostic-aggregation/plan.md` (this file)
- `plan/log.md` (entry)

Read-only: `packages/derived/src/diagnostics/erc.ts`, `connectivity-index.ts`,
`visual.ts`. No editor/UI code this target.

## Work

1. `diagnostics/diagnostic.ts`:
   - Canonical `Diagnostic` envelope (ADR 0015) with `domain:
     schema|spice|erc|routing|visual`. `ErcDiagnostic` is a subtype (`domain:
     "erc"`).
   - `adaptVisualDiagnostic(visual, documentId, index)`: maps a `VisualDiagnostic`
     to the envelope (`domain: "visual"`), resolving `objectIds` to `primary`/
     `related` locators via the project object index.
   - `mergeDiagnostics(...groups)`: concatenates and sorts by `(domain, severity,
     documentId, code, primary.objectId)` deterministically.
2. `index.ts` re-export.
3. `diagnostic.test.ts`: a visual diagnostic adapts to a `domain: "visual"`
   envelope with a resolved primary locator; merge combines ERC + visual into one
   sorted list; visual observations and ERC stay in distinct domains.

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run packages/derived/src/`
- `pnpm exec prettier --check` on new `.ts`
- `git diff --check`

## Commit Intent

```text
feat(derived): unify diagnostics into a single sorted envelope (WP-R9)
```

## Outcome

Delivered the WP-R9 data layer: the unified `Diagnostic` envelope and an
aggregation that merges ERC (R8) with adapted `VisualDiagnostic` observations
into one domain-tagged, deterministically sorted list. This is the data source
the diagnostic UI panel consumes. The React panel itself and the `navigateTo`
viewport wiring are deferred to an e2e-gated target (they mutate editor
interaction state).

- `packages/derived/src/diagnostics/diagnostic.ts`: canonical `Diagnostic`
  (ADR 0015, domain `schema|spice|erc|routing|visual`; `ErcDiagnostic` is a
  subtype), `adaptVisualDiagnostic` (resolves `objectIds` to `primary`/`related`
  locators via the project object index; `domain: "visual"`), and
  `mergeDiagnostics` (domain then severity then document/code/object order).
- `packages/derived/src/index.ts`: re-export.
- `packages/derived/src/diagnostics/diagnostic.test.ts` (3 tests): visual
  adapter resolves the primary locator; ERC and visual stay distinct domains
  after merge with ERC ordered first; deterministic merged order.

Validation: workspace `pnpm typecheck` passed; `vitest run packages/derived/src/`
passed (112 tests, was 109); `prettier --check` on new `.ts`; `git diff --check`
clean.

Deferred (e2e-gated editor behavior): the diagnostic panel UI, domain/severity/
Cell grouping, click-to-navigate via `navigateTo`, and SPICE source-span
display. The envelope + aggregation here are the data contract for that UI.

`status: completed`, `experience: none`.
