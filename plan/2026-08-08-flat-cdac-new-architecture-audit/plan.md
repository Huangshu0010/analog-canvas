# Flat CDAC new-architecture evaluation

## Goal

Generate and visually audit a genuinely flattened transistor-level view of
`netlists/sky130-switched-capacitor-dac-6bit-pvt/circuit.spi` using the current
Agent-owned topology decision plus `@icm/agent-routing` geometry-expansion
boundary. Preserve the imported electrical topology and report where the new
architecture helps or constrains the result.

## Ownership and dirty-state decision

Owner: current Codex target.

The worktree was already heavily dirty. The target directory already contains
untracked `agent-cdac-flat.mjs` and `agent-scdac-newarch.*` files, and
`packages/agent-routing/src/expand.ts` contains an uncommitted tap-junction
change. Their ownership is unknown, they directly overlap the subject, and they
remain read-only. This target therefore uses distinct `codex-agent-cdac-flat`
names and treats the current built Agent-routing package as an experimental
read-only dependency. It will not commit or push while that shared dependency
remains unresolved.

## Owned paths

- `plan/2026-08-08-flat-cdac-new-architecture-audit/plan.md`
- `plan/log.md` (factual close-out entry only)
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/codex-agent-cdac-flat.mjs`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/codex-agent-cdac-flat.icproj.json`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/codex-agent-cdac-flat.svg`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/codex-agent-cdac-flat.png`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/codex-agent-cdac-flat.pdf`

## Read-only paths and dependencies

- `netlists/sky130-switched-capacitor-dac-6bit-pvt/circuit.spi`
- existing `agent-scdac-newarch.*`, `razavi-*`, and recipe files in that directory
- `packages/agent-routing/**`, especially the dirty `src/expand.ts`
- `packages/{spice,model,symbols,derived,edit-engine,agent-adapter,exporters}/**`
- `tools/agent-layout/generate.mjs`
- circuit-layout Skill and selected knowledge pages

## Expected work

1. Flatten the six `scdac_unit` calls into 24 MOS instances while preserving
   subcircuit formal-port order and retaining the original hierarchy Document
   as read-only source evidence.
2. Place the six repeated weighted switch/capacitor branches in evidenced bit
   order, with the common output plate visually stable and local VDD/VSS
   presentation islands.
3. Express per-Net topology as transient route-tree decisions and let the
   expander emit typed edits; do not persist those decisions.
4. Generate formal Project/SVG/PNG/PDF artifacts through the existing runner.
5. Inspect actual stored Routes, diagnostics, electrical membership, and the
   formal render; record architectural findings here.

## Validation

- SPICE `.subckt`/`.ends` balance and explicit pin order reviewed.
- Generator completes through dry-run and committed typed transactions.
- Flatten check: no `XU0`...`XU5` block instance remains; expected primitive
  MOS/capacitor/reset/helper counts are present.
- Imported terminal-to-Net membership is compared before and after flattening.
- No unplaced or generic instances; no unintended flightlines, crossings,
  ambiguous Junctions, unresolved symbols, or blocking diagnostics.
- Formal PNG inspected at whole-page and local scale.
- `git diff --check` and final `git status --short --branch`.

## Commit intent

Evaluation-only while the shared Agent-routing dependency and overlapping
untracked candidate files have unknown ownership. Do not stage, commit, or push
without resolving that dependency ownership first.

## Findings

Completed as an evaluation; artifacts were generated but intentionally not
committed because the shared Expander dependency remains dirty.

### Output and electrical facts

- API `2.0` and Snapshot `1.0` were used. Six dry-run/commit batches advanced
  the flat Document to revision 6.
- The final Document has 46 placed primitive instances: 12 PMOS, 13 NMOS,
  7 capacitors, 6 local VDD symbols, and 8 ground symbols. No hierarchical or
  generic block remains.
- The flattened source topology has the expected branch membership before
  presentation helpers: each `b0..b5` has two MOS gate terminals plus one
  port; each `nb0..nb5` has four terminals; each `bot0..bot5` has two switch
  drains plus one capacitor terminal; `vout` has eight terminals plus one
  port; `reset` has one terminal plus one port. VDD/VSS counts increase only by
  the explicitly added one-pin presentation helpers.
- There are no unplaced or unresolved-symbol instances and no error-severity
  visual diagnostics. The formal render clearly exposes bit order, binary
  capacitor weights, local CMOS drivers, reset, and the common output plate.

### Architecture evidence

1. Agent reasoning was not the bottleneck. From the complete Snapshot it could
   identify the six repeated switched branches, binary weights, common output
   plate, local supplies, reset branch, and appropriate flat placement without
   a persisted Layout Intent.
2. The first `shared-trunk` attempt exposed two Expander defects. Its tap
   Junctions did not split the trunk Route, leaving nine visible VOUT
   components/flightlines; after correcting capacitor orientation, an endpoint
   coincided with a tap and `route_orthogonal` threw an uncaught
   `Route normalization requires one mode per segment` exception for a
   zero-length escape instead of returning a structured transaction rejection.
3. The Agent explicitly changed VOUT to `local-branch-tree` rather than letting
   the helper reroute. This removed VOUT flightlines and produced a readable
   common plate, but it materialized the plate as nine overlapping Routes via
   one hub. The formal image contains a doubled top rail because terminal
   escape and hub height cannot be controlled independently.
4. `labeled-islands` emits local Junctions and Routes but no attached labels.
   The renderer makes local VDD bars and ground symbols understandable to a
   human, while `deriveFlightlines` still reports six VDD and eight VSS
   components. The helper and visible-connectivity model disagree about what a
   labeled/power island means.
5. Final counters are 14 flightlines, 254 pairwise crossings, 70 same-Net Route
   overlaps, 11 wire-through-symbol warnings, 6 short-segment warnings, and
   one label overlap. Most crossings are repeated same-Net intersections at
   intentional branch geometry rather than cross-Net ambiguity, so the raw
   crossing count is not a useful quality score for this representation.
6. Expander metrics report zero bends for every decision even though committed
   `route_orthogonal` polylines contain bends. The Expander's pre-transaction
   `resolvedGeometry` is not the Engine's resolved geometry.
7. Every routing dry-run returned zero `resolvedRoutes`, while the corresponding
   commits returned 49, 49, and 12. This reproduces the protocol bug where
   dry-run resolves against the original Document rather than the candidate.
8. A generic flatten utility was still required before opening the API v2
   session because the Agent API has no Document creation/flatten operation.
   This is an import/preparation boundary gap, not a reason to add a CDAC
   endpoint.

During close-out, another uncommitted target modified the shared source to
return the candidate Document on dry-run, hydrate the CLI input Map, avoid
duplicate reciprocal group links, and stretch multi-instance moves against the
evolving draft. Those changes appeared after this evaluation runtime had been
built, were not owned or rebuilt by this target, and therefore do not alter the
measured result above. They appear directed at previously reported issues but
remain outside this validation. The segmented-trunk, zero-length escape,
labeled-island semantics, and Engine-derived metric gaps remain visible in the
current shared source.

### Conclusion

The flat Agent composition is viable and electrically faithful, but the
Expander is not yet reliable scaffolding for multi-terminal Nets. The next
minimum fixes are segmented trunk emission with real tap endpoints, zero-length
escape handling, explicit labeled-island output/semantics, Engine-derived
post-expansion metrics, and candidate geometry in dry-run responses. No
automatic router is indicated by this experiment.

### Close-out validation

- Generator and API v2 loop completed deterministically after the Agent changed
  VOUT from `shared-trunk` to `local-branch-tree`.
- Project parsing and structural assertions passed for primitive counts,
  placement, hierarchy removal, repeated branch terminal counts, and VOUT
  membership.
- Target script and plan pass Prettier; repository-wide `git diff --check`
  passes.
- Final worktree status confirms all target artifacts remain untracked and the
  factual log is modified; nothing was staged, committed, or pushed.
