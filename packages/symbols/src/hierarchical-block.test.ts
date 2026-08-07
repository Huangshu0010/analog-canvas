import { describe, expect, it } from "vitest";

import { createHierarchicalBlockSymbol } from "./hierarchical-block.js";

describe("hierarchical block symbols", () => {
  const sourceBinding = {
    cellName: "cell",
    sourceRef: {
      fileId: "file-circuit",
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 1, line: 1, column: 2 },
    },
  };
  const ports = (names: string[]) =>
    names.map((name, index) => ({
      id: `port-${index}`,
      name,
      position: { x: 0, y: index * 10 },
      direction: "bidirectional" as const,
    }));

  it("offers a presentation-only implicit-supply variant", () => {
    const symbol = createHierarchicalBlockSymbol({
      name: "inverter",
      sourceBinding: { ...sourceBinding, cellName: "inv" },
      ports: ports(["a", "y", "VDD", "vss"]),
    });

    expect(symbol?.pins.map((pin) => pin.name)).toEqual([
      "a",
      "y",
      "VDD",
      "vss",
    ]);
    expect(symbol?.variants).toEqual([
      {
        id: "implicit-supplies",
        hiddenPinNames: ["VDD", "vss"],
      },
    ]);
  });

  it("does not add an empty variant when the cell has no supply ports", () => {
    const symbol = createHierarchicalBlockSymbol({
      name: "buffer",
      sourceBinding: { ...sourceBinding, cellName: "buf" },
      ports: ports(["a", "y"]),
    });

    expect(symbol?.variants).toEqual([]);
  });
});
