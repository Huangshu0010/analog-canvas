# Anchor-driven trunk expander (A)

## Goal

Stop the trunk shapes (`shared-trunk`, `ordered-bus`) from hard-coding the
trunk position to the endpoint median. The Agent already declares trunk
placement intent via `RouteTreeDecision.anchors` (`outside-group`,
`between-groups`); the expander currently ignores it and computes its own
median — which is exactly the "geometry strategy written into the expander"
that made the CDAC output visually bad (trunks pinned next to device bodies,
no awareness of corridors).

A makes the expander honor the Agent's anchor decision and refuse (conflict,
never median-fallback) when a trunk shape lacks the anchor it needs. The
expander becomes a projector of the Agent's decision, not a planner.

Branch-junction shapes (`local-branch-tree`, `labeled-islands`) keep using a
group-local snapped center — that is local branch geometry, not a page trunk,
and is not the problem the user reported.

## Rule (side → orientation derivation)

Per the agreed answer, a trunk anchor's side derives its orientation:
- `outside-group side:"top"|"bottom"` → horizontal trunk (fixed y, spans the
  group's x extent).
- `outside-group side:"left"|"right"` → vertical trunk (fixed x, spans the
  group's y extent).
- `between-groups axis:"horizontal"` → horizontal trunk between the two groups.
- `between-groups axis:"vertical"` → vertical trunk between the two groups.

The expander computes the trunk line coordinate from the anchor + group bounds:
- `outside-group side:"top"`: trunkY = snap(groupMinY - CLEARANCE).
- `side:"bottom"`: trunkY = snap(groupMaxY + CLEARANCE).
- `side:"left"`: trunkX = snap(groupMinX - CLEARANCE).
- `side:"right"`: trunkX = snap(groupMaxX + CLEARANCE).
- `between-groups` horizontal: trunkY = snap((boundsA.maxY + boundsB.minY)/2)
  if A is above B (else swap), i.e. the gap midpoint between the two groups'
  nearest faces along the trunk axis.
- `between-groups` vertical: trunkX = snap((boundsA.maxX + boundsB.minX)/2)
  (or swap), the gap midpoint.

`CLEARANCE` = one grid (10). The trunk spans the convex hull of the attached
groups' endpoints along the trunk axis.

## What changes

### expand.ts
1. Add `resolveTrunkLine(decision, input, shape)`:
   - For trunk shapes, read `decision.anchors`; if absent/insufficient, return
     `conflictOnly("MISSING_ANCHOR", ...)`. No median fallback.
   - Derive orientation from the anchor (side/axis rule above).
   - Compute the trunk coordinate (fixed x or y) + span from group bounds.
   - Return `{ axis: "horizontal"|"vertical", fixed, span: [min,max] }` or a
     conflict.
2. Rewrite `expandSharedTrunk` and `expandOrderedBus` to use
   `resolveTrunkLine` instead of the median. The trunk route spans
   `span[0]..span[1]` along the fixed coordinate; taps are placed at each
   endpoint's projection onto the trunk line (unchanged — that part is correct
     and pin-aware because `route_orthogonal` resolves the escape).
3. Keep the corridor-blocked conflict check (now against the anchor-derived
   line, not the median).
4. `local-branch-tree` and `labeled-islands` unchanged (group-local center).

### types.ts
- `AnchorSpec` is already adequate. No schema change. (Orientation is derived,
  not stored.)

### Recipe (`agent-cdac-flat.mjs`)
- Add `anchors` to the vdd/vss/vout decisions so the Agent (recipe) states
  where each trunk sits:
  - vdd: `outside-group` on the units group, `side:"top"` (horizontal trunk
    above the units) — or the recipe may choose a vertical trunk on the units'
    east side; pick the one matching placement. Given units are stacked
    vertically with vdd pins on the east, a vertical trunk to the right of the
    units (`side:"right"`) is the natural Razavi rail.
  - vout: `between-groups` units and caps, `axis:"vertical"` (vertical trunk in
    the gap).
  - vss: `labeled-islands` already (no trunk); no anchor needed.
- The recipe now expresses placement intent, not the expander.

### Tests
- Add tests: trunk shape without anchor → `MISSING_ANCHOR` conflict (no
  edits). Trunk shape with `outside-group side:"right"` → vertical trunk at
  `groupMaxX + CLEARANCE`, snapped. `between-groups` → trunk at gap midpoint.
- Update the existing ordered-bus/shared-trunk tests if any assumed median
  (the current tests use ordered-bus with a corridor-conflict assertion; they
  may need an anchor added to stay valid).

## Out of scope

- Tap staggering to resolve collinear escapes (e.g. 6 cap pins sharing x). That
  is a separate, later improvement; the metrics already report it as evidence
  and the expander must not reroute. A leaves taps at projection.
- `local-branch-tree`/`labeled-islands` branch-junction centering.

## Validation

- `pnpm typecheck`, `prettier --check`, `vitest run packages/agent-routing`.
- Re-run the CDAC recipe with anchors; confirm trunks sit where the recipe
  declares (not at medians) and diagnostics report fewer wire-through-symbol.
- `git diff --check`.

## Commit Intent

```text
feat(agent-routing): drive trunk geometry from Agent anchors, not median
```
