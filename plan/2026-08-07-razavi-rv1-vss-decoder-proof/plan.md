# Razavi RV-1 VSS Decoder Proof

## Goal

Build a deterministic, read-only Visio ShapeSheet decoder proof for `NMOS4`,
`Pmos3.a`, `R`, `DC-V`, and `node`. The proof must preserve grouped transforms,
geometry rows, style cells, text metadata, and connection points as structured
evidence suitable for later normalized Symbol DSL generation; it must not infer
electrical pin semantics or make Visio a runtime dependency.

## Dirty-State Note

Start state: `main` at pushed commit `2381e0c`, with only five untracked
`netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-*` files. The user
confirmed that this parallel work will not affect the current target. Those
files are outside this target, remain untouched, and do not alter the VSS
source, decoder, fixtures, or symbol contracts owned here.

## Owned Files

- `plan/2026-08-07-razavi-rv1-vss-decoder-proof/plan.md`
- `tools/vss-import/Export-VssMasterIr.ps1`
- `tools/vss-import/README.md`
- `fixtures/symbols/vss-ir/razavi-rv1-master-ir.json`
- focused decoder validation scripts/tests added under `tools/vss-import/`
- `package.json` only if a deterministic RV-1 check command is added
- `docs/specs/razavi-textbook-style.md` only for factual decoder-contract
  clarification discovered during implementation
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- `fixtures/symbols/circuit-vss-review.json`
- `fixtures/symbols/circuit-vss-inventory.json`
- `packages/symbols/**`
- `apps/editor/**`
- `packages/render-svg/**`
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-*`

## Shared Dependencies

- reviewed stencil SHA-256 and 101-Master inventory
- Visio COM read-only development boundary
- Symbol DSL connection-grid and electrical pin-order invariants
- `razavi-textbook-v1` catalog/provenance contract

## Expected Work

1. Probe the five target Masters through read-only Visio COM and enumerate the
   ShapeSheet sections/cells actually present.
2. Define a versioned `VssMasterIR` JSON envelope with source identity,
   decoder identity, diagnostics, nested shapes, transforms, geometry,
   connection points, text, and semantic style evidence.
3. Implement deterministic extraction without electrical-pin inference or
   raw VSS mutation.
4. Generate and check in the five-Master RV-1 evidence fixture.
5. Add a deterministic checker for source identity, target coverage,
   supported row/style capture, stable ordering, and absence of silent
   unsupported constructs.
6. Document exact invocation, limitations, and the boundary to RV-2 catalog
   normalization.

## Validation

- run the extractor twice and compare hashes
- decoder checker passes all five target Masters
- source SHA-256 and total Master count match the reviewed inventory
- focused JSON/schema/semantic assertions for groups, lines, circles/arcs,
  arrows, text, connection points, and line weights when present
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm test`
- `git diff --check`
- `git status --short --branch`

The decoder is a new asset-generation boundary consumed by all later Razavi
symbol work, so deterministic full workspace contracts are included after the
focused checks.

## Experience Signal (for human review)


## Outcome

- Added a read-only, hash-pinned `VssMasterIR` decoder with explicit Visio row
  semantics, formulas and evaluated internal-unit values, nested transforms,
  line/fill styles, arrows, connection points, and text formatting. Unknown
  geometry row types produce blocking diagnostics.
- Generated the RV-1 evidence fixture for the five target Masters plus `TEXT`
  as a coverage-only Master because the target five have no text runs.
- Deterministic re-extraction matched the fixture SHA-256
  `826c2ba82532de17686dae61ac1bd6c93fbe4b946d2bb60797ad726b23a94170`.
  Coverage includes 6 Masters, 32 Shapes, 93 geometry rows, 11 connection
  points, 2 arrow-bearing Shapes, 1 text Shape, and the three observed line
  weights `0.01`, `0.016666667`, and `0.03` Visio internal inches.
- Exported all five target Masters directly from a read-only Visio session to
  temporary SVG/PNG and visually confirmed NMOS4, Pmos3.a, resistor, DC
  voltage-source, and filled node-dot appearance. Temporary exports were not
  added to the repository.
- The focused decoder check, formatting, typecheck, 127 unit tests in 33 files,
  and `git diff --check` passed. `lib/circuit.vss` remained unchanged and the
  concurrent OTA `razavi-*` files remained untouched.

## Commit Intent

Commit as:

```text
feat(vss): add structured Razavi master decoder proof
```
