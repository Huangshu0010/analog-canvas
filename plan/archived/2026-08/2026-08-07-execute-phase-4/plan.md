# Execute Phase 4 Full SPICE Baseline

## Goal

Complete the Phase 4 exit gate with an explicit SPICE3/ngspice structural
compatibility baseline, lossless parse/print behavior, broad device and
directive projections, expression and preprocessing structure, dialect
evidence, recoverable vendor extensions, and deterministic coverage evidence.

This is the fifth bounded target under the active Phase 0-7 goal.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean at Phase 3 commit `105915a`.

## Owned Files

- Phase 4 extensions under `packages/spice/`
- new machine-readable compatibility and minimized corpus fixtures under
  `fixtures/spice-baseline/`
- narrowly required test/build configuration
- accepted Phase 4 baseline ADR and compatible updates to
  `docs/specs/spice-frontend.md` and `docs/specs/circuit-ir.md`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-4-full-spice-baseline.md`
- `plan/2026-08-07-execute-phase-4/`
- `plan/log.md`

## Read-Only Files

- Project/Document, Edit Engine, connectivity, and renderer contracts
- editor behavior unless a deterministic import acceptance gap requires a
  narrowly scoped integration change
- Phase 0-3 and Phase 5-7 implementation areas
- `lib/circuit.vss`, current `netlists/`, and `.reference-src/`
- previous-converter automatic layout, routing, Page Scene, rendering, and
  publishing/workflow code

## Shared Dependencies

- Exact source text and physical/logical spans remain authoritative and
  round-trip without reconstruction.
- Structural parsing does not imply simulation, numeric model evaluation, or
  execution of `.control` content.
- Unknown and vendor-specific statements remain recoverable opaque records
  with compatibility diagnostics.
- Dialect selection is explicit or evidence-based and never changes Project
  persistence boundaries.
- Circuit IR remains transient and contains connectivity/structure only.

## Expected Work

1. Select and cite an official SPICE3/ngspice baseline and accept a versioned
   compatibility contract plus machine-readable matrix.
2. Add lossless printer and no-silent-loss accounting for every logical source
   statement, including comments, control blocks, unknown statements, and
   newline conventions.
3. Add typed structural projections for baseline device families and major
   directives while retaining raw tails and source spans.
4. Add expression token/shape validation, numeric suffix recognition,
   parameter/function declarations, conditionals, `.lib` sections, global
   nodes, and control-block boundaries without executing them.
5. Add deterministic dialect evidence and explicit override.
6. Expand Circuit IR terminal mapping for every accepted schematic-producing
   device family and preserve non-schematic statements outside persisted
   Documents.
7. Add minimized original fixtures, compatibility coverage, round-trip,
   property/fuzz, termination, and recovery tests.
8. Run the complete Phase 4 exit gate and record limitations honestly.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- compatibility-matrix completeness tests
- exact source round-trip and no-silent-loss tests
- expression, preprocessing, device, directive, dialect, and control tests
- Circuit IR terminal/connectivity goldens
- bounded deterministic fuzz/property tests
- existing current-corpus regression tests
- `pnpm test`
- `pnpm build`
- Markdown relative-link and fence checks
- product/reference coupling inspection
- `git diff --check`
- `git status --short --branch`

Phase 4 changes the source frontend and transient IR used by every importer, so
focused validation is followed by all workspace gates.

## Experience Signal (for human review)

None at target start. No experience note will be extracted automatically.

## Commit Intent

Commit as:

```text
Complete Phase 4 full SPICE baseline
```

## Outcome

- Accepted `ngspice-46-core` against the official version 46 manual and added
  a machine-readable compatibility matrix with explicit excluded execution
  surfaces.
- Expanded the lossless frontend with conventional B-Z device structure,
  official dot commands, `.lib` sections, functions, conditionals, control
  blocks, dialect evidence, scale factors, and exact source printing.
- Expanded transient Circuit IR with typed preserved non-schematic statements
  and prevented zero-terminal structural records from becoming unusable canvas
  symbols.
- Added minimized original baseline/vendor fixtures, 256 deterministic fuzz
  samples, and complete current-corpus regression evidence.

No simulator, control execution, vendor translator, or previous-converter
layout/routing/rendering implementation entered the product runtime.
