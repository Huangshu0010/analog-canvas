---
status: completed
experience: none
---

# Add the Variable Resistor Component

## Goal

Add a palette-visible two-terminal variable resistor that reuses the existing
resistor body and overlays one diagonal adjustment arrow. The arrow is
presentation, not a third terminal. Each placed instance is a hierarchical
`X` block bound to one project-local generated child Cell, so export contains
a real `.subckt` body rather than flattening it into a parent-level resistor.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. This target owns the new symbol/device definition and
the directly affected product catalogs, label placement, tests, generated
catalog adapters, target record, and maintenance log.

- `packages/symbols/assets/razavi-v1/`
- `packages/symbols/src/`
- `packages/devices/src/`
- `packages/derived/src/instance-label-placement*`
- `apps/editor/src/features/component-insert/symbol-catalog*`
- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/src/features/component-insert/variable-resistor-cell*`
- `apps/editor/src/features/netlist-export/netlist-authoring.test.ts`
- `packages/agent-adapter/src/agent-authoring-catalog.generated.ts`
- `apps/mcp-server/src/resources.generated.ts`
- `plan/2026-08-21-variable-resistor/plan.md`
- `plan/log.md`

Shared dependencies are the Razavi product-catalog generation contract,
device/Symbol pin parity, and the Agent built-in catalog. Existing reference
evidence is read-only: the approved resistor geometry and arrow treatment in
`fixtures/visual-reference/razavi-reference-v1/` are composed under the
user's explicit two-terminal visual direction.

## Work

1. Add a two-pin `variable-resistor` Symbol by composing the calibrated
   resistor body with a diagonal arrow shaft and head.
2. Register its authoring fields as a child-Cell-backed device with an `X`
   reference and required resistance value semantics.
3. On first placement, atomically create one reusable project-local child Cell
   containing a parameterized ordinary resistor, two formal ports, and visible
   internal routes; bind every placed custom-artwork instance to that Cell.
4. Expose it in Passives, preserve side-label behavior, and regenerate the
   runtime and Agent catalogs.
5. Add focused contracts for the visible arrow, two-pin identity, palette
   discovery, hierarchy reuse, and emitted `X`/`.subckt` netlist behavior.

## Validation

- `pnpm symbols:razavi:check`
- `pnpm agent-kit:catalog:check`
- focused `pnpm test:local` paths for symbols, devices, derived labels, and
  editor insertion/netlist authoring
- `pnpm test:impact -- --base origin/main`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: two electrical pins; diagonal arrow presentation; palette
  classification/search; one reusable child Cell; `X` reference and
  subcircuit binding; generated catalog parity
- Primary checks: `packages/symbols/src/razavi-catalog.test.ts`,
  `packages/symbols/src/builtins.test.ts`,
  `packages/devices/src/registry.test.ts`,
  `packages/derived/src/instance-label-placement.test.ts`,
  `apps/editor/src/features/component-insert/symbol-catalog.test.ts`, and
  `apps/editor/src/features/netlist-export/netlist-authoring.test.ts`, and
  `apps/editor/src/features/component-insert/variable-resistor-cell.test.ts`

## Commit Intent

Commit as:

```text
feat: add variable resistor component
```

## Outcome

Added a reviewed two-terminal `variable-resistor` with one diagonal adjustment
arrow and `P1`/`P2` block ports. The first placement atomically creates one
project-local `VariableResistor` child Cell containing two formal ports, a
parameterized ordinary resistor, and visible routes; every placed custom
symbol binds to that same Cell with an `X` reference. Export therefore emits a
real `.subckt VariableResistor`, its internal `R1`, and parent `X…` calls.
Runtime and Agent catalogs were regenerated. Eight focused test files passed
(58 tests), the final hierarchy/export contract rerun passed (2 tests), and
symbol, Agent/MCP generation checks, typecheck, test-impact,
dependency-ordered editor production build, docs, and diff checks passed.
