---
status: completed
experience: none
---

# Add the remaining common Razavi symbol families

## Goal

Complete all seven requested Razavi-common areas: NPN/PNP, dependent current
source, diode, voltage-gain block, ideal switch, transformer/coupled inductor,
and a verified composable BJT small-signal model using the resulting primitives.
Use native textbook PDF vector evidence wherever it can be identified and keep
the existing extraction/generation/fidelity boundaries.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
 M apps/editor/e2e/manual-editor.spec.ts
 M apps/editor/src/app/App.tsx
 M docs/specs/connectivity-and-routing.md
 M docs/specs/edit-engine.md
 M docs/specs/editor-interaction.md
 M packages/edit-engine/src/routing.test.ts
 M packages/edit-engine/src/transaction.ts
?? plan/2026-08-11-fix-partial-spice-wire-delete/
```

Those paths belong to another routing/editor target. They do not overlap this
target's symbol catalog, PDF evidence, SPICE importer, visual contract, or
fixtures, so they are left untouched. This target owns:

- `tools/pdf-vector-extract/` additions for the requested families
- `scripts/generate-razavi-common-assets.mjs`
- `scripts/razavi-fidelity-diff.mjs` (allow a registry entry to select its
  own manifest-pinned PDF witness)
- `packages/symbols/assets/razavi-v1/` new family assets and `catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `packages/symbols/src/builtins.test.ts`
- `apps/editor/src/features/component-insert/symbol-catalog.ts`
- `apps/editor/src/features/component-insert/symbol-catalog.test.ts`
- `packages/spice/src/importer.ts`
- `packages/spice/src/compiler.test.ts`
- `fixtures/visual-reference/razavi-reference-v1/` new evidence,
  measurements, manifest entries, and fidelity targets
- `fixtures/projects/` or `netlists/` one BJT small-signal composition fixture
- `docs/specs/razavi-visual-contract.md`
- `docs/adr/0012-pdf-vector-evidence-for-razavi-assets.md`
- `package.json`
- `.gitignore` (ignore generated PDF-extractor bytecode and this fidelity
  report directory)
- `plan/2026-08-11-razavi-common-symbols/plan.md`
- `plan/log.md`

Read-only inputs and shared dependencies:

- `C:/Users/90590/Desktop/[Razavi] Design of Analog CMOS Integrated Circuits 2nd Edition.pdf`
- Existing reviewed Razavi symbols and their evidence remain unchanged.
- The dirty routing/editor target listed above is read-only and unrelated.
- Symbol DSL and Project schema remain unchanged unless a discovered source
  proves that a required electrical contract cannot be represented.

## Work

1. Locate native textbook objects for each requested family and record page,
   figure, object fingerprints, extraction limitations, and raster witnesses.
2. Generate reviewed Symbols with explicit on-grid pins and semantic stroke
   roles; share body geometry across NPN/PNP and stateful switch variants.
3. Register GUI categories and only the SPICE mappings whose electrical
   terminal contracts are exact.
4. Add a BJT small-signal composition fixture using resistor/capacitor and the
   dependent-current-source primitive instead of inventing pseudo-components.
5. Validate every evidence pin, generator, catalog entry, mapping, render, and
   composition before closing the seven-item goal.

## Validation

- Source PDF SHA-256 and per-family object-fingerprint checks.
- Extraction reproduction and manifest tamper/integrity checks.
- Family generator write and stale-check modes.
- Focused Symbol, catalog, editor, SPICE, and composition tests.
- Affected package/editor builds and repository typecheck.
- Registered fidelity diff for every new visual family and variant.
- Changed-file formatting, `git diff --check`, and final clean status.

## Commit Intent

Commit as one shared visual-contract target only if all families validate:

```text
feat(symbols): add common Razavi device families
```

## Outcome

Completed all seven requested areas. The reviewed palette now contains NPN,
PNP, diode, four-terminal VCCS, a single-ended voltage amplifier, a
two-terminal ideal switch, and a four-terminal coupled-inductor/transformer.
Direct, sibling-derived, and composite PDF evidence are explicitly identified.
SPICE import maps only exact `D`, three-node `Q`, and `G` contracts; `S`, `K`,
and the implicit-reference gain block remain manual. The hybrid-pi fixture
proves `r_pi`, `r_o`, `C_pi`, `C_mu`, and `g_m v_be` composition without a
pseudo-device.

Validation passed: PDF hash/object extraction and manifest integrity, both
generator stale checks, 64 affected Symbol/SPICE/editor tests plus 37 focused
authority tests, repository typecheck, Symbol/SPICE/editor builds, targeted
formatting, and `git diff --check`. All seven registered fidelity targets ran
against their own manifest-pinned witnesses; IoU ranged from `0.5768` to
`0.7601`, with 100% edge-shell and anti-alias verdicts. Repository-wide
Prettier still reports the pre-existing untouched
`packages/derived/src/connectivity.ts`; all target-owned formatted files pass.
