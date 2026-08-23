---
status: completed
experience: none
---

# Unified Net marker and instance foundation

## Goal

Converge physical connectivity, named-Net semantics, power markers, imported
source identity, diagnostics, export, and Agent read views onto one electrical
contract while preserving the current Razavi rendering and existing editor
gestures.  VDD, Ground, free Net Ports, route labels, and the current Power
Rail gesture become presentations of one named-Net marker system.  Physical
wires remain Base Nets; same-name connectivity is derived and reversible.

Keep the established device separation between Symbol Definition, Instance,
and Presentation.  This target must not alter symbol geometry or visible text
layout.  Instance identity remains opaque, emitted device reference remains an
electrical/netlist fact, and RichText annotations remain presentation facts.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/project-net-lifecycle...origin/codex/project-net-lifecycle
```

The target worktree is clean.  Repository-root `.pnpm-store/` and
`.worktrees/` are untracked workspace infrastructure outside this worktree.
The branch is 20 commits behind `origin/main`; those commits include current
Port rename, Power Rail import, Properties layout, and any-angle routing
behavior.  Integrate `origin/main` before changing the contract and preserve
those behaviors through focused regressions.

Another clean worktree, `codex/properties-identity-placement-polish`, owns
current Properties/App presentation changes.  Treat it as read-only and avoid
changing Properties layout or symbol presentation; App edits are limited to
thin electrical adapters when unavoidable.

Owned paths:

- `packages/model/src/schema/connectivity.ts`
- `packages/model/src/schema/document.ts`
- `packages/model/src/schema/types.ts`
- `packages/model/src/net-contract.ts`
- `packages/model/src/power-domain.ts`
- `packages/model/src/factories.ts`
- `packages/project-protocol/src/`
- `packages/derived/src/logical-net.ts`
- `packages/derived/src/connectivity-index.ts`
- `packages/derived/src/connectivity.ts`
- `packages/derived/src/diagnostics/erc.ts`
- `packages/derived/src/project-search.ts`
- `packages/derived/src/topology-hash.ts`
- `packages/derived/src/annotation-text.ts`
- `packages/netlist/src/`
- `packages/spice/src/importer.ts`
- `packages/edit-engine/src/named-net-planner.ts`
- `packages/edit-engine/src/power-net-planner.ts`
- `packages/edit-engine/src/edit-schema.ts`
- `packages/edit-engine/src/transaction*.ts`
- `packages/edit-engine/src/connectivity-proposal.ts`
- `packages/agent-adapter/src/snapshot.ts`
- `packages/agent-adapter/src/service.ts`
- `packages/agent-client/src/authoring-helper.ts`
- `apps/editor/src/features/component-insert/placement-connectivity.ts`
- `apps/editor/src/features/component-insert/vdd-rail.ts`
- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/src/features/clipboard/clipboard.ts`
- `apps/editor/src/app/App.tsx` (electrical adapter only)
- directly affected tests, fixtures, generated protocol artifacts, specs,
  ADRs, this plan, and `plan/log.md`

Read-only/shared boundaries:

- Symbol assets, Razavi geometry, renderer styling, CSS, and presentation
  calibration are read-only.
- Formal Cell Port remains a hierarchy-interface object even though it binds a
  Base Net; do not collapse it into a free Net marker.
- Physical wire contact may retain an internal Base-Net merge primitive.
- `codex/properties-identity-placement-polish` is a read-only integration
  dependency.

## Work

1. Integrate current `origin/main`, resolve the ADR number collision, and
   characterize existing Net Label, free Port, VDD, Ground, Power Rail,
   clipboard, ERC, export, and Agent behavior before changing contracts.
2. Freeze one model:
   - Base Net owns only physical terminal/Route/Junction membership;
   - owner-addressed named-Net facts are the only naming/scope/power authority;
   - Logical Net is a derived equivalence class;
   - source-Net identity is another input to the same resolver, not another
     naming implementation;
   - runtime `Net.name` fallback and direct `set_net_name` authority retire.
3. Make all user-visible named-Net producers use the same planner: route Net
   Label, free Net Port, VDD/supply marker, Ground marker, and the existing
   Power Rail gesture.  Keep their current symbols, annotations, insertion
   gestures, snapping, and visual geometry.  AVDD/DVDD are ordinary supply
   marker names rather than new symbol/protocol types.
4. Replace the ambiguous connectivity-index alias map with explicit Base and
   Logical maps.  Migrate annotation text, highlight/trace, ERC, search,
   clipboard, routing guidance, export, and topology hashing.  Named labels
   suppress physical flightlines; imported source identity may retain routing
   guidance.
5. Keep Agent evidence mutation unavailable, but expose the resolved Logical
   Net read view and make electrical topology hashes include logical identity.
6. Preserve device layering without adding another name authority.  Do not
   alter Symbol Definitions or annotation presentation.  Record the canonical
   relationship among `Instance.id`, emitted reference, schematic reference,
   and RichText display; defer any user-visible identity-field removal to a
   separate reviewed UI target.
7. Update the normative ADR/specs and add cross-layer regressions for mixed
   producers, lifecycle deletion, copy/paste, VDD/AVDD/DVDD/Ground, imported
   guidance, ERC, export, Agent snapshots, and hash changes.

## Validation

- Focused model, protocol, edit-engine, derived, netlist, SPICE, Agent, and
  editor unit tests covering changed contracts.
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "Net Label|Free Net Port|VDD|Ground|Power Rail|highlight|SPICE"`
- `pnpm test:e2e:local apps/editor/e2e/project-file.spec.ts`
- `pnpm test:e2e:local apps/editor/e2e/web-agent-session.spec.ts`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: full
- Early gates: gate review, static contracts, focused schema/resolver tests,
  and browser characterization before migration.
- Affected gates: workspace unit tests plus component insertion, hierarchy,
  project-file, manual-editor, and Agent browser contracts.
- Final gates: `pnpm ci:check` and remote required checks before mainline
  delivery.
- Platform risks: generated Agent/OpenAPI artifacts, schema migration,
  browser interaction parity, golden visuals, and integration with the 20
  newer mainline commits.

The advisory path plan selected static contracts, workspace units,
component-insert, hierarchy, project-file, Agent browser, and the full delivery
gate.  Regeneration from the real `origin/main` diff selected those same
surfaces plus full branch verification because generated fixtures require the
fallback path.  The implementation followed that expanded selection.

## Test Impact

- Decision: tests-updated
- Contracts: one named-Net authority; reversible owner lifecycle; identical
  visual geometry and gestures; correct supply/global semantics; consistent
  ERC/export/highlight/Agent topology; Formal Cell Port identity remains
  separate from internal Logical-Net naming.
- Primary checks: resolver/model/edit-engine unit contracts, SPICE/netlist
  round trips, all 187 unit files, and the component-insert, hierarchy,
  project-file, manual-editor, and Agent browser suites selected by the gate.

## Commit Intent

Commit as reviewable stages, ending with:

```text
refactor(connectivity): unify named net and power marker semantics
```

## Outcome

Completed the runtime electrical convergence without changing symbol assets,
Razavi geometry, CSS, or user-facing insertion gestures:

- Base Nets now own physical connectivity only.  VDD, Ground, Free Port, Net
  Label, and Power Rail all author owner-addressed marker claims; Power Rail
  and VDD therefore differ only in gesture/presentation.
- One Logical-Net resolver now supplies ERC, export, search, highlight,
  routing guidance, clipboard, Agent snapshots, and topology hashes.  Equal
  names join reversibly in that view; physical contact remains the only reason
  to merge Base Nets.
- Removed raw `set_net_name`, `set_net_power_domain`, and named wire inputs,
  plus the retired parallel Net-contract/power-domain modules.  Agent reads
  resolved Logical Nets and cannot mutate the Evidence layer.
- Formal Cell Ports remain hierarchy declarations and may intentionally use a
  different name from their internal Logical Net.  Repeated markers reuse the
  formal terminal through its Logical-Net binding rather than creating a
  second naming protocol.
- Schema-21 Net semantic fields remain inert rolling-reader projections in
  schema 22; no runtime consumer treats them as electrical authority.

Validation completed:

- `pnpm gate:preflight -- --base origin/main`
- affected browser suites: component insert 24/24, hierarchy 13/13, project
  file 11/11, Agent 1/1, manual editor 99/99
- `pnpm verify:branch`: static contracts, 187 unit files / 1214 tests, all
  workspace builds, and editor production smoke
- `git diff --check`
