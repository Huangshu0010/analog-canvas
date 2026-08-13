---
status: completed
experience: none
---

# Hidden MOS Terminal Correctness

## Goal

Fix the three-terminal MOS display contract without changing four-terminal
electrical truth: hidden/implicit terminals must not participate in visible
connectivity or flightlines, while D/G/S/B Net membership and SPICE round-trip
remain intact. Remove the OTA recipe's unconditional variant override and fix
the adjacent Razavi text/power-label defects exposed by current rendering.

## Dirty-State Note

Start state: `main` at pushed RV-6A commit `281e6cd`. Five untracked OTA
`razavi-*` files belong to the previously acknowledged parallel workflow. The
user has now explicitly requested the discussed OTA/variant corrections, so
this target claims only `razavi-layout.mjs`; the generated Project/SVG/PNG/PDF
remain read-only and untracked until a validated regeneration step is chosen.

## Owner

Primary Agent (`/root`).

## Owned Files

- `plan/2026-08-07-hidden-mos-terminal-correctness/plan.md`
- `packages/derived/src/endpoint.ts`
- `packages/derived/src/connectivity.ts`
- `packages/derived/src/derived.test.ts`
- `apps/editor/src/App.tsx`
- `packages/render-svg/src/schematic-text.ts`
- `packages/render-svg/src/schematic-text.test.ts`
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-layout.mjs`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/symbol-dsl.md`
- `plan/log.md`

## Read-Only Files

- SPICE parser/import electrical mapping and source netlist
- Project schema and D/G/S/B Net representation
- existing Symbol DSL assets/catalog and `lib/circuit.vss`
- generated OTA Project/SVG/PNG/PDF from the parallel workflow
- existing visual/export goldens

## Shared Dependencies

- `SymbolVariant.hiddenPinNames` compatibility behavior
- base pin `presentation.visibility`
- endpoint resolution, visible connectivity, and editor flightlines
- Agent snapshot's distinction between electrical pins and visible pins
- Razavi schematic-math output

## Expected Work

1. Add one shared endpoint-visibility predicate: Ports/Junctions are visible;
   a terminal is hidden when its variant hides the pin or its base visibility
   is `implicit`; unresolved `conditional` pins remain visible for safety.
2. Filter visible-connectivity components before flightline MST derivation,
   without mutating Nets, routes, terminal order, or endpoint geometry.
3. Add a MOS regression proving an implicit B creates no flightline while B
   remains on VSS and S remains on tail; prove four-terminal display still
   exposes an unrouted B.
4. Remove the recipe's unconditional `textbook-3terminal` assignment, repair
   UTF-8 minus/project text, and attach VDD/VSS labels to their Port IDs.
5. Reset schematic-math suffix baseline explicitly so `VIN+`/`VIN-` signs are
   upright on the normal baseline.
6. Document the presentation/electrical boundary and defer context-dependent
   bulk auto-selection to a separate Net-classification target.

## Validation

- focused derived and schematic-text tests
- OTA recipe syntax/import check
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm visual:phase5:check`
- `pnpm export:phase7:check`
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`

The shared connectivity path and renderer text composition require the full
suite and compatibility goldens.

## Experience Signal (for human review)

Possible future signal: a presentation-only symbol variant must be interpreted
consistently by every derived visibility consumer. No experience note is
created unless the human requests extraction.

## Outcome

- Added a shared endpoint-visibility predicate used by visible connectivity,
  flightline derivation, and editor connectable endpoints.
- Variant-hidden and base `implicit` terminals no longer create visible graph
  nodes or flightlines. Base `conditional` pins remain visible by default for
  fail-safe behavior until Net classification is implemented.
- Added a MOS regression proving three-terminal display yields no bulk
  flightline while `XM1.B → VSS` and `XM1.S → tail` survive canonical Project
  serialization; removing the variant restores the visible bulk flightline.
- Removed the OTA recipe's unconditional three-terminal assignment and
  attached VDD/VSS power labels to Port IDs. The UTF-8 recipe imports cleanly.
- Added explicit suffix baseline compensation and visually verified normal
  `+/-` placement through the current SVG-to-PNG exporter.
- Deferred bulk-Net classification, automatic compatible variant selection,
  and `HIDDEN_BULK_NON_GLOBAL_NET` to the next bounded target. Existing
  generated OTA artifacts remain untracked and were not overwritten.
- Validation passed: 17 focused tests, 151 full tests in 36 files, recipe
  import, typecheck, build, formatting, Phase 1/5 visual goldens, Phase 7
  export goldens, visual PNG inspection, and `git diff --check`.

## Commit Intent

Commit as:

```text
fix(connectivity): preserve implicit MOS bulk semantics
```
