# Hierarchy and large circuits

Owner: Agent reasoning. Strength: guidance. Trigger: a Project Index has child
references, or the selected Document contains roughly 100 or more instances.

The Project index exposes `structureRevision`. Formal Cell terminals expose a
stable ID, direction, Net ID, and their ordinary Port Instance. Use the same
`transact` operation with `structureEdits` for Cell/interface changes; do not
invent a separate hierarchy command language.

## Read the boundary before the interior

Use the Project Index to identify the top Document and reference edges. For each
candidate child, read its complete Snapshot and relate its ordered formal cell
terminals back to the parent instance pins. A repeated child instance is one
definition with several contexts; do not clone or flatten it merely to make
reasoning easier.

For a large flat Document, retain the whole Snapshot as the factual graph while
focusing attention internally on one boundary cone, bias spine, repeated branch,
signal path, or diagnostic neighborhood at a time. Carry boundary Nets between
attention sets so local improvements do not hide global feedback or shared bias.

## Choose an expression level

- Keep stable repeated cells hierarchical when their formal terminals state the
  function clearly and the parent still exposes signal order and weighting.
- Enter a child when internal device relationships determine readability.
- Flatten only when the user requests it or hierarchy conceals the relationship
  the drawing must explain.
- Place sibling blocks by parent-level flow; place devices by child-level
  evidence. Never use parent coordinates as proof of child semantics.
- In the parent render, every child-block pin must be visibly connected or
  locally identifiable. Repeated common connections may use one compact trunk/rail or a
  consistent boundary convention; add local labels only when the relation would
  otherwise be ambiguous. Prose alone is not a substitute, but neither is
  repeating the same label until the hierarchy becomes text-heavy.

## Counterevidence and failure modes

Similar subcircuit names do not prove equivalent behavior. Check
formal-terminal order, parameters, model variants, and external Net roles. Shared child definitions can
serve asymmetric parent contexts; do not write context-specific edits into the
shared child without reviewing every reference. Do not turn an internal
attention set into a persisted Layout Intent or API region.

## Completion check

Review every changed Document from its own fresh Snapshot, then review each
parent context. Confirm the Project top remains unchanged when merely navigating
and that no referenced Document was silently duplicated or flattened.
