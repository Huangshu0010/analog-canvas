# Route-tree shape vocabulary

Owner: Agent reasoning for choosing and specifying the visible topology;
`@icm/agent-routing` only for deterministic geometry expansion. Strength:
guidance. Trigger: a multi-endpoint Net that needs a deliberate branch, trunk,
rail, tap, or label structure.

These shapes are a visual vocabulary, not RouteGraph enums, constructors, or a
priority-ordered recipe. The current helper accepts a complete graph of nodes
and edges. It never chooses a shape, adds a missing branch/bend, or reroutes.

## Use the vocabulary

1. Read every endpoint and its functional context from the complete Snapshot.
2. Decide what shared relationship the reader should see.
3. Check available corridors, symbol escapes, labels, crossings, and locks.
4. Choose or combine useful shapes below.
5. Encode the result explicitly as RouteGraph `endpoint`, `bend`, real branch,
   and label-anchor nodes plus octilinear edges. Keep terminal escape edges
   axis-aligned with their declared outward direction.
6. Revise the graph if expansion conflicts or the formal render is confusing.

The same Net may use a local branch in one region and labeled islands between
regions. Names describe the result; they do not limit Agent reasoning.

## Direct connection

Shape: one Route between two endpoints, with dot-free bends if needed.

Useful when endpoints are close and the visible wire directly communicates the
relationship. It becomes poor when a long L-shaped wire cuts through unrelated
functional regions.

## Local branch tree

Shape: nearby endpoints escape to one or a few real branch Junctions connected
by short links.

Useful for a CMOS drain node, shared gate, differential tail node, or compact
local cluster. Prefer one Junction when the reader should perceive one node.
Too many nearby Junctions create bumps, boxes, and false stage boundaries.

## Shared trunk or rail

Shape: a horizontal or vertical conductor with real taps to ordered consumers.

Useful for a clear supply, bias, common control, output plate, or other
distributed relationship when an unobstructed corridor exists. A trunk is poor
when it crosses device bodies, dominates the signal path, or requires many
detours. The Agent positions every trunk/tap node; the helper does not calculate
a median or choose a corridor.

## Labeled islands

Shape: local connected branches carry the same attached Net label instead of a
page-spanning wire.

Useful for distant supply, bias, clock, or repeated-cell regions where a drawn
trunk adds clutter. Each island must contain an actual endpoint/branch relation
and a visible attached label. An unlabeled stub plus a caption is not an island.

## Ordered repeated taps

Shape: repeated local branches attach to a deliberately ordered trunk/rail or
to consistently placed labeled islands.

Useful for capacitor arrays, resistor ladders, bit slices, and staged logic.
Order should come from bit weight, tap sequence, or signal flow—not just current
coordinates. Preserve local exceptions rather than forcing a false regularity.

## Feedback loop

Shape: a visible return path around, above, or below a forward path, sometimes
bridged by paired local labels.

Useful when feedback or cross-coupling is central to understanding the circuit.
Keep direction and attachment points distinguishable. Avoid bundling opposing
feedback paths so tightly that a reader cannot tell which node drives which.

## Selection questions

Before committing an important Net, answer:

- Which endpoints form local functional nodes?
- Which nodes are real branches and which are only bends?
- Does a continuous wire communicate function or only add distance?
- Is there an obstacle-free corridor for a trunk?
- Would labels clarify hierarchy/locality or hide the relation?
- Does the proposed graph create duplicate nearby dots, tiny boxes, reversals,
  or wire-through-symbol paths?
- Can the choice survive a formal-render review without a prose explanation?

Choose the clearest defensible expression. A quality gate must accept multiple
valid shapes; it must not require one golden recipe.
