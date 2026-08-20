# Current Documentation

This is the default reading set for product work. Do not begin with broad
repository search, completed roadmaps, target plans, or `docs/archive/`.

## Read in this order

1. [`../overall-product-plan.md`](../overall-product-plan.md) — product
   boundary, system shape, and source-of-truth map.
2. [`../adr/0022-current-protocol-baseline.md`](../adr/0022-current-protocol-baseline.md),
   [`../adr/0023-rolling-previous-project-compatibility.md`](../adr/0023-rolling-previous-project-compatibility.md),
   [`../adr/0024-device-protocol-and-compatibility-boundaries.md`](../adr/0024-device-protocol-and-compatibility-boundaries.md),
   [`../adr/0026-definition-level-cell-symbol-presentation.md`](../adr/0026-definition-level-cell-symbol-presentation.md),
   [`../adr/0027-stage-1-netlist-authoring-protocol.md`](../adr/0027-stage-1-netlist-authoring-protocol.md),
   and [`../adr/0029-external-subcircuit-definition-protocol.md`](../adr/0029-external-subcircuit-definition-protocol.md)
   — current Project shape, rolling previous-version read policy, independent
   device and compatibility boundaries, Port-symbol, edit-union, schema-15
   implementation target, and Agent credential contract; identify superseded
   clauses in older ADRs.
3. [`../adr/0011-retire-visio-vss-as-visual-authority.md`](../adr/0011-retire-visio-vss-as-visual-authority.md)
   and [`../specs/razavi-visual-contract.md`](../specs/razavi-visual-contract.md)
   — the Razavi raster is the sole visual authority.
4. [`../specs/schematic-model.md`](../specs/schematic-model.md),
   [`../specs/edit-engine.md`](../specs/edit-engine.md), and
   [`../specs/connectivity-and-routing.md`](../specs/connectivity-and-routing.md)
   — electrical and editing invariants.
5. [`../specs/editor-interaction.md`](../specs/editor-interaction.md),
   [`../specs/agent-api.md`](../specs/agent-api.md), and
   [`../specs/web-agent-session.md`](../specs/web-agent-session.md) — human
   and Agent entry points.
6. [`../agent/workflow.md`](../agent/workflow.md) — required Agent execution
   and visual review loop.

Read a targeted roadmap, plan, user guide, or archive item only when the
current task explicitly requires its history or acceptance evidence.

## Archive boundary

[`../archive/README.md`](../archive/README.md) contains historical records.
They are not authoritative and must not supply current implementation rules.
