import { describe, expect, it } from "vitest";

import { createHierarchicalBlockSymbol } from "./hierarchical-block.js";

describe("hierarchical block formal terminals", () => {
  it("derives pins only from the private formal cell interface", () => {
    const symbol = createHierarchicalBlockSymbol({
      name: "Child",
      sourceBinding: {
        cellName: "child",
        sourceRef: {
          fileId: "child.sp",
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 1, line: 1, column: 2 },
        },
      },
      netlist: {
        name: "child",
        terminals: [
          { name: "IN", netId: "net-in" },
          { name: "OUT", netId: "net-out" },
        ],
      },
    });

    expect(symbol?.pins.map((pin) => pin.name)).toEqual(["IN", "OUT"]);
  });
});
