# Refine and Flatten the SKY130 Divide-by-Two

## Goal

Refine the existing hierarchical top-level schematic and add a genuinely flat,
single-Document transistor view derived recursively from the original SPICE
hierarchy. Preserve canonical instance, pin, and Net identity throughout.

## Dirty-State Note

The branch starts two commits ahead of `origin/main`. Existing dirty OTA,
symbol-review, renderer, symbol-schema, documentation, and visual-reference
paths belong to other work. This target does not edit or stage them. The dirty
symbol schema is a shared dependency, so this target uses the already-built
runtime and avoids a workspace-wide build.

## Owned Files

- `plan/2026-08-07-refine-and-flatten-divide-by-2/plan.md`
- `tools/agent-layout/generate.mjs`
- `tools/agent-layout/flatten-project.mjs`
- `tools/agent-layout/check-flatten-project.mjs`
- `packages/derived/src/connectivity.ts`
- `packages/derived/src/derived.test.ts`
- `netlists/sky130-transistor-divide-by-2/agent-layout.mjs`
- `netlists/sky130-transistor-divide-by-2/agent-divide-by-2.*`
- `netlists/sky130-transistor-divide-by-2/flat-layout.mjs`
- `netlists/sky130-transistor-divide-by-2/agent-divide-by-2-flat.*`
- `plan/log.md` for the factual completion entry only

## Read-Only Files

- `netlists/sky130-transistor-divide-by-2/circuit.spi`
- current model, SPICE, symbol, edit-engine, derived, and exporter runtimes
- unrelated dirty paths reported by the start-state audit

## Shared Dependencies

- canonical Project/Document schema and stable IDs
- SPICE positional subcircuit-port binding
- typed transactions and formal export pipeline
- presentation-only hidden bulk and implicit hierarchical supply variants
- electrically connected same-Net junction labels

## Expected Work

1. Add an optional pre-layout Project hook to the existing headless generator.
2. Implement and test deterministic recursive hierarchy flattening.
3. Refine the hierarchical functional view to reduce unnecessary crossings.
4. Add deterministic same-Net junction-label connectivity for long and global
   Nets that should not be drawn as one continuous physical wire.
5. Generate a transistor-level flat view with 29 MOS devices and one capacitor.
6. Validate topology equivalence, routing closure, diagnostics, and both PNGs.

## Validation

- Focused recursive-flattener assertion script against this source fixture.
- Both headless recipes generate canonical Projects and exports.
- Hierarchical source remains seven Documents; flat target contains no
  hierarchical instances and has the expected 30 primitive instances.
- Assert top-level port Nets and selected deep internal connectivity.
- Inspect flightlines, crossings, visual diagnostics, and both PNGs.
- `git diff --check`
- `git status --short --branch`

## Experience Signal (for human review)

## Commit Intent

```text
feat(agent-layout): add refined and flat divider views
```

## Outcome

- Added an optional pre-layout Project hook and a deterministic recursive
  flattener with a fixture assertion script.
- The flattened top Document contains exactly 30 primitives: 15 NMOS, 14 PMOS,
  and one capacitor; it contains no hierarchical instance and retains all 16
  expected Nets with prefixed deep internal names.
- Added same-Net, same-text electrical junction-label connectivity. It changes
  visible routing closure only; canonical Net membership remains the source of
  electrical truth.
- Refined hierarchical output: 7 Documents, 8 placed top instances, 24 Routes,
  10 Junctions, 17 annotations, 0 flightlines, 3 inter-Net crossings, and 0
  visual diagnostics.
- Flat output: 8 Documents including the derived flat top, 30 placed primitive
  instances, 16 Nets, 104 Routes, 77 Junctions, 99 annotations, 0 flightlines,
  7 inter-Net crossings, and 0 visual diagnostics.
- Both final PNGs were inspected with the current reviewed MOS runtime. The
  original `circuit.spi` was not modified.
