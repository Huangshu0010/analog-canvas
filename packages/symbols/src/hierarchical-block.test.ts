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
          {
            id: "cell-terminal-in",
            name: "IN",
            netId: "net-in",
            direction: "input",
            interfaceInstanceId: "P1",
          },
          {
            id: "cell-terminal-out",
            name: "OUT",
            netId: "net-out",
            direction: "output",
            interfaceInstanceId: "P2",
          },
        ],
      },
    });

    expect(symbol?.pins.map((pin) => pin.name)).toEqual(["IN", "OUT"]);
  });

  it("creates a formal zero-terminal block for a manual Cell", () => {
    const symbol = createHierarchicalBlockSymbol({
      name: "Cell1",
      netlist: { name: "Cell1", terminals: [] },
    });

    expect(symbol).toMatchObject({
      name: "Cell1",
      hierarchicalBlock: true,
      viewBox: { x: -40, y: -20, width: 80, height: 40 },
      pins: [],
    });
  });
});
