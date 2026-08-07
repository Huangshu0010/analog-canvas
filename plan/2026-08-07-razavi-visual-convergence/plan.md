# Razavi Visual Convergence

## Goal

Converge editor and formal export on a dedicated `razavi-textbook-v1` visual
profile covering VSS-derived symbol fidelity, semantic stroke hierarchy,
compact orthogonal routing, visible signal-port origins, Junctions, math-style
labels, supply/ground marks, and electrical annotation arrows. Preserve
electrical topology, pin order, project hierarchy, and editor-overlay
separation.

## Dirty-State Note

The overlapping editor, renderer, hierarchy, symbol, visual-prototype, and
Phase 9 work was validated, committed, and pushed as integration checkpoint
`21b85fd`. The shared baseline is therefore no longer the blocker described by
the opening audit.

During that validation, another worker created
`netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-*`. Those files were
not in the opening inventory, remain untracked, and are outside this target's
ownership. The normative-document commit can proceed without them. Runtime
implementation must re-audit their ownership and avoid overwriting them.

## Owned Files

- `plan/2026-08-07-razavi-visual-convergence/plan.md`
- `docs/specs/razavi-textbook-style.md`
- `docs/specs/README.md`
- `plan/log.md`
- after checkpoint/coordination: dedicated style-profile modules, focused
  renderer/symbol/editor changes, Razavi acceptance fixtures, generated visual
  goldens, and normative visual/VSS documentation enumerated before editing

## Read-Only Files

- `lib/circuit.vss`
- `fixtures/symbols/circuit-vss-inventory.json`
- the user-provided six-panel Razavi reference image
- all currently dirty shared files until checkpoint/coordination
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-*`

## Shared Dependencies

- Project-aware hierarchical Symbol Resolver and visible hierarchy pin names
- Symbol DSL 1.4 connection-grid invariant
- formal SVG/PNG/PDF scene parity
- route/Junction/Port electrical semantics
- editor overlay versus formal output boundary
- all 101 VSS masters and their review disposition

## Expected Work

1. Create a product-owned Razavi acceptance board using equivalent small
   topologies without copying the reference bitmap.
2. Define semantic visual tokens for conductor, symbol, emphasis, supply,
   Junction, Port origin, current arrow, math label, and editor overlay.
3. Replace hard-coded primitive widths with semantic roles consumed by
   `razavi-textbook-v1`; keep `textbook-monochrome-v1` compatible.
4. Render visible Port origins separately from invisible device pin anchors
   and explicit Junction dots.
5. Add compact direction-aware elbow routing and deterministic bend flipping
   for manual work while preserving user-fixed bends.
6. Build a 101-master VSS disposition manifest and migrate the accepted analog
   schematic subset in reviewable batches.
7. Add structured base/subscript label rendering and Razavi-style electrical
   arrows without weakening plain-text persistence compatibility.
8. Regenerate and visually inspect editor/export goldens at fixed scale.

## Validation

- focused style-token, renderer, symbol, Port/Junction, label, and route tests
- deterministic Razavi acceptance SVG plus PNG visual inspection
- SVG/PNG/PDF scene-parity checks
- all affected editor Playwright flows
- VSS inventory has one explicit disposition per 101 masters
- `pnpm typecheck`
- affected visual/release golden checks
- `git diff --check`
- `git status --short --branch`

The target crosses renderer, symbol, editor, and export contracts, so focused
tests alone are insufficient; fixed-scale visual review and scene parity are
required.

## Experience Signal (for human review)

## Design Outcome

- Added the proposed normative `razavi-textbook-v1` specification with the
  agreed three fixed-asset layers: components, typography, and strokes/nodes.
- Explicitly excluded routing paths and layout algorithms from the fixed-style
  contract.
- Defined structured VSS decoding, canonical runtime asset locations, all-101
  Master disposition, catalog/provenance, initial numeric style tokens,
  schematic-math rules, Port/Junction semantics, a six-topology acceptance
  board, deterministic gates, and RV-1 through RV-8 delivery order.
- Documentation formatting, fenced-code balance, required-section checks, and
  `git diff --check` passed for the two owned files.
- Runtime implementation was initially blocked on checkpointing the
  overlapping renderer, hierarchy, manual-wire, symbol, and Phase 9 changes.
- Integration checkpoint `21b85fd` removed that prerequisite. The remaining
  OTA `razavi-*` files are isolated concurrent work and must be ownership-audited
  before runtime implementation edits that directory.

## Commit Intent

Commit as a dedicated target after prerequisite checkpoints:

```text
docs(style): define Razavi textbook visual profile
```
