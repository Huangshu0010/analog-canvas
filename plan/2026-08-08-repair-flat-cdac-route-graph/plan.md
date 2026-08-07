# Repair flat CDAC Route-graph generation

## Goal

Make Route-graph expansion atomic on conflicts, make the layout generator stop
before exporting an electrically/visually incomplete target when requested,
and generate a readable transistor-level flat 6-bit CDAC from the complete
flattened topology.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main [ahead 1]
 M apps/editor/src/App.tsx
 M apps/editor/src/styles.css
 M packages/render-svg/src/render.test.ts
?? apps/editor/src/current-arrow.test.ts
?? fixtures/projects/route-attached-current-arrow/
?? fixtures/visual-golden/route-attached-current-arrow.svg
?? plan/2026-08-07-editor-text-label-hit-fixes/
?? plan/2026-08-07-route-attached-current-arrow/
?? plan/2026-08-08-annotation-editing-and-ground-label/
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
```

The dirty editor/render paths belong to another target. They remain read-only.
The current target owns the Route-graph helper, generator, CDAC recipe and its
generated artifacts; none overlap the pre-existing dirty paths. The current
renderer build is a shared read-only dependency, so geometry/diagnostic checks
are authoritative while final visual inspection is recorded against the
available renderer.

## Owned Files

- `packages/agent-routing/src/types.ts`
- `packages/agent-routing/src/expand.ts`
- `packages/agent-routing/test/expand.test.ts`
- `tools/agent-layout/generate.mjs`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/agent-cdac-flat.mjs`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/agent-scdac-newarch.*`
- `plan/2026-08-08-repair-flat-cdac-route-graph/plan.md`
- `plan/log.md`

## Read-Only Files

- `apps/editor/**`
- `packages/render-svg/**`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/circuit.spi`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/codex-agent-cdac-flat.*`
- all unrelated dirty and untracked paths

## Shared Dependencies

- Model Route/Junction/Annotation schemas
- Agent transaction and visual-diagnostic contracts
- SPICE flattening and symbol endpoint resolution
- Razavi symbol geometry and formal export pipeline

## Expected Work

1. Make Route-graph expansion all-or-nothing and add an explicit non-dot bend
   node role.
2. Add an opt-in generator completeness gate that runs before persistence and
   export.
3. Replace the generic shape-based CDAC caller with explicit per-unit graphs
   built from every visible terminal in the flattened topology.
4. Generate and visually inspect the new Project/SVG/PNG/PDF.

## Validation

- `pnpm exec vitest run packages/agent-routing/test/expand.test.ts`
- `pnpm --filter @icm/agent-routing build`
- deterministic CDAC generation through `tools/agent-layout/generate.mjs`
- zero helper conflicts, visual errors, flightlines, symbol overlaps and
  wire-through-symbol diagnostics for the flat target
- structural assertions for all `b*`, `nb*`, `bot*`, VDD, VSS and VOUT Nets
- visual inspection of the generated PNG
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

These checks cover the changed atomic expansion contract, caller integration,
flattened electrical mapping and formal visual result. No simulation claim is
made; this target validates topology mapping and schematic presentation only.

## Experience Signal (for human review)

The previous target printed diagnostics but committed partial Route graphs and
recreated a shape compiler in the caller. This is a candidate lesson about
making planning-helper failures atomic and distinguishing logging from a real
Agent correction loop.

## Commit Intent

Commit as:

```text
fix(agent-routing): restore atomic flat CDAC generation
```

## Outcome

- Route-graph expansion is atomic: any conflict returns no edits, geometry,
  generated IDs or non-zero metrics.
- Explicit `bend` nodes remain transient and are folded into Route waypoints;
  only electrical branches and label anchors persist.
- The generator evaluates the committed candidate before writing artifacts and
  supports an opt-in completeness gate for visual errors, flightlines,
  crossings and selected warning codes.
- The CDAC caller no longer contains a shape compiler. It asserts exact visible
  endpoint coverage for every Net and gives explicit graphs for B, NB, BOT,
  VDD, VSS, VOUT and reset.
- Final flat target: 32 placed primitive instances, 22 Nets, 103 Routes, 40
  junctions (24 branch + 16 label-anchor), 63 annotations, zero flightlines,
  zero crossings, zero visual errors and zero visual warnings. Seven
  informational terminal-departure observations are the intentional common
  VOUT rail meeting capacitor pins.
- Compared with the first clean visual iteration, folding transient bends
  reduced persistence from 175 Routes / 112 junctions to 103 / 40 without
  changing the rendered schematic.
- No electrical simulation was run; the result is topology-mapping and visual
  presentation validation, not a performance or corner claim.

## Validation Record

- `pnpm exec vitest run packages/agent-routing/test/expand.test.ts`: 14 passed.
- `pnpm --filter @icm/agent-routing build`: passed.
- `pnpm typecheck`: passed.
- Prettier check on all owned source/plan files: passed.
- CDAC generator: passed its completeness gate and exported Project/SVG/PNG/PDF.
- Repeated generation produced identical SHA-256 hashes for all four artifacts.
- Structural audit: all visible Nets have one connected component; 0
  flightlines, 0 crossings, 0 non-info diagnostics.
- Generated PNG visually inspected at original resolution.
