# Schematic hierarchy

Analog Canvas treats every Project Document as one reusable schematic Cell.
The top Cell is the export root; other Cells may be instantiated any number of
times or kept unreferenced while they are being authored.

Use **New Cell** in the Cell navigation bar to create a module without first
drawing a rectangle. **Place Cell** opens the normal Insert dialog with a
searchable **Cells** section. Select a definition, then place its ordinary
hierarchical Instance on the canvas using the same grid preview, `R` rotation,
mirror shortcuts, and `Esc` cancellation as a library component. The commit
creates the subcircuit Instance, its `Xn` reference label, and a Cell-name
value label together. **Enter Cell** opens the child of a selected hierarchical
Instance. **Up** follows the actual parent Instance path; **Top** returns to
the root. Opening a shared Cell from the selector has no caller context when
more than one path reaches it, which is reported in the status bar.

To define a real Cell port:

1. Choose **Add Cell Port**, give it a name, direction (`input`, `output`,
   `inout`, or `passive`), and optional filled marker.
2. Click an exact existing electrical contact to attach to its Net, or click
   empty grid space to create a new local Net.

The command commits an ordinary `port`/`port-filled` Instance, its pin-`P`
connection, and the formal Cell terminal as one revision. **Expose Port**
remains the advanced adoption path for an already drawn and connected marker.

Open **Cell Interface** in the navigation bar to edit each formal port's
direction, order, and definition-level visual side/offset. Direction is an
electrical fact; side and offset only change the generated external symbol and
therefore affect every caller without changing Net membership.

The visible marker remains an ordinary Instance, so selection, move, wiring,
clipboard, and normal Instance deletion use the same editor protocol as other
components. The formal interface adds stable identity, ordering, direction,
and the Net binding used by parent blocks and netlist export.

Select an exposed marker to **Rename Port** or **Delete Port**. Rename updates
all connected parent Instances atomically. Deletion is rejected while a parent
still references that pin, or while wire geometry is attached; remove those
uses first. **Delete Cell** removes only a non-top, unreferenced Cell definition.
Deleting a hierarchical Instance with the normal Delete command never deletes
its reusable child Cell.

Rectangles remain drafting geometry. Selecting an unlocked rectangle and using
**Enter Cell** is only a convenience gesture: the commit removes the rectangle,
creates a child Cell, and places an ordinary hierarchical Instance. Saved
hierarchy never depends on rectangle drawing data.
