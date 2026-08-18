# Schematic hierarchy

Analog Canvas treats every Project Document as one reusable schematic Cell.
The top Cell is the export root; other Cells may be instantiated any number of
times or kept unreferenced while they are being authored.

Use **Cell → Manage Cells…** to manage the Project's definitions in one place. It shows each
Cell's formal port and caller counts, opens or renames a definition, and lists
each caller with **Jump to caller**. A referenced Cell's delete control is
disabled; delete its caller Instances normally before deleting the now
unreferenced definition.

Use **New Cell** in the Cell Manager to create a module without first drawing
a rectangle. **Cell → Place Cell** opens the normal Insert dialog with a
searchable **Cells** section. Select a definition, then place its ordinary
hierarchical Instance on the canvas using the same grid preview, `R` rotation,
mirror shortcuts, and `Esc` cancellation as a library component. The commit
keeps the `Xn` reference as internal netlist identity and shows only the Cell
name at the normal instance-label position. **Enter Cell** opens the child of a selected hierarchical
Instance. **Up** follows the actual parent Instance path; **Top** returns to
the root. Opening a shared Cell from the selector has no caller context when
more than one path reaches it, which is reported in the status bar.

Only a non-top Cell has a reusable symbol interface: the top Cell is the
Project export root and is never instantiated as a symbol. To define a real
port on a non-top Cell:

1. Choose **Cell → Edit Interface… → Add Port**, give it a name, direction (`input`, `output`,
   `inout`, or `passive`), and optional filled marker.
2. Click an exact existing electrical contact to attach to its Net, or click
   empty grid space to create a new local Net.

The command commits an ordinary `port`/`port-filled` Instance, its pin-`P`
connection, and the formal Cell terminal as one revision. **Expose Selected**
remains the advanced adoption path for an already drawn and connected marker.

Open **Cell → Edit Interface…** to edit each formal port's
direction, order, and definition-level visual side/offset. Direction is an
electrical fact; side and offset only change the generated external symbol and
therefore affect every caller without changing Net membership.

The visible marker remains an ordinary Instance, so selection, move, wiring,
clipboard, and normal Instance deletion use the same editor protocol as other
components. The formal interface adds stable identity, ordering, direction,
and the Net binding used by parent blocks and netlist export.

Select an exposed marker, then use **Rename Selected** or **Delete Selected**
in the interface dialog. Rename updates
all connected parent Instances atomically. Deletion is rejected while a parent
still references that pin, or while wire geometry is attached; remove those
uses first. **Delete Cell** removes only a non-top, unreferenced Cell definition.
Deleting a hierarchical Instance with the normal Delete command never deletes
its reusable child Cell.

Rectangles remain drafting geometry. Selecting an unlocked rectangle and using
**Enter Cell** is only a convenience gesture: the commit removes the rectangle,
creates a child Cell, and places an ordinary hierarchical Instance. Saved
hierarchy never depends on rectangle drawing data.

Hierarchy presentation is saved as definition-level size and pin-placement
intent in Project schema 13. Older schema-12 projects open with deterministic
automatic pin layout; schema-11 files are outside the supported rolling
compatibility window. The block uses a closed polygon body and the shared
Razavi rich-text renderer for pin and Cell names; it is compatible with that
visual grammar rather than a pixel-for-pixel textbook symbol asset.
