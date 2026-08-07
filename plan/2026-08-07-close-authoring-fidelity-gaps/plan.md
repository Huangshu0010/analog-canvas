# Close Authoring Fidelity and Editing Gaps

## Goal

Close the four user-observed gaps in the Phase 8 editor: faithfully reproduce
the owned Visio/VSS device appearance and expose symbol previews, add semantic
copy/paste, complete instance/net/plain-text editing with bounded label
movement, and make group selection/movement include internal routed geometry
instead of visually stretching an internally selected circuit.

## Dirty-State Decision

`git status --short --branch` began clean on `main...origin/main` at commit
`ca62c60`. All changes in this target are owned here.

## Owned Files

- `plan/2026-08-07-close-authoring-fidelity-gaps/plan.md`
- `plan/log.md`
- `docs/specs/editor-interaction.md`
- `docs/specs/edit-engine.md`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/symbol-dsl.md`
- `docs/specs/visual-language.md`
- `docs/specs/agent-api.md`
- `docs/user/getting-started.md`
- `packages/symbols/src/**`
- `packages/render-svg/src/**`
- `packages/derived/src/**`
- `packages/edit-engine/src/**`
- `packages/agent-adapter/src/**`
- `apps/editor/src/**`
- `apps/editor/e2e/**`
- `fixtures/symbols/**`
- `fixtures/visual-golden/**`
- `fixtures/exports/phase-7-dense-analog/**`
- `fixtures/agent-api/**`
- `tools/vss-import/**`
- `tools/symbol-review/**`
- `scripts/phase-5-golden.mjs`
- `playwright.config.ts`

## Read-Only Files

- `lib/circuit.vss`
- `netlists/**`
- `.reference-src/**`
- `references/**`
- `packages/model/src/**`
- completed target plans

## Shared Dependencies

- The VSS is immutable, owned development evidence. It may be opened read-only
  through Visio COM but is never rewritten or loaded at runtime.
- Stable instance IDs remain connectivity identities. User-visible instance
  names are semantic `instance-label` annotations, avoiding graph-wide ID
  rewrites.
- Net labels name logical Nets. Reusing a label is an explicit same-name merge,
  not a visual-only annotation.
- Clipboard and all label/topology edits cross the Edit Engine transaction
  boundary and remain compatible with Agent operations.
- Group movement treats selected internal routed components as geometry owned
  by the move and stretches only true selection-boundary connections.

## Expected Work

1. Export and visually inspect representative VSS masters read-only, compare
   them to built-ins, expand the reviewed runtime set, and reproduce their
   normalized geometry without claiming unreviewed pin semantics.
2. Add deterministic SVG component thumbnails to the searchable palette.
3. Add copy/paste for selected instances, attached annotations, internal Nets,
   Routes, and Junctions with fresh stable IDs and one atomic offset commit.
4. Add typed Net naming/Junction movement edits and Agent schema parity.
5. Add instance-name, electrical Net-label, and plain-text creation/editing,
   selection, deletion, and bounded drag behavior.
6. Extend group selection/movement to expose and translate internal Routes,
   Junctions, and attached labels while locally stretching boundary routes.
7. Update contracts and user guidance, then validate focused behavior before
   expanding to the full release surface.

## Validation

- Visio read-only export and human-visible NMOS/PMOS/palette comparison
- symbol inventory/review/contact-sheet checks
- focused Symbol, renderer, derived movement, Edit Engine, and Agent tests
- TypeScript and full Vitest suite
- Playwright copy/paste, label editing/movement, preview, and routed group move
- Agent API artifact checks
- visual goldens and release verification
- Playwright loopback startup with local proxy bypass
- Markdown relative-link/fence checks
- runtime `.vss` isolation inspection
- `git diff --check`
- final repository status review

## Experience Signal

Playwright's readiness probe again inherited the machine HTTP proxy and
reported loopback as `502` even though direct requests returned `200`. The
repository now makes the loopback bypass deterministic in
`playwright.config.ts`. This repeats the Phase 8 environment signal and may be
worth extracting as a reusable validation lesson if a human requests it.

## Outcome

Completed all four authoring-fidelity closures. The runtime contains 27
previewable symbols, with 12 reviewed mappings and 13 separately labeled
geometry-migration candidates. NMOS/PMOS artwork follows the owned VSS rather
than the prior generic bubble convention. Copy/paste preserves wholly internal
routed subgraphs; instance labels, electrical Net labels, and plain text are
editable and draggable under their semantic constraints; and group movement
translates internal Routes/Junctions while stretching only boundary wiring.

Validation passed: TypeScript, 101 Vitest tests in 29 files, 10 Playwright
flows, formatting, four reference pins, three Agent artifacts, symbol and
visual contact sheets, Phase 1/5/7 goldens, performance budgets, PWA icons,
release packaging/smoke, changed-Markdown links/fences, runtime VSS isolation,
immutable VSS SHA-256, and `git diff --check`. The updated Phase 7 PNG was also
visually inspected.

## Commit Intent

Commit as:

```text
Close schematic authoring fidelity gaps
```
