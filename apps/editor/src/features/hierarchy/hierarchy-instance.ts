import type { SchematicDocument } from "@icm/model";
import { hierarchicalSymbolId } from "@icm/symbols";

export function createHierarchyInstance(
  id: string,
  child: Pick<SchematicDocument, "id" | "netlist">,
  placement: NonNullable<SchematicDocument["instances"][number]["placement"]>,
): SchematicDocument["instances"][number] {
  if (!child.netlist) {
    throw new Error(`Cell has no formal interface: ${child.id}`);
  }
  return {
    id,
    symbolId: hierarchicalSymbolId(child.netlist.name),
    placement,
    properties: {},
    netlist: {
      reference: id,
      parameters: {},
      terminals: child.netlist.terminals.map((terminal, sourcePosition) => ({
        sourcePosition,
        pinName: terminal.name,
      })),
      binding: {
        kind: "subcircuit",
        childDocumentId: child.id,
        name: child.netlist.name,
      },
    },
  };
}
