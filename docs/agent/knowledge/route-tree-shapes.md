# Route-tree shapes

Owner: Agent reasoning for choosing a shape; `@icm/agent-routing` for the
deterministic expansion. Strength: **guidance** — a shape menu, not a recipe.
Trigger: a multi-endpoint Net that needs a routing-tree decision before
`route_orthogonal` / `set_route_points` can lay out compliant geometry.

This is a dictionary of the finite shape vocabulary the
`@icm/agent-routing` expander accepts. Each shape describes what it is, when it
may fit, what it expresses well, how it commonly fails, and when it does not
fit. Choose a shape from circuit evidence; do not apply a global priority order.
There is no `auto` or `best` shape, and the expander never silently switches
shapes — if a chosen shape cannot be laid out, it returns a conflict and you
reconsider the decision or placement.

## How to use this menu

- Read the Snapshot first. Decide which endpoints share a branch, where a trunk
  could sit, and whether the Net should be drawn end-to-end or expressed partly
  by label.
- Pick a shape that matches the evidence. Record one line of rationale per Net
  (e.g. "16 repeated units across the matrix; a continuous trunk would cross
  it; chose labeled-islands").
- Submit a `RouteTreeDecision` to the expander. It computes coordinates; you do
  not.
- If the expander returns a conflict, change the shape, the grouping, or the
  placement. Do not hand-edit coordinates to defeat the conflict.

## Shapes

### direct

Shape: one route per endpoint pair, no Junctions.

May fit:
- exactly two endpoints on the same Net;
- endpoints already roughly aligned on one axis.

Expresses well: the simplest, lowest-clutter connection.

Common failure: endpoints on neither shared axis produce a long L that may
cross other geometry; a `local-branch-tree` would be clearer.

Does not fit: three or more endpoints; a Net that spans functional regions.

### local-branch-tree

Shape: each group of endpoints escapes to a shared branch Junction; groups link
to each other by short routes.

May fit:
- a small cluster of endpoints that share a local connection point;
- groups that have a natural neighbor to attach to.

Expresses well: local connectivity with short, readable escapes.

Common failure: the branch Junction lands on or near an instance silhouette;
too many groups produce a long chain of links.

Does not fit: a Net shared across many widely separated regions (use
labeled-islands); a Net with a clear common rail (use shared-trunk).

### shared-trunk

Shape: one horizontal trunk spans the leftmost-to-rightmost anchor; each
endpoint escapes to the nearest trunk point.

May fit:
- one Net distributed across several ordered device groups;
- branches with similar escape directions;
- a clear horizontal corridor between groups.

Expresses well: a common control, supply, or bus relationship; reduces repeated
long wires.

Common failure: the trunk corridor crosses an instance silhouette — the
expander returns `TRUNK_CORRIDOR_BLOCKED` rather than rerouting; parallel
trunks of different Nets become hard to distinguish.

Does not fit: endpoints concentrated in a small area; hierarchy expressed more
clearly by local Net labels; a trunk that would cross multiple functional
regions.

### labeled-islands

Shape: each group forms a local branch Junction; cross-island connectivity is
expressed by the shared Net name, not drawn wire.

May fit:
- a Net shared across widely separated regions where a drawn trunk would add
  clutter;
- repeated cells that each have a local copy of the same supply/control.

Expresses well: locality without a distracting page-spanning wire.

Common failure: the Net label is not visible at every island — connectivity
becomes implicit and hard to audit; an island with a single endpoint needs no
Junction.

Does not fit: a Net whose endpoints are close enough to draw directly; a Net
where the drawn connection itself carries meaning (e.g. a feedback path).

### ordered-bus

Shape: a vertical trunk ordered top-to-bottom by endpoint position; each
endpoint attaches at its trunk height.

May fit:
- an ordered set of taps (e.g. a resistive ladder, a DAC tap bus);
- endpoints that have a meaningful vertical order.

Expresses well: ordering and equal spacing along a shared axis.

Common failure: the vertical corridor crosses an instance; ordering is
ambiguous when two endpoints share a height.

Does not fit: endpoints with no meaningful order; a Net better drawn as a short
local branch.

## Choosing evidence over rule

The same topology often has several legitimate expressions. A quality gate must
accept any shape that is electrically correct, unambiguous, and within metric
bounds — not a single golden recipe. When two shapes both fit, pick the one
that makes the circuit easier to read at a glance, and record the one-line
rationale. If you cannot justify a shape against this menu, reconsider the
topology rather than adding more wire.
