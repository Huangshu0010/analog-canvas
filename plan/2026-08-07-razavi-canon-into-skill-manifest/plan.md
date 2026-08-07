# Expose Razavi fixed-style hard canon to the Skill manifest

## Goal

Close Gap A: the Agent currently has no view of the Razavi fixed-style hard
canon (grid `10`, pin anchors divisible by `10`, schematic-math label rules,
stroke roles, node/connection-origin truth table). `razavi-textbook-style.md`
exists as a `proposed` normative spec owned by `packages/symbols`,
`packages/render-svg`, and `tools/vss-import`, but it is not routed from the
Skill knowledge manifest, so the Agent reasons about placement and labels
without knowing the coordinate/stroke/typography contract the renderer enforces.

This target exposes **only the three hardable fixed-style layers** — coordinate
conventions, typography, and strokes/nodes/arrows — to the Agent. It explicitly
keeps routing topology, elbow/trunk choice, obstacle avoidance, and layout
composition OUT of this canon. That boundary is the `razavi-style-aspect-boundary`
memory: devices / line-width / text are hardable; routing is not, and must not
be conflated with style fidelity.

This is target #1 of the agreed six-step routing-quality sequence. It is the
cheapest, lowest-risk step (documentation only, no contract change) and is a
prerequisite for the later route-tree work: the Agent must know the coordinate
canon before any expander can rely on grid-aligned anchors.

## Dirty-State Note

Live `git status --short --branch` confirms a large dirty set across
`apps/editor`, `packages/*` (agent-adapter, derived, edit-engine, model,
render-svg, symbols), `fixtures/*`, `netlists/*`, plus `docs/README.md` and
`plan/log.md` — all from prior uncommitted targets. Owned paths for this
target are `docs/agent/knowledge/razavi-style-canon.md` (new),
`skills/circuit-layout/references/manifest.md`, and `docs/agent/README.md`.
None overlap the dirty set. Unrelated dirty files are safe to leave untouched;
no shared runtime contract is altered by a docs-only change.

## Owned Files

- `docs/agent/knowledge/razavi-style-canon.md` (new)
- `skills/circuit-layout/references/manifest.md` (add rows)
- `docs/agent/README.md` (only if it enumerates knowledge categories in a way
  the new doc must be listed; otherwise no change)

## Read-Only Files

- `docs/specs/razavi-textbook-style.md` — authoritative normative source; quoted
  and linked, not edited. Status `proposed`.
- `docs/agent/knowledge/routing-and-diagnostics.md`,
  `docs/agent/knowledge/schematic-expression.md`,
  `docs/agent/layout-guidance.md` — referenced as the routing/composition
  authorities so the new canon does not duplicate soft routing guidance.
- `packages/render-svg/src/style-profile.ts`,
  `packages/render-svg/src/schematic-text.ts` — the runtime token sources, to
  quote exact values rather than invent them.
- `docs/specs/README.md` — confirms `razavi-textbook-style.md` is `proposed`.

## Shared Dependencies

- The Skill knowledge manifest (`skills/circuit-layout/references/manifest.md`)
  is the single Agent knowledge entry point; adding rows is the canonical way
  to place something in Agent view.
- The Agent integration guide (`docs/agent/README.md`) states knowledge lives in
  `docs/agent/knowledge/`; the new doc must live there, not point the manifest
  directly at `docs/specs/`, to respect that convention.
- No schema, ADR, runtime contract, or generated artifact is touched. The
  `proposed` spec status is unchanged; the new doc tracks it and notes it may
  change before RV-7 acceptance.

## Expected Work

1. Run `git status --short --branch`; confirm owned paths do not overlap the
   dirty set; record the decision.
2. Verify the exact hard values to quote by reading
   `packages/render-svg/src/style-profile.ts` (razavi profile tokens) and
   `schematic-text.ts` (math rules), cross-checked against
   `razavi-textbook-style.md` layers 2 and 3. Do not introduce values absent
   from both.
3. Create `docs/agent/knowledge/razavi-style-canon.md` following the existing
   knowledge-doc pattern (`Owner / Strength / Trigger` header, prose sections,
   a counterevidence/failure-modes section). Contents:
   - `Owner: render-svg/symbols packages for tokens; Agent reasoning for
     applying the canon when placing and labeling. Strength: hard for the
     coordinate, typography, and stroke/node canon only; guidance for nothing
     routing-related. Trigger: placement, label text, or visual-token decisions
     under the Razavi profile.`
   - Coordinate canon: grid `10`, pin anchors divisible by `10` on both axes,
     placement preserves grid alignment through rotation/mirror, formal
     foreground `#202020` / background `#ffffff`, no `vector-effect=
     non-scaling-stroke` in formal output.
   - Typography canon: schematic-math composition rules (explicit underscore
     priority; alphabetic designator is base + rest is subscript for instance
     labels; leading `V`/`I` is base + rest is subscript for recognized
     voltage/current/power labels; plain notes and captions are not implicitly
     parsed; `+`/`-`/parentheses/numbers stay upright; text stays upright under
     component rotate/mirror). Reference the spec's required examples.
   - Stroke/node canon: the connection-origin truth table (device pin anchor
     invisible; placed signal Port origin filled circle r `3.0`; power Port +
     power label → supply bar width `20`, no overlapping origin dot; explicit
     Junction filled circle r `3.0`; two-wire corner no dot; non-connected
     cross no dot; degree alone does not create a dot). Semantic stroke roles
     (wire/symbol/normal/emphasis/supply/annotation) only; a source asset maps
     reviewed VSS weights to roles, unknown weights block.
   - **Out of scope** section (the boundary, Agent-facing language): routing
     topology, elbow choice, trunk placement, obstacle avoidance, label density,
     and overall composition are NOT in this canon and are not implied by the
     fixed style. They are Agent routing/composition judgment consuming the
     profile. Link to `routing-and-diagnostics.md`, `schematic-expression.md`,
     and `layout-guidance.md` as the routing/composition authorities. Quote the
     spec's line that routing is not a fixed-style asset.
   - Provenance note: this doc tracks `razavi-textbook-style.md` (status
     `proposed`); token values may change before RV-7 acceptance; the spec
     remains authoritative on conflict.
4. Add manifest rows under `skills/circuit-layout/references/manifest.md`
   routing relevant signals to the new doc, e.g.
   `Placement coordinates, pin-anchor grid, label math, or fixed-style tokens`
   → `razavi-style-canon.md`. Keep table column style consistent.
5. Update `docs/agent/README.md` only if its knowledge enumeration requires the
   new doc to be listed; otherwise leave it (it points at `knowledge/`
   generically).
6. Verify all relative Markdown links from the new doc and manifest resolve,
   and fenced blocks balance.

## Validation

- `git diff --check`
- `git status --short --branch`
- Manual Markdown link resolution from the new doc and the edited manifest row
  to every referenced target (`razavi-textbook-style.md`, the three routing/
  expression/guidance docs, the spec README). This is the affected surface:
  docs-only, no code/contract.
- Fenced-code-block balance in the new doc.
- No `pnpm typecheck`/`test`/`build` regression is expected because no source or
  contract changes; state this rather than running the full suite, per AGENTS.md
  risk-proportional validation.

## Experience Signal (for human review)

This target operationalizes the `razavi-style-aspect-boundary` memory: it
exposes the three hardable aspects (devices/line-width/text) to the Agent while
writing the hard/routing boundary into the knowledge doc itself. A possible
signal to watch in later targets: whether the new canon, once in Agent view,
causes Agents to over-apply hard rules to routing (the Phase 9 failure mode).
If so, the boundary prose here is the first place to tighten. Human decides
whether this becomes a lesson.

## Commit Intent

```text
docs(agent): expose Razavi fixed-style hard canon to Skill manifest
```

## Follow-up targets (not bundled; recorded for sequencing)

2. Protocol self-consistency: return normalized geometry, full diagnostics, and
   edit index from transact.
3. Route-tree method + `packages/agent-routing` expander package, preceded by a
   boundary ADR (RouteTreeDecision must not become ADR-0007's vetoed
   Layout Intent; expander detects conflicts but does not auto-reroute).
4. Read-only routing-quality metrics (wire-through-symbol, same-net overlap,
   terminal departure, fragmentation); detour ratio as evidence only.
5. Route-stretch ADR for device/group move (move_instance/move_junction
   waypoint coupling).
6. A*, automatic cleanup, automatic avoidance — last, only if measured need.
