---
status: completed
experience: none
---

# SPICE Import Routing Guidance

## Goal

Replace the current document-wide, edit-dismissed Flightline behavior with a
device-agnostic routing-guidance system. Only SPICE-imported Nets receive
derived guidance; manual Nets never do. Guidance is recomputed from the shared
connectivity graph after placement, routing, deletion, labels, and transforms.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/spice-import-routing-guidance
```

This dedicated worktree is clean. The root worktree and sibling worktrees are
owned by other targets and are not touched.

Owned paths:

- `packages/model/src/schema/{connectivity,document}.ts`, model exports and
  focused model/protocol tests
- `packages/project-protocol/src/{version,transforms/project}.ts` and
  persistence/migration corpus tests
- `packages/spice/src/{importer,compiler.test}.ts`
- `packages/derived/src/{connectivity,connectivity-index,routing-guidance}.ts`
  and focused derived tests
- `packages/edit-engine/src/{edit-schema,connectivity-proposal,transaction,transaction-preflight}.ts`
  and routing/transaction tests
- `apps/editor/src/app/App.tsx`, wire interaction, styling, focused editor
  tests, and relevant E2E coverage
- current connectivity/edit-engine/Agent specifications, a new ADR, this plan,
  and `plan/log.md`

Read-only shared dependencies:

- schema-18 identity and placement protocol (ADR 0030–0033)
- `ProjectConnectivityIndex`, endpoint/contact/route geometry contracts
- SPICE/netlist import/export topology contracts
- current wire, route-tap, deletion, and net-highlight interaction behavior

## Work

1. Advance the Project schema to 19 and add explicit Net origin metadata;
   importer-created Nets are `spice-import`, factories and authored planner
   Nets are `authored`, and migration maps schema-18 source-bound Nets
   deterministically.
2. Replace document-level `flightlineGuidance` with an editor-only guidance
   view mode. Remove transaction side effects that dismiss guidance after
   move, transform, label, route, or delete edits.
3. Extract a pure device-agnostic routing-guidance algorithm that accepts a
   standard Net graph supplied by the Connectivity Index. Keep symbol/pin/MOS
   visibility policy upstream of the algorithm.
4. Make guidance eligible only for imported Nets and derive it from current
   visible connectivity evidence. Preserve global-Net and implicit-Pin rules.
5. Replace `make_flightline` with an accurately named geometry-only edit and
   route GUI/Agent deletion through a single source-aware delete planner:
   imported membership is retained; authored local Nets are cut when safe.
6. Implement focused/all/hidden editor presentation, per-Net highlight
   suppression, clickable guidance-to-Wire flow, and truthful displayed versus
   derived counters.
7. Add import-aware unplaced-endpoint guidance in the selection shelf and
   characterize the real SPICE placement/move/delete/label workflow.
8. Update specifications, ADRs, generated protocol artifacts when required,
   and focused regression coverage.

## Validation

- focused model/project-protocol/SPICE/derived/edit-engine tests
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "flightline|guidance|imported"`
- `pnpm test:impact -- --base main`
- `pnpm typecheck`
- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: schema-19 migration; imported versus authored Net guidance;
  device-neutral guidance graph; placement/move/delete/label recomputation;
  one Route deletion command; focused/highlighted editor display; real SPICE
  import behavior.
- Primary checks: focused model/project-protocol/SPICE/derived/edit-engine
  suites and manual editor E2E guidance flows.

## Commit Intent

Commit as one or more reviewable commits, beginning with:

```text
feat(connectivity): derive routing guidance for imported Nets
```

## Outcome

Delivered schema-19 per-Net routing provenance, a pure device-neutral routing
guidance kernel, and the imported-Net-only adapter in the connectivity index.
The retired document-wide `flightlineGuidance` state and its transaction
dismissal side effects are removed. `remove_route_geometry` replaces the
misnamed `make_flightline`; source-aware cutting retains imported electrical
membership so guidance re-derives after a Route is deleted.

The editor now has focused/all/hidden imported-guidance display, suppresses
only the highlighted Net, keeps the existing Placement Tray truthful for
unplaced endpoints, and reports derived versus displayed counts. SPICE import
writes explicit origin; authored transaction-created Nets do too; the rolling
schema-18 reader migration supplies deterministic origin for legacy Projects.

Validation passed: focused protocol/SPICE/derived/edit-engine tests (including
schema migration and imported-vs-authored guidance), editor guidance and
imported E2E flows, full workspace unit-test execution after baseline updates,
typecheck, format/docs/reference checks, generated Agent/MCP artifact checks,
workspace build, production smoke, test-impact, and diff checks.
