---
status: completed
experience: none
---

# VDD Named-Power Hotfix

## Goal

Deliver the urgent editor fix that makes VDD/AVDD/DVDD rails ordinary named
Net projections, restores completed two-click Rail creation from the current
Insert entry, keeps VDD Port and VDD Rail on the same Document-local VDD Net,
uses one Razavi net-bound label path, and stops manual MOS bulk from inventing
a global VDD/0 Net.

## State and Ownership

Start state:

```text
## codex/vdd-named-power-hotfix
```

The clean dedicated worktree starts from the coordinated
`codex/insert-unification` stack at `3a0128b8`. The broader schema-20 Formal
Port work remains isolated and uncommitted in
`codex/named-power-bulk-semantics`; this hotfix does not consume it.

Owned paths:

- `packages/derived/src/mos-bulk*`
- `packages/edit-engine/src/` power-rail/bulk edit implementation and tests
- `apps/editor/src/presentation/razavi-presentation*`
- `apps/editor/src/features/component-insert/` and current Insert tests
- `apps/editor/src/interaction/interaction-state*`
- `apps/editor/src/app/App.tsx` only for interaction wiring
- generated Agent request-schema and MCP Kit resource artifacts required by
  the shared edit union
- current Net/interaction specs and one superseding ADR
- this plan and `plan/log.md`

New Agent capabilities and Formal Port schema/cardinality are out of scope.
Existing Agent request artifacts receive only the mechanical compatibility
update required by the shared `add_power_rail` edit shape.

## Work

1. Remove MOS-polarity fallback creation of canonical global VDD/0; retain
   explicit B membership and configured `mosBulkDefaults` only.
2. Generalize `add_power_rail` to an explicit named Net and shared net-bound
   annotation; keep VDD as a UI preset, not a global identity.
3. Make manual VDD Port create/reuse local named VDD and let the Rail picker
   accept VDD/AVDD/DVDD names.
4. Carry the selected rail name through the canonical interaction state and
   prove the current I-dialog can complete the two-click gesture.
5. Update normative docs and focused tests.

## Validation

- Focused derived, edit-engine, presentation, component-insert, and interaction
  unit tests
- Focused current Insert browser tests for VDD/AVDD Rail and VDD Port
- `pnpm test:impact -- --base codex/insert-unification`
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: named power Rail/Port reuse, Net-bound Razavi text, no implicit
  global supply from hidden MOS bulk, and current Insert two-click completion
- Primary checks: `packages/derived/src/mos-bulk.test.ts`, edit-engine power
  transaction tests, editor VDD Rail tests, and `component-insert.spec.ts`

## Commit Intent

Commit as:

```text
fix(connectivity): decouple named power rails from mos bulk
```

## Outcome

Delivered named Document-local VDD/AVDD/DVDD rail authoring, VDD Port/Rail
same-name reuse, Net-bound Razavi rail text, and explicit/configured-only MOS
bulk resolution. Legacy persisted supply bindings remain readable, while new
manual MOS placement no longer invents global power Nets.

Validation passed:

- focused unit tests: 113 tests across 9 files
- focused Insert/MOS browser tests: 4 tests
- generated Agent API and MCP resource checks
- `pnpm test:impact -- --base codex/insert-unification`
- clean `pnpm install --frozen-lockfile` plus canonical `pnpm ci:check`:
  165 unit files / 990 tests, workspace build and release checks, and
  169 browser tests
- `git diff --check`
