---
status: completed
experience: none
---

# Visio-Exact MOS Asset Generation

## Goal

Replace hand-authored MOS artwork with a deterministic VSS evidence-to-Symbol
DSL generation path for `NMOS4`, `PMOS4`, `Nmos3.a`, and `Pmos3.a`. Preserve
reviewed/provisional electrical pin contracts separately from visual geometry,
and add independent Visio-source-versus-runtime comparison evidence so a
runtime self-render can no longer stand in for fidelity proof.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main [ahead 1]
 M docs/README.md
 M netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-layout.mjs
?? docs/architecture-and-pipeline-review.md
?? netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-ota-5t-*.{icproj.json,pdf,png,svg}
?? plan/2026-08-07-redraw-ota-with-repaired-bulk-and-new-symbols/
```

`main` is ahead because concurrent OTA work committed `7c6b2cb` on top of the
catalog commit. The listed tracked/untracked paths belong to that concurrent
architecture/OTA work and do not overlap this target. They remain untouched
and unstaged. `plan/log.md` is currently clean and may receive only this
target's factual entry.

A later status check showed additional concurrent work in
`tools/agent-layout/`, `plan/2026-08-07-refine-and-flatten-divide-by-2/`, and
the OTA recipe/artifacts, with the branch now ahead by two commits. Those paths
also remain outside this target. None overlaps the MOS generator, symbol
catalog, renderer, or owned visual fixtures.

The same check later found concurrent `packages/derived` edits for joining
separated Junction stubs by matching labels. Read-only diff inspection showed
that they do not change symbol resolution, hidden-pin filtering, or the MOS
asset contract. They remain unstaged; whole-suite validation may exercise them
as ambient worktree state, while focused MOS gates establish this target's own
result.

## Owned Files

- `tools/vss-import/` converter/export/check code added or directly extended for this target
- `scripts/generate-visio-mos-assets.mjs`
- root `package.json` script entries for deterministic generation/checking
- `packages/symbols/assets/razavi-v1/{nmos,nmos3,pmos,pmos3}.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/builtins.ts`
- `packages/symbols/src/schema.ts` and generated schema expectations needed for
  fill-only Visio arrowheads
- focused symbol/catalog tests
- `packages/render-svg/src/` primitive/style handling and focused tests
- `tools/symbol-review/render-reviewed.mjs`
- dedicated MOS visual comparison fixtures under `fixtures/visual-golden/`
- Phase 1/5 visual goldens and the Phase 5 fixture's route waypoints needed to
  keep the intentional MOS pin-footprint change orthogonal
- Phase 7 SVG/PNG/PDF export goldens and manifest derived from that same owned
  Phase 5 fixture
- Razavi/Symbol DSL/VSS import documentation directly describing this pipeline
- `plan/2026-08-07-visio-exact-mos-generation/plan.md`
- this target's entry in `plan/log.md`

## Read-Only Files

- `lib/circuit.vss` (binary; open hidden/read-only through Visio only)
- existing VSS inventory, review manifest, and RV-1/RV-6A Master IR evidence
- concurrent architecture and OTA recipe/output paths
- SPICE parser, Document/Net connectivity, and OTA electrical fixture

## Shared Dependencies

- Visio COM availability and deterministic page/master export behavior
- VssMasterIR transform, geometry-row, line/fill, and arrow metadata
- Symbol DSL primitive/style schema and 10-unit electrical pin grid
- reviewed D/G/S/B and provisional D/G/S pin order manifest
- generated Razavi catalog adapter and built-in resolver identity
- renderer transform, fill, stroke, and visual golden behavior

## Expected Work

1. Export isolated MOS Masters through Visio COM to temporary/source-reference
   SVGs without changing `circuit.vss`, and characterize exact group transforms,
   line weights, flips, and Arrow Type 13 output.
2. Implement a deterministic converter that flattens VssMasterIR geometry and
   arrow semantics into generated Symbol DSL; keep electrical pins supplied
   only by the review manifest.
3. Generate canonical four-terminal NMOS/PMOS plus provisional three-terminal
   NMOS/PMOS assets, eliminate exposed procedural MOS artwork, and keep all
   three-terminal automatic mappings disabled.
4. Add independent source/runtime SVG comparison fixtures and checks with a
   fixed coordinate normalization. Document which equality is vector-exact
   and which raster differences remain renderer-dependent.
5. Run focused MOS/catalog/render validation followed by shared workspace,
   visual, and export gates.

## Validation

- deterministic VSS MOS asset regeneration and `--check`
- Visio isolated-Master reference regeneration/check when COM is available
- focused MOS transform, arrow, catalog, and renderer tests
- `pnpm symbols:razavi:check`
- `pnpm symbols:review:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm visual:phase5:check`
- `pnpm export:phase7:check`
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`

The target changes shared symbol geometry and renderer-visible assets, so both
focused conversion assertions and existing cross-workspace visual/export
compatibility gates are required. A changed golden is accepted only when the
independent Visio comparison demonstrates the intended source-faithful change.

## Experience Signal (for human review)

Possible signal: a source-provenance manifest and a runtime self-render do not
establish visual fidelity without an independent source-derived comparison.
No lesson is extracted unless the human requests it.

## Commit Intent

Commit as:

```text
feat(symbols): generate MOS artwork from Visio evidence
```

## Outcome

- Added deterministic, read-only Visio reference export and checked four
  normalized source SVGs for `NMOS4`, `PMOS4`, `Nmos3.a`, and `Pmos3.a`.
- Added Master-IR-to-Symbol-DSL generation with exact finite-decimal intrinsic
  geometry, 1.2/2.16 point stroke roles, and decoded Arrow Type 13 heads.
- Preserved the 10-unit electrical grid by changing only the external pin-lead
  endpoint along its own axis; the independent overlay exposes this deliberate
  exception.
- Replaced procedural runtime MOS artwork with catalog assets; `nmos3` and
  `pmos3` remain provisional with no automatic mappings. Four-terminal
  D/G/S/B semantics and visual-only bulk hiding remain unchanged.
- Updated visual/export goldens and the Phase 5 route waypoints after visual
  inspection confirmed orthogonal wires and source-faithful MOS rendering.
- Validation completed as planned: four-reference COM check, deterministic MOS
  and catalog checks, symbol-review and Phase 1/5 checks, 155 tests in 37 files,
  typecheck, build, Phase 7 export check, formatting, and whitespace checks.
