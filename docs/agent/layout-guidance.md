# Agent Layout and Routing Guidance

These are review heuristics, not hidden automatic-layout rules.

## Analog placement

- Preserve obvious matching: equal orientation, aligned device centers, and
  comparable local wire length for differential or mirror pairs.
- Place power toward the top and ground/tail current toward the bottom when it
  improves reading, but do not force a page-wide topology.
- Keep signal flow locally legible. Inputs usually approach from the side and
  outputs leave toward open space.
- Use explicit LayoutGroups/constraints to record intent before performing a
  multi-object alignment.
- Keep labels outside symbol strokes. Instance labels may sit beside compact
  MOS symbols when above/below space is occupied.

## Routing

- Logical Net membership is truth; Routes express only visible connectivity.
- A geometric crossing is not a connection. Add a Junction only when every
  participating branch is explicitly split onto the same Net.
- Reuse short orthogonal trunks for rails and bias distribution when that
  reduces ambiguity.
- Do not rewrite locked route segments. Prefer a dry run and report the lock.
- After moving a connected instance, use local stretch proposals instead of
  redrawing unrelated branches.

## Visual review

After an edit, inspect structured diagnostics first, then request a bounded
diagnostics render. Treat unresolved symbols and ambiguous Junction dots as
blocking. Treat overlap/spacing/constraint warnings as prompts for judgment,
not permission to move unrelated objects.

Formal export must remain monochrome and contain no Agent diagnostics, grid,
selection, hit target, flightline, or preview layer.
