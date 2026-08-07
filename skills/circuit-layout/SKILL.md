---
name: circuit-layout
description: Reason about, lay out, route, and refine transistor-level or passive circuit schematics through the Interactive Circuit Maker Agent Circuit API. Use for Snapshot-driven circuit reading, schematic placement, wiring, hierarchy work, visual cleanup, diagnostics repair, or human/Agent handoff while preserving electrical correctness.
---

# Circuit Layout

Use the complete read-only circuit Snapshot as evidence, reason freely about the
current circuit, and mutate it only through revision-safe typed transactions.
Do not produce or require a fixed Layout Intent object.

## Establish the contract

1. Require API `2.0`, Snapshot `1.0`, and the operations
   `capabilities/snapshot/transact/render`.
2. Check `permissions`, edit kinds, transaction/render/Snapshot limits, selected
   `documentId`, and `revision` before planning edits.
3. Require the complete selected Document: ports, every instance and resolved or
   connected pin, Nets and terminals, Routes, Junctions, annotations, groups,
   constraints, bounds, presentation, and diagnostics.
4. Treat the Snapshot as read-only evidence. Never return it as a replacement
   Document or Project.
5. Use v1 `query` only for an explicitly requested legacy-compatibility task.
   Never build the primary workflow around query scopes.

Stop and report the missing capability or fact when the contract is incomplete.
Never infer an unavailable pin mapping, hidden connection, or model semantic.

## Load only the needed knowledge

Read [references/manifest.md](references/manifest.md) to select the smallest
relevant knowledge set. Always load circuit reading for an unfamiliar circuit.
Load expression or routing guidance only when placing, routing, or repairing a
view. Load a pattern card only after the Snapshot supplies supporting evidence;
the card name is not evidence.

## Run the reasoning and edit loop

1. Select the working Document from the Project Index. Prefer a meaningful child
   Document over flattening a large hierarchy without cause.
2. Establish boundaries, device semantics, Net roles, signal/bias/feedback paths,
   repeated or symmetric structures, and counterevidence from the Snapshot.
   Track uncertainty internally; no planning-object schema is required.
3. Choose one coherent local improvement. Preserve user locks and already clear
   work. Prefer placement before detailed routing and main signal expression
   before bias, control, and power cleanup.
4. Express the change as supported generic typed edits. Keep each transaction at
   or below `maxTransactionEdits`; do not invent circuit-specific endpoints.
5. Dry-run risky connectivity, destructive, multi-object, or large routing
   changes. Commit against the exact current revision only after the dry run is
   acceptable.
6. Inspect returned diagnostics and a formal or diagnostic render. Repair the
   smallest responsible area, then continue.
7. Refresh the complete Snapshot after switching Documents, a stale revision,
   external changes, uncertain accumulated state, or before final global review.

On `STALE_REVISION`, discard the old transaction assumptions, refresh, and
reason again. On a limit error, split only the edit batch—not the electrical
interpretation. On a lock conflict, preserve the human result and find another
layout or ask for a decision. On an unresolved symbol/pin mapping, preserve the
source facts and request or add an explicit mapping.

## Obey hard boundaries

- MUST preserve electrical topology unless the user explicitly asks to change
  the circuit.
- MUST use the current revision and the shared Edit Engine.
- MUST preserve locked groups, constraints, annotations, Routes, and human-owned
  layout.
- MUST NOT merge Nets, create Junctions, or alter terminal membership merely to
  make a drawing easier.
- MUST NOT treat a wire crossing as connected without an explicit Junction.
- MUST NOT guess pin order, bulk connection, PDK mapping, or hierarchy target.
- MUST make every Document port visually discoverable at its placed port,
  connected Route, rail, or an attached local Net label. A heading, prose
  caption, or claimed "named-rail convention" is not connectivity expression.
- SHOULD choose among a connected trunk/rail, boundary port, or attached local
  label according to which is clearest in this render. Do not mechanically
  repeat labels or construct long shared rails when either creates more clutter
  than it resolves.
- SHOULD keep intentional crossings when they are clearer than a detour; crossing
  count alone is not a completion failure.
- MAY use an optional helper only as reviewable evidence or typed-edit expansion.
  The workflow must remain complete with every helper disabled.

## Complete the task

Before declaring completion:

1. Refresh the Snapshot and verify its revision matches the last committed edit.
2. Confirm every connected pin agrees with its Net terminal, no unintended Net
   membership changed, and no lock was bypassed.
3. Resolve all blocking diagnostics and all unintended flightlines, ambiguous
   Junctions, overlaps, off-page objects, or unresolved symbols.
4. Inventory every Document port and every label-based shared Net against the
   formal render. Confirm a reader can identify the relation through a compact
   trunk, boundary convention, or local label; do not rely on prose to fill a
   missing connection, and do not require one label at every device pin.
5. Review the formal render for signal flow, readable labels, distinguishable
   crossings/Junctions, useful hierarchy, and stable whitespace. Verify every
   annotation glyph rendered correctly; prefer plain ASCII punctuation in
   generated captions unless the renderer's font/encoding support was checked.
6. State any intentional warning or remaining uncertainty with affected object
   IDs. Do not hide it behind a successful render.

Knowledge pages are suggestions, not a checklist. Ignore or adapt a card when
its proposed mechanism makes the current formal render taller, denser, more
crossed, or more repetitive without improving comprehension. The completion
test is the visible result plus hard electrical invariants, not how many guidance
items were implemented.
