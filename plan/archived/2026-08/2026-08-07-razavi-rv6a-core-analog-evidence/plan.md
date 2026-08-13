---
status: completed
experience: none
---

# Razavi RV-6A Core Analog VSS Evidence

## Goal

Create deterministic structured VSS evidence for every reviewed or provisional
Batch A/B analog Master before migrating more runtime assets. Record geometry,
groups, transforms, presentation, text, connection points, and decoder
diagnostics without changing pin semantics or runtime symbol selection.

## Dirty-State Note

Start state: `main` at pushed RV-5 commit `3a16045`; only the five untracked,
user-confirmed parallel OTA `razavi-*` files remain. They are outside this
target and do not overlap VSS tooling, symbol evidence, documentation, or logs.

## Owner

Primary Agent (`/root`).

## Owned Files

- `plan/2026-08-07-razavi-rv6a-core-analog-evidence/plan.md`
- `fixtures/symbols/vss-ir/razavi-rv6-core-analog-master-ir.json`
- `tools/vss-import/Test-VssCoreAnalogIr.ps1`
- `tools/vss-import/README.md`
- `docs/specs/vss-development-import.md`
- `docs/specs/razavi-textbook-style.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- `fixtures/symbols/circuit-vss-review.json`
- RV-1 evidence and checker
- Symbol DSL assets, catalog, built-ins, and SPICE mappings
- editor and renderer code
- concurrent OTA `razavi-*` files

## Shared Dependencies

- pinned stencil SHA-256 and 101-Master source inventory
- reviewed and provisional pin decisions in the VSS review manifest
- VssMasterIR decoder identity/version
- future RV-6 catalog conversion and provenance checks

## Expected Work

1. Extract the union of all 12 reviewed mappings, all 13 provisional migration
   candidates, and semantic `node`/`Arrow` Masters with the existing read-only
   COM decoder.
2. Keep target ordering deterministic and include no coverage-only Master.
3. Add a checker that re-extracts, compares SHA-256, validates source identity,
   exact target set, unique Master records, review-manifest coverage, and
   diagnostics.
4. Record observed geometry kinds and unsupported/runtime-blocking evidence
   honestly; do not infer electrical pins from connection points.
5. Document the distinction between RV-1 decoder proof and RV-6 core-analog
   migration evidence.

## Validation

- `powershell -File tools/vss-import/Test-VssCoreAnalogIr.ps1`
- RV-1 checker remains passing
- fixture JSON parse and deterministic hash
- `pnpm typecheck`
- `pnpm test`
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`

The target changes generated evidence and PowerShell checks, not runtime
behavior, so renderer/export goldens are not required.

## Experience Signal (for human review)

None identified. Keeping the decoder proof and migration corpus as separate
fixtures follows the already frozen evidence/runtime boundary.

## Outcome

- Captured 27 core-analog Masters in a dedicated RV-6 evidence fixture:
  12 reviewed mappings, 13 provisional candidates, and semantic
  `node`/`Arrow` Masters.
- Evidence contains 175 nested Shapes, 504 geometry rows, 45 connection
  points, five supported geometry kinds, and zero decoder diagnostics.
- Added deterministic full-file re-extraction, exact target/review coverage,
  structural-count, geometry-kind, and diagnostic gates.
- RV-6 fixture SHA-256 is
  `2db676bddbd0ac93dba64972eec15c40b2143161ec05c75cfe4cc467595584c0`;
  the independent RV-1 fixture remains unchanged and passed its checker.
- Validation passed: RV-6 and RV-1 PowerShell checks, 150 tests in 36 files,
  typecheck, formatting, and `git diff --check`.
- No runtime catalog, pin order, palette, or SPICE mapping changed. Concurrent
  OTA `razavi-*` files remained untracked and untouched.

## Commit Intent

Commit as:

```text
chore(symbols): capture core analog VSS evidence
```
