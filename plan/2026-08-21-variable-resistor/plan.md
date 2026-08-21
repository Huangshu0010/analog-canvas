---
status: completed
experience: none
---

# Add the Variable Resistor Component

## Goal

Add a palette-visible two-terminal variable resistor that reuses the existing
resistor body and overlays one diagonal adjustment arrow. It remains
electrically and in exported SPICE/Spectre netlists an ordinary resistor; the
arrow is presentation, not a third terminal.

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
2. Register it as a resistor-class device with the existing `R` reference and
   required resistance value semantics.
3. Expose it in Passives, preserve side-label behavior, and regenerate the
   runtime and Agent catalogs.
4. Add focused contracts for the visible arrow, two-pin identity, palette
   discovery, reference allocation, and resistor netlist binding.

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
  classification/search; resistor-class value/reference/netlist behavior;
  generated catalog parity
- Primary checks: `packages/symbols/src/razavi-catalog.test.ts`,
  `packages/symbols/src/builtins.test.ts`,
  `packages/devices/src/registry.test.ts`,
  `packages/derived/src/instance-label-placement.test.ts`,
  `apps/editor/src/features/component-insert/symbol-catalog.test.ts`, and
  `apps/editor/src/features/netlist-export/netlist-authoring.test.ts`

## Commit Intent

Commit as:

```text
feat: add variable resistor component
```

## Outcome

Added a reviewed, palette-visible `variable-resistor` with the existing
two-terminal resistor body plus one diagonal adjustment arrow. It shares the
ordinary resistor's `R` reference, required resistance value, and
SPICE/Spectre primitive binding; structural SPICE import remains mapped only
to the canonical plain resistor because it cannot preserve this visual choice.
Runtime and Agent catalogs were regenerated. Seven focused test files passed
(56 tests), the final netlist-authoring rerun passed (6 tests), and symbol,
Agent/MCP generation checks, typecheck, test-impact, dependency-ordered editor
production build, and diff checks passed. A direct editor-only build initially
observed stale pre-pull netlist output; rebuilding the declared editor
dependency graph refreshed it and passed.
