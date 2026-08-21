# 0032 - Schematic label authority, formal Port display, and retained annotations

Status: `accepted`

Date: `2026-08-21`

Owners: `packages/model`, `packages/project-protocol`, `packages/derived`,
`packages/render-svg`, `packages/edit-engine`, `apps/editor`

Supersedes the formal-Port Reference and retained-annotation display clauses of
[ADR 0031](0031-schematic-reference-and-port-lifecycle.md).

## Context

`Instance.id` already owns placement, selection, connectivity, and deletion
lifecycle, and must never be shown as a label. Making an emitted network
designator the default text for every instance also made the visual label
plain-text-only even though the schematic supports RichText annotations. A
formal Cell Port's extra visible `P#` Reference duplicated its actual
interface name (for example `Vout`) and did not serve any identity purpose.
Separately, returning an Instance to the Placement Tray retained its
object-anchored annotations but rendered their fallback positions as orphaned
text.

## Decision

Project schema 18 makes `instance-schematic-name` the generic default label
binding. It resolves `Instance.schematicName` as the single user-visible,
RichText source; before the user edits it, it purely falls back to
`schematicReference`, then `netlist.reference`, and never to `Instance.id`.
`instance-designator` is retained only for an explicitly enabled, read-only
network-ID display.

A formal Cell Port instead uses `CellTerminal.name` as its sole visible
identity. A formal Port has no `Instance.schematicReference`; its stable
`Instance.id` remains the lifecycle identity. New formal Port creation, SPICE
import, validation, and edits enforce that separation.

All renderers, formal export bounds, editor hit testing, and marquee selection
use one annotation visibility rule: an object-anchored annotation is visible
only while its target Instance is placed. Return therefore keeps annotation
data and user positioning intact, hides it while retained, and restores it on
re-placement. Deletion remains the operation that removes annotations.

## Compatibility and migration

The reader accepts schema 17 and schema 18. The direct v17-to-v18 migration
rewrites ordinary default `instance-designator` annotations to
`instance-schematic-name`, preserving their placement and styling. For formal
Cell Ports it removes `schematicReference`, replaces the designator projection
with `cell-terminal-name`, and removes the redundant terminal-name projection.
It retains terminal IDs, terminal names, Net mappings, and `Instance.id`.
Serialization emits schema 18 only.

## Consequences

- `Vout` occupies the normal Reference slot for a formal Port; `P#` is never
  displayed or needed for lifecycle.
- Properties expose one primary `Schematic label` field rather than separate
  schematic-reference and alias text fields; RichText canvas editing writes
  `schematicName`.
- Ordinary non-formal components and Ports may retain an internal schematic
  reference and optional netlist designator without making either the primary
  editable label.
- Retained labels cannot remain as visible or clickable floating artifacts.
- Schema 16 and older are outside the rolling read window.

## Related documents

- [Project file format](../specs/project-file-format.md)
- [Schematic model](../specs/schematic-model.md)
- [Editor interaction](../specs/editor-interaction.md)
- [ADR 0031](0031-schematic-reference-and-port-lifecycle.md)
