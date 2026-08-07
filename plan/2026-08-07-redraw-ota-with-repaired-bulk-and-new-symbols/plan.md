# Redraw OTA with Repaired Bulk Semantics and Current Symbols

## Goal

Regenerate the SKY130 five-transistor-core OTA as a compact Razavi-style
schematic after confirming the hidden-bulk flightline repair. Use the current
runtime symbol work honestly: the reviewed VSS-derived NMOS asset, the
canonical four-terminal PMOS with its migrated three-terminal presentation
geometry, and preserved D/G/S/B connectivity.

## Dirty-State Decision

Start state is `main` at `ed6e878`. Four untracked `razavi-ota-5t-live.*`
artifacts belong to the previous Agent drawing. The user explicitly requested
a redraw, so this target may replace those generated artifacts. No unrelated
tracked files are dirty, and `lib/circuit.vss` remains read-only.

During generation, the separate RV-6B target materialized reviewed catalog
assets including PMOS4 and updated shared symbol registry files. Those paths
remain owned by `plan/2026-08-07-razavi-rv6b-reviewed-catalog-migration` and
are read-only here. This target rebuilt against that current runtime state and
does not stage, reformat, or otherwise modify the RV-6B files.

## Owner

Primary Agent (`/root`).

## Owned Files

- `plan/2026-08-07-redraw-ota-with-repaired-bulk-and-new-symbols/plan.md`
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-layout.mjs`
- generated `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-ota-5t-redrawn.*`
- this target's factual entry in `plan/log.md`

## Read-Only Files

- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/circuit.spi`
- `lib/circuit.vss`
- symbol catalog assets, resolver, renderer, importer, and connectivity code
- existing product and style specifications

## Shared Dependencies

- `ed6e878` hidden/implicit terminal visibility behavior
- `razavi-symbols@1` reviewed/provisional catalog boundary
- `razavi-textbook-v1` formal rendering profile
- typed layout recipe and Project validation/export pipeline

## Expected Work

1. Confirm the focused bulk-visibility and catalog tests pass.
2. Replace the stretched net-by-net layout with a compact canonical OTA
   skeleton: PMOS mirror above the NMOS differential pair, centered tail
   transistor, and a subordinate diode-connected bias replica.
3. Select the three-terminal presentation only after verifying every bulk Net
   is an explicit supply Net; retain all four-terminal electrical mappings.
4. Use short local mirror/diode connections, symmetric vertical signal paths,
   minimal Junctions, compact Ports, and no decorative title/caption.
5. Regenerate Project/SVG/PNG/PDF, prove zero visible flightlines and unchanged
   B/S Net membership, visually inspect the PNG, then import it into the editor.

## Validation

- focused derived/symbol/catalog tests
- `pnpm build`
- recipe generation through `tools/agent-layout/generate.mjs`
- Project assertions for symbol IDs/variants, bulk/source Nets, routes,
  flightlines, diagnostics, and generic fallbacks
- PNG visual inspection
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Keep the regenerated visual artifacts available for user review before a
dedicated commit decision.

## Outcome

- Confirmed the implicit-bulk repair through focused tests and regenerated the
  OTA with six reviewed catalog-backed `nmos`/`pmos` instances using the
  `textbook-3terminal` presentation only after checking every B terminal is on
  VDD or VSS.
- Preserved the important non-source-tied case: `XM1.B/XM2.B -> vss` while
  `XM1.S/XM2.S -> tail`.
- Replaced the stretched layout with a compact two-branch OTA core, centered
  tail device, and subordinate diode-connected 3:1 bias replica.
- Final Project has 6 instances, 8 Nets, 24 routes, 8 Junctions, 14
  annotations, zero flightlines, zero crossings, zero visual diagnostics,
  zero generic fallbacks, and a canonical serialization round-trip.
- Generated `razavi-ota-5t-redrawn.icproj.json/.svg/.png/.pdf`, visually
  inspected the PNG, imported the Project into the local editor, and fitted it
  to the current view.
- RV-6B symbol files and the shared maintenance log remained untouched because
  that concurrent target owns them.

## 2026-08-07 Visio MOS Regeneration

The user resumed this target after commit `4d7b66b` replaced procedural MOS
artwork with generated Visio-derived catalog assets. The new pin footprint
made several formerly straight recipe routes diagonal, and the edit engine
correctly rejected them. This resumed pass owns only the recipe's necessary
orthogonal waypoints and regenerated `razavi-ota-5t-redrawn.*` artifacts. It
does not change topology, placements, D/G/S/B membership, or variant policy.

The recipe was rebuilt and regenerated successfully after adding only the
required orthogonal escape waypoints. The resulting Project still contains 6
canonical MOS instances, 8 Nets, 24 routes, 8 Junctions, and 14 annotations.
Automated checks report zero visible flightlines, zero inter-Net crossings,
zero visual diagnostics, canonical serialization, and all eight asserted
bulk/source memberships unchanged. The regenerated PNG was visually inspected
with the Visio-derived MOS artwork and is ready for user review.

## 2026-08-07 Pin-Aligned Routing Correction

User review identified the repeated one-grid jogs around MOS drain/source
connections. Diagnosis confirmed that the Visio-derived MOS footprint changed
the channel pin offset from 20 to 10 and the vertical pin extent from 30 to 20,
while the recipe retained Junction and trunk coordinates chosen for the old
60-by-60 symbol. Electrical connectivity remained correct, but the layout was
no longer geometrically aligned.

This correction keeps the Visio symbol assets, topology, D/G/S/B membership,
variant policy, branch columns, and external Ports unchanged. It owns only the
six instance centers, route waypoints needed by the new 48-by-48 MOS footprint,
and regenerated `razavi-ota-5t-redrawn.*` artifacts. Other dirty editor, API,
model, routing, renderer, divide-by-two, documentation, and log paths belong to
concurrent work and remain untouched. Acceptance requires direct vertical
drain/source connections wherever the topology permits, intentional orthogonal
turns only for mirror/diode and shared-tail wiring, plus the existing semantic
and visual validation gates.

Correction outcome: all six MOS channel-pin columns now align at x=300/500 for
the OTA core and x=400/600 for the bias branch. Ten drain/source-to-Junction
routes are direct segments with no compensating waypoints. Project generation
and `pnpm build` pass; automated checks report eight unchanged bulk/source Net
memberships, zero visible flightlines, zero inter-Net crossings, zero visual
diagnostics, and canonical serialization. The regenerated PNG was visually
inspected. `plan/log.md` was not edited because the concurrent target still
owns its dirty state, and the review-before-commit intent remains in force.
