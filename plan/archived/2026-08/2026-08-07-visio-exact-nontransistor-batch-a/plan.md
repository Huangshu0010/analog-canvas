---
status: completed
experience: none
---

# Visio-Exact Non-Transistor Batch A

## Goal

Replace the normalized runtime artwork for the eight high-frequency
non-transistor symbols (`R`, `C`, `L`, `Diode1`, `GND`, `I/O`, `DC-V`, and
`DC-I`) with deterministic, source-derived Symbol DSL assets. Each asset must
retain its reviewed electrical pin contract while deriving visual geometry from
the checked VSS Master IR and being compared against an independent read-only
Visio SVG export.

## Dirty-State Note

The worktree contains concurrent dirty editor, Agent API, model, edit-engine,
renderer, documentation, divide-by-two, OTA recipe, generated OTA artifact,
and maintenance-log work. The user confirmed that the other changes do not
block this target. This target does not edit those paths; it treats the model,
renderer, and catalog runtime adapter as shared read-only dependencies. The
target begins from `main...origin/main` with the existing untracked OTA review
artifacts and plan preserved.

## Owned Files

- `plan/2026-08-07-visio-exact-nontransistor-batch-a/plan.md`
- `tools/vss-import/Export-VisioCoreAnalogReferences.ps1`
- `scripts/generate-visio-core-analog-assets.mjs`
- `scripts/generate-razavi-symbol-catalog.mjs`
- `package.json` entries for the focused generation and reference checks
- `packages/symbols/assets/razavi-v1/{resistor,capacitor,inductor,diode,ground,port,current-source,voltage-source}.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- generated `packages/symbols/src/razavi-catalog.generated.ts`
- focused catalog/generator tests under `packages/symbols/src/`
- checked Visio comparison SVGs under `fixtures/visual-reference/visio-core-analog/`
- `fixtures/visual-golden/visio-core-analog-fidelity.svg`
- regenerated reviewed-symbol visual board `fixtures/visual-golden/phase-5-symbol-review.svg`
- regenerated formal render golden `fixtures/visual-golden/phase-1-manual.svg`
- regenerated candidate-symbol visual board `fixtures/visual-golden/vss-migration-candidates.svg`
- `tools/vss-import/README.md`
- `packages/symbols/assets/razavi-v1/README.md`

## Read-Only Files

- `lib/circuit.vss` (binary source, opened only through read-only Visio COM)
- `fixtures/symbols/circuit-vss-review.json`
- `fixtures/symbols/vss-ir/razavi-rv6-core-analog-master-ir.json`
- current MOS generator and MOS reference evidence
- all concurrent dirty paths, including `plan/log.md`

## Shared Dependencies

- human-reviewed pin names/order in the VSS review manifest
- Symbol DSL grid-anchor and primitive schema
- `razavi-textbook-v1` semantic stroke tokens
- deterministic catalog adapter generation
- existing isolated Visio COM export and source-hash policy

## Expected Work

1. Add a read-only isolated Visio exporter for the eight reviewed Batch A
   Masters, with normalized deterministic SVG output and check mode.
2. Add a deterministic Master-IR-to-Symbol-DSL generator that rejects geometry
   or style it cannot faithfully preserve, permits only axial external-lead
   adjustment to reach the 10-unit pin grid, and uses the reviewed pin manifest
   rather than inferred electrical semantics.
3. Regenerate the eight catalog assets, hashes, and runtime adapter; produce an
   independent source/runtime/overlay comparison board.
4. Add focused checks for source mapping, grid pin anchors, deterministic output,
   and the Batch A comparison artifacts; visually inspect the rendered board.

## Validation

- isolated Visio reference generation/check for all eight Masters
- Batch A asset generator/check and catalog adapter check
- focused Symbol DSL/catalog tests plus `pnpm build`
- direct assertions for reviewed pin order, grid anchors, and source-derived
  primitives; 4x source/runtime comparison board inspection
- `git diff --check` and `git status --short --branch`

The geometry source, pin contract, generated runtime asset, and visual output
all change together, so deterministic generator checks plus focused catalog
tests and a workspace build are proportionate.

## Experience Signal (for human review)

The MOS-specific generator may reveal a reusable general Master-IR conversion
layer. Do not extract an experience note unless the human requests it after
reviewing the completed evidence.

## Commit Intent

Committed independently on 2026-08-08 as part of a worktree-split sequence
(group 1 — visio-core-analog catalog migration). The earlier "keep available
for visual review before deciding" hold was lifted by the user's explicit
instruction to split the dirty worktree into self-contained groups; this
target landed first because it is self-contained with no cross-package source
coupling to the editor/model/renderer changes held in other groups.

## Outcome

- Added a deterministic, read-only Visio exporter and checked independent SVG
  evidence for `R`, `C`, `L`, `Diode1`, `GND`, `I/O`, `DC-V`, and `DC-I`.
- Added a Master-IR asset generator that preserves supported lines, circles,
  source arrowheads, line-cap/stroke roles, and sampled Visio
  `EllipticalArcTo` paths; it fails closed on unsupported source geometry.
- Replaced the eight normalized runtime assets with source-derived geometry,
  preserved the reviewed pin names/order, snapped only external terminal-lead
  endpoints to the grid, and recorded per-asset generator/reference provenance
  in the catalog.
- Regenerated the runtime catalog, formal render golden, and reviewed/candidate
  palette boards. The candidate board also refreshed an already-stale LED
  preview from the current candidate asset; no candidate asset or pin contract
  changed in this target.
- Visually inspected the reviewed palette board. The eight isolated reference
  checks, asset generator check, catalog check, symbol review check, visual
  golden check, focused catalog test, renderer test, and workspace build pass.
- The full test suite has three remaining failures in dirty concurrent paths:
  `packages/edit-engine/src/authoring.test.ts`,
  `apps/editor/src/clipboard.test.ts`, and
  `apps/editor/src/delete-selection.test.ts`. The render golden failure caused
  by this target was fixed; no target-owned test remains failing.
- `plan/log.md` remains untouched because it is concurrently dirty. The target
  remained uncommitted pending visual review until the 2026-08-08 worktree-split
  sequence (see Commit Intent above); it then landed as group 1.

## Compatibility Finding

A read-only differential scan of tracked project documents against the prior
eight runtime assets found newly diagonal wire segments in existing RLC,
6-bit CDAC, and divide-by-two layouts when these source-faithful default
symbols are used. The electrical pin contracts are unchanged; the effect comes
from deliberately adopting the VSS Masters' true default orientations and
external pin geometry. The deliberately invalid missing-top fixture was
excluded. No existing circuit layout, recipe, or generated artifact was
rewritten in this asset target: adapting those diagrams is a separate
compatibility re-layout target requiring review of each affected composition.
