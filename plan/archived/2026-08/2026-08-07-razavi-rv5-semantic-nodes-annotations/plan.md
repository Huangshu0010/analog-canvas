---
status: completed
experience: none
---

# Razavi RV-5 Semantic Nodes and Annotations

## Goal

Render placed signal Port origins, explicit Junctions, power supply bars,
voltage polarity, and current arrows from persisted semantic objects using
`razavi-textbook-v1` tokens. Preserve invisible device-pin anchors,
non-connected crossing behavior, and byte-identical legacy output.

## Dirty-State Note

Start state: `main` at pushed RV-4 commit `dfc5763`; only the five untracked,
user-confirmed parallel OTA `razavi-*` files remain. They are outside this
target and do not overlap renderer code, tests, specifications, or logs.

## Owner

Primary Agent (`/root`).

## Owned Files

- `plan/2026-08-07-razavi-rv5-semantic-nodes-annotations/plan.md`
- `packages/render-svg/src/style-profile.ts`
- `packages/render-svg/src/style-profile.test.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `docs/specs/visual-language.md`
- `docs/specs/razavi-textbook-style.md`
- `plan/log.md`

## Read-Only Files

- `packages/model/` schemas and persisted annotation kinds
- `packages/derived/` connectivity and crossing derivation
- editor interaction and overlay code
- existing Project fixtures and compatibility goldens
- `lib/circuit.vss`
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-*`

## Shared Dependencies

- Port/Junction/RouteEndpoint connectivity semantics
- existing annotation kinds and attachment IDs
- formal/editor layer separation
- renderer/export scene parity
- Phase 1/5/7 byte goldens

## Expected Work

1. Add immutable annotation geometry tokens for supply bars, current-arrow
   shaft/head, label gaps, and voltage polarity placement.
2. Render a filled origin only for a positioned signal Port under Razavi;
   power Ports attached to `power-label` annotations render a supply bar
   instead. Null-position Ports and device pin anchors remain invisible.
3. Keep explicit Junctions authoritative; corners and crossings never infer
   formal dots.
4. Render Razavi current arrows and voltage polarity from semantic annotations
   with upright text and profile-owned dimensions.
5. Preserve the exact compatibility-profile markup and export goldens.
6. Add truth-table-style renderer assertions for signal Port, power Port,
   Junction, device pin, crossing, current arrow, and voltage polarity cases.

## Validation

- focused style/renderer tests
- `pnpm visual:phase5:check`
- `pnpm export:phase7:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`

The formal scene changes for Razavi only, but the shared renderer requires
legacy visual/export goldens and the full test suite.

## Experience Signal (for human review)

None identified. The renderer could express the frozen node/annotation
contract through existing persisted semantics without a schema migration.

## Outcome

- Added profile-owned supply-bar, current-arrow, label-gap, and voltage
  polarity geometry tokens.
- Razavi signal Ports now render filled origin dots; Ports attached to power
  labels render supply bars instead. Null Ports and device-pin anchors remain
  invisible.
- Explicit Junctions remain the sole source of conductor-connection dots;
  Razavi crossings do not infer nodes.
- Current arrows and voltage polarity now derive geometry from semantic
  annotations, with labels and polarity glyphs kept upright.
- Legacy Phase 1/5 and Phase 7 output remained byte-identical.
- Validation passed: 12 focused tests, 150 full tests in 36 files,
  `pnpm visual:phase5:check`, `pnpm export:phase7:check`, typecheck, build,
  formatting, and `git diff --check`.
- The concurrent OTA `razavi-*` files remained untracked and untouched.

## Commit Intent

Commit as:

```text
feat(render): add Razavi semantic nodes and annotations
```
