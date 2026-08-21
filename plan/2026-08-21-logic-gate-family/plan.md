---
status: completed
experience: none
---

# Logic-Gate and Comparator Symbol Family

## Goal

Add six palette-visible behavioral block Symbols the user requested for
textbook block-diagram authoring: `inverter`, `and-gate`, `or-gate`,
`nand-gate`, `nor-gate` (new "Logic Gates" palette category), and
`comparator` (Analog Blocks). All follow the existing opamp mechanism: catalog
entry with explicit pin order and a manual-only netlist reason, no device
descriptor, no automatic SPICE mapping — placement behaves exactly like the
op-amp today. Geometry is hand-composed in the approved Razavi stroke
language (emphasis body outline, normal leads, 10-grid pins), under the
user's explicit visual direction from their supplied Razavi figures (DFF/PFD
gates, NOR latches, hysteresis comparator with DAC). The comparator reuses
the calibrated op-amp triangle and input polarity marks, adding a hysteresis
glyph.

## State and Ownership

Start state from `git status --short --branch`: on `main` after PR #138
merged; the worktree carries the completed-but-uncommitted
`2026-08-21-rectangle-centered-text` target (disjoint files) and the
user-requested untracked `CLAUDE.md`. No dirty path overlaps this target.

Owned paths:

- `packages/symbols/assets/razavi-v1/{inverter,and-gate,or-gate,nand-gate,nor-gate,comparator}.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json` and `README.md`
- `packages/symbols/src/razavi-catalog.generated.ts` (regenerated) and
  `razavi-catalog.test.ts`
- `packages/agent-adapter/src/agent-authoring-catalog.generated.ts`
  (regenerated)
- `apps/mcp-server/src/resources.generated.ts` (regenerated if the resource
  pipeline consumes the catalog)
- `apps/editor/src/features/component-insert/symbol-catalog.ts` and test
- `apps/editor/src/features/editor-shell/shapes-panel.tsx` and test
- `apps/editor/e2e/component-insert.spec.ts` (Library count contracts; added
  when the browser Library suite exposed its own chip/category counts)
- `plan/2026-08-21-logic-gate-family/plan.md`, `plan/log.md`

Shared dependencies: Razavi catalog generation contract
(`scripts/generate-razavi-symbol-catalog.mjs` — 10-grid pins, pin-order
parity, asset hashes), the product-palette eligibility rule
(`reviewed` + razavi-reference-v1 authority), and the Agent built-in
authoring catalog. Read-only: `fixtures/visual-reference/razavi-reference-v1/`
(cited as stroke/proportion authority; no new reference assets are added).

## Work

1. Author the six symbol assets: IEEE/Razavi gate shapes (flat-back D for
   AND, crescent for OR, triangle for the inverter), negation bubbles as
   `part: "negation-bubble"` circles, comparator = op-amp triangle + polarity
   marks + hysteresis step. All pins on the 10 grid with 20-unit leads.
2. Append the catalog entries (`reviewed`, `palette: true`, empty
   `automaticMappings` with a manual-only reason; gates category `logic`,
   comparator `analog-block`) and regenerate the runtime catalog adapter.
3. Regenerate the Agent authoring catalog (and MCP resources if affected).
4. Editor exposure: new "Logic Gates" category in the insert catalog order,
   comparator joins Analog Blocks, compact shapes-panel labels for all six.
5. Update the count/coverage contracts and add a family contract test
   (pin identity, bubble presence on inverting shapes only).

## Validation

- `node scripts/generate-razavi-symbol-catalog.mjs --check`
- `node scripts/generate-agent-authoring-catalog.mjs --check`
- focused `vitest` for `packages/symbols`, `packages/devices` parity,
  `apps/editor` symbol-catalog and shapes-panel
- repository typecheck
- `node scripts/check-test-impact.mjs --base HEAD`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: catalog size and generated-adapter parity; palette category
  classification and search; two-input gate pin identity (`A`,`B`,`Y`) and
  inverter/comparator pinouts; negation-bubble presence only on inverting
  gates; shapes-panel coverage counts and labels
- Primary checks: `packages/symbols/src/razavi-catalog.test.ts`,
  `packages/symbols/src/builtins.test.ts`,
  `packages/symbols/src/device-parity.test.ts`,
  `apps/editor/src/features/component-insert/symbol-catalog.test.ts`,
  `apps/editor/src/features/editor-shell/shapes-panel.test.ts`

## Commit Intent

Committed on `claude/block-diagram-authoring` at the user's direction as:

```text
feat(symbols): add logic-gate and comparator family
```

## Outcome

Delivered the six-symbol family exactly on the op-amp mechanism: hand-composed
Razavi-style assets (10-grid pins, emphasis bodies, `negation-bubble` circle
parts on inverter/NAND/NOR, comparator = calibrated op-amp triangle + polarity
marks + hysteresis step), catalog entries (`reviewed`, palette, manual-only
netlist reason; gates in a new `logic` category, comparator in
`analog-block`), regenerated runtime/Agent/MCP catalogs (the MCP regeneration
built the model→agent-adapter chain with plain `tsc` because `pnpm` is not on
this machine's PATH), a new "Logic Gates" palette section, comparator in
Analog Blocks, and compact shapes-panel labels. Contracts updated: catalog
identity/product lists (19→25), builtins product IDs, shapes-panel
(26 chips / 7 categories), symbol-catalog categories, browser Library counts
in `component-insert.spec.ts` (20→26, 6→7), plus a new family test (pin
identities, bubbles only on inverting shapes, manual-only entries).
Validation: generator `--check`s (symbol catalog, agent catalog, MCP
resources, agent-api artifacts), 103 focused unit tests, the full
component-insert Playwright suite (21 passed), repository typecheck,
test-impact, and diff checks; all six symbols were also placed and visually
inspected in the running editor (X1–X6). Committed on
`claude/block-diagram-authoring` at the user's direction; the local canonical
gate cannot run here (`pnpm` absent), so mainline delivery relies on the
remote required checks before merge.
