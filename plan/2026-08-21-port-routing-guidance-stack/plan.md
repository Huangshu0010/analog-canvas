---
status: completed
experience: none
---

# Stack imported routing guidance with unified Port semantics

## Goal

Stack `codex/spice-import-routing-guidance` onto the current unified Port
branch, then reconcile schema, edit, documentation, and connectivity behavior.
Imported routing guidance must use the same Net/terminal facts as Free Net
Ports and Formal Cell Pins without becoming a second connectivity protocol.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-unification...origin/codex/insert-unification [ahead 2]
```

Both worktrees are clean. The two local commits are the already validated
Port/export stack; their remote push is pending after GitHub TLS handshake
failures. The routing-guidance source branch has one commit, `60ff3692`, based
on the same `origin/main`.

Owned paths are the source commit's model/protocol/SPICE/derived/edit-engine/
editor/docs/generated-fixture surface plus the existing Port lifecycle files,
ADR index/current-reading set, this plan, and `plan/log.md`.

Shared contracts:

- Net membership is the sole electrical truth for ordinary terminals, Free
  Net Ports, and Formal Cell Pins.
- Routing guidance is derived presentation for imported Net topology only; it
  never creates, merges, names, or disconnects a Net.
- Free Port same-folded-name merge retains imported provenance when either Net
  originates from SPICE.
- Removing the final Port may prune unreachable authored local Nets, but must
  retain an imported Net's source-topology identity.
- The stack advances schema 18 to 19 and replaces `make_flightline` with the
  geometry-truthful `remove_route_geometry`; it adds no Port-specific edit or
  Agent endpoint.
- Top-level `P` remains Free Net Port by default; both Port roles stay
  explicit in every Document.

## Work

1. Integrate `60ff3692` and resolve App, browser, documentation, plan-log, and
   schema-generated-artifact conflicts without reverting the unified Port UI.
2. Renumber imported routing guidance from ADR 0034 to ADR 0035 because the
   accepted top-Cell Port/export decision already owns 0034; update all links.
3. Audit and fix Port/Net-origin interactions: authored Port creation,
   same-name merge, imported provenance retention, final-Port deletion, formal
   interfaces, guidance endpoint visibility, and non-emitting netlist export.
4. Add focused regression tests for imported-origin retention through Port
   merge/delete and confirm authored Port Nets remain guidance-ineligible.
5. Run coordinated unit, browser, generated-artifact, documentation, and
   branch-level validation.

## Validation

- focused model/protocol/SPICE/derived/edit-engine/netlist/Port tests
- focused imported-guidance and Port browser workflows
- generated Agent/MCP artifact checks
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `pnpm verify:branch`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: schema-19 origin migration; imported-only guidance; shared Port
  Net identity; imported-origin merge/delete retention; authored-Net cleanup;
  top Formal Pin and Free Port export behavior.
- Primary checks: derived routing-guidance, edit-engine lifecycle/transaction,
  netlist current contract, project migration, and combined GUI workflows.

## Commit Intent

Preserve the source commit through cherry-pick, then commit coordinated fixes
as:

```text
fix(connectivity): reconcile port and routing guidance semantics
```

## Outcome

Stacked routing-guidance commit `60ff3692` as `85cf56ec` above the unified
Port/export branch. Schema 19 now carries per-Net `authored` or `spice-import`
origin; only imported Nets produce derived RoutingGuides, and the typed
geometry deletion is consistently named `remove_route_geometry`.

Coordination fixed two cross-branch defects. Imported routing guidance was
renumbered to ADR 0035 because top-Cell Port/export already owns ADR 0034.
Deleting the final Free/Formal Port marker now prunes an unreachable authored
local Net but retains an imported Net's provenance. Merging an authored Port
Net into an imported same-name Net preserves imported source IDs. Port
terminals use the ordinary Net connectivity graph; there is no Port-specific
guidance state, edit, or endpoint. Guidance controls are absent on ordinary
authored canvases and appear only when imported guidance exists.

Validation passed: focused cross-layer unit tests (79 initial plus 46 repair
checks), 8 coordinated Port/guidance browser workflows, typecheck, formatting,
documentation links, test-impact, Agent API artifacts, MCP resources/catalog/
distribution, and `pnpm verify:branch` (165 unit files / 991 tests, every
workspace build, and production preview smoke).

The integrated branch is ready for unified GUI testing. Source worktrees remain
unchanged. Coordinated repair is committed as the current branch HEAD after
stack commit `85cf56ec`.
