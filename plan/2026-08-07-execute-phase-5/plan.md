# Execute Phase 5 Symbols and Visual Quality

## Goal

Complete the production symbol and formal-presentation slice: inventory the
owned Visio stencil through a development-only extractor, record reviewed
master mappings, expand the runtime Symbol DSL/library, make semantic
annotations and layout intent editable, add deterministic visual diagnostics,
and accept an original dense analog SVG golden under
`textbook-monochrome-v1`.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean after Phase 4 commit `b1c581c`. No user changes overlap
this target.

## Owned Files

- `docs/specs/symbol-dsl.md`
- `docs/specs/visual-language.md`
- `docs/specs/schematic-model.md`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-5-symbols-and-visual-quality.md`
- `packages/model/`
- `packages/symbols/`
- `packages/derived/`
- `packages/edit-engine/`
- `packages/render-svg/`
- `apps/editor/`
- `tools/vss-import/`
- `tools/symbol-review/`
- `fixtures/symbols/`
- `fixtures/projects/phase-5-*`
- `fixtures/golden/phase-5-*`
- `plan/2026-08-07-execute-phase-5/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- `netlists/`
- `.reference-src/`
- completed Phase 0-4 plans and acceptance evidence

## Shared Dependencies

- Visio COM 16.0, available locally only for development-time extraction
- explicit Junction/crossing and integer-coordinate contracts from Phase 3
- the `ngspice-46-core` importer and current built-in symbol IDs
- the user-provided textbook schematic as qualitative style evidence only

## Frozen Decisions

- `lib/circuit.vss` is an owned development input, not a runtime dependency.
- Extracted geometry cannot enter the built-in library until a product-owned
  review record assigns electrical pins and a canonical symbol ID.
- The first reviewed production set is resistor, capacitor, inductor, NMOS,
  PMOS, ground, port, independent voltage/current source, diode, NPN, PNP,
  and generic block; unsupported SPICE families retain deterministic generic
  blocks.
- Electrical pins are invariant across visual variants, including hidden MOS
  bulk pins.
- Layout constraints and visual diagnostics advise or reject only their own
  typed edits; they never silently move unrelated objects or change nets.
- Formal output contains routes, junctions, symbols, and semantic annotations.
  Grid, selection, handles, flightlines, and diagnostics remain editor-only.

## Expected Work

1. Build a deterministic PowerShell VSS inventory/extraction tool and checked
   review manifest without adding a runtime Visio dependency.
2. Extend Symbol DSL primitives and the built-in library for the reviewed
   production families; validate aliases, pins, variants, and transforms.
3. Add typed annotation/group/constraint Edit Engine operations and practical
   editor controls for the Phase 5 fixture.
4. Add deterministic visual diagnostics for overlap, spacing, symmetry,
   unresolved placement, route ambiguity, and export bounds.
5. Render and review an original dense analog Project/SVG golden and keep
   editor overlays outside formal export.
6. Update the accepted specs, roadmap evidence, and execution log.

## Validation

- VSS inventory and review-manifest validation
- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- deterministic SVG golden comparison and formal-layer inspection
- Markdown relative-link and fence checks
- product/reference/runtime-Visio coupling inspection
- `git diff --check`
- `git status --short --branch`

## Experience Signal (for human review)

None at target start. No experience note will be extracted automatically.

## Commit Intent

Commit as:

```text
Complete Phase 5 symbols and visual quality
```

## Outcome

- Captured a complete hash-pinned VSS inventory and 12 reviewed mappings with
  no runtime Visio dependency.
- Expanded and visually reviewed the production library, including truthful
  MOS bulk variants and deterministic generic fallbacks.
- Added semantic annotation/layout edits, attachment behavior, locks, visual
  diagnostics, and editor controls through the shared Edit Engine.
- Accepted an original dense analog Project/SVG golden after browser review;
  it contains no crossings, label-overlap finding, blocking diagnostic, or
  editor overlay in formal export.
