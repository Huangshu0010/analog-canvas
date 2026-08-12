---
status: completed
experience: none
---

# Unify Razavi MOS Bulk Semantics

## Goal

Keep Razavi MOS artwork three-terminal by default while preserving the canonical
D/G/S/B electrical model, supporting an explicit Razavi dashed bulk route, and
resolving an omitted manual bulk through document defaults followed by the
NMOS-to-ground / PMOS-to-VDD fallback without false floating-bulk diagnostics.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. This target owns the shared bulk-connection contract
and its direct consumers:

- `packages/model/src/`
- `packages/derived/src/`
- `packages/edit-engine/src/`
- `packages/symbols/assets/razavi-v1/` and generated catalog output when needed
- `scripts/generate-razavi-mos-assets.mjs` as the authoritative MOS asset generator
- `packages/render-svg/src/`
- `packages/spice/src/` tests needed to demonstrate D/G/S/B preservation
- `apps/editor/src/`
- generated Agent API fixtures under `fixtures/agent-api/`
- relevant normative documentation, including `docs/specs/agent-api.md`
- this target plan and `plan/log.md`

Shared dependencies are the persisted Project schema, Net membership, Route
contract, Symbol DSL, topology hash, Agent snapshot, and SPICE round-trip. Any
schema change must include migration/compatibility handling. Unrelated Razavi
geometry, reference images, netlist fixtures, and binary assets remain outside
the target.

The generated Agent API schemas were added to the owned set after the
deterministic artifact check reported them stale from the new typed bulk edits;
they are regenerated mechanically and remain reviewable against the adapter
source.

The MOS generator was added after its staleness gate proved that editing only
the generated symbol JSON would be overwritten. The generator owns only the
new auxiliary B anchor metadata; calibrated primitive geometry remains
unchanged.

## Work

1. Characterize the current MOS bulk, Route, schema, rendering, placement, and
   SPICE contracts with focused tests.
2. Add one derived bulk resolver that classifies explicit, document-default,
   product-fallback, model-internal, and unresolved states without guessing
   from presentation visibility.
3. Persist document bulk defaults by stable Net ID and make manual placement
   materialize the resolved B membership atomically through the Edit Engine.
4. Rework ERC and editor inspection to consume the resolver; a connected
   body-bias or B=S connection must never be called floating.
5. Add the Razavi visible-B anchor/variant and reuse the canonical Route model
   with a dashed bulk presentation for editing, selection, deletion, undo,
   highlight, and export.
6. Add focused regression tests for imported four-node MOS, manual fallback,
   explicit overrides, deletion/default restoration, ERC, rendering, and GUI
   behavior. Update the normative contract.

## Validation

- focused Vitest suites for model, symbols, derived ERC/bulk resolution,
  edit-engine, render-svg, SPICE, and editor behavior
- workspace typecheck for affected packages
- `git diff --check`
- `git status --short --branch`

Because this crosses the persisted model and shared connectivity contract,
expand to the workspace test suite after focused checks are green. Visual
pixel-reference recalibration is not required: the target adds a semantic
anchor and route style but does not retune existing approved geometry.

## Commit Intent

Commit as:

```text
feat: unify Razavi MOS bulk connectivity
```

## Outcome

Implemented one Razavi MOS bulk contract across persisted model, Derived,
Edit Engine, symbol variants, rendering, editor, Agent API, and normative docs.
Canonical MOS remains D/G/S/B; manual three-terminal authoring materializes a
Cell Net-ID default or NMOS-to-0 / PMOS-to-VDD fallback before editor history is
installed, while source-bound imports remain unresolved rather than guessed.
Explicit body-bias exposes the same B terminal at a context-gated auxiliary
anchor and uses the normal Route/Net machinery with `bulk-dashed`
presentation. The common route-deletion planner removes a connected dashed
chain, disconnects explicit B, and reconciles fallback atomically for every UI
deletion path. ERC and Agent Snapshot consume the shared resolver instead of
reimplementing safe-Net guesses.

Validation passed:

- `corepack pnpm test`: 101 files, 606 tests
- `corepack pnpm exec playwright test --workers=8`: 86 tests
- `corepack pnpm typecheck`
- `corepack pnpm format:check`
- `corepack pnpm references:check`
- `corepack pnpm symbols:razavi-mos:check`
- `corepack pnpm symbols:razavi:check`
- `corepack pnpm agent-api:artifacts:check`
- `corepack pnpm build`
- `git diff --check`

The first full browser run exposed and protected one recovery-boundary bug:
load-time fallback materialization initially looked like an unsaved human edit.
Moving that deterministic upgrade before the history/recovery graph fixed it;
the final full run passed. No visual pixel retuning or SPICE terminal-order
change was made.
