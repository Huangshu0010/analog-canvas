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
      viewBox: { x: -50, y: -30, width: 100, height: 60 },
      pins: [],
    });
    expect(symbol?.primitives[0]).toMatchObject({
      kind: "polygon",
      fill: "none",
      stroke: "foreground",
    });
    expect(
      symbol?.primitives[0]?.kind === "polygon"
        ? symbol.primitives[0].points
        : [],
    ).toHaveLength(4);
  });

  it("uses direction-aware sides, adaptive body width, and stable explicit pin placement", () => {
    const symbol = createHierarchicalBlockSymbol({
      name: "GainStage",
      netlist: {
        name: "GainStage",
        terminals: [
          {
            id: "terminal-vin",
            name: "VERY_LONG_INPUT",
            netId: "net-in",
            direction: "input",
            interfaceInstanceId: "P1",
          },
          {
            id: "terminal-vout",
            name: "OUT",
            netId: "net-out",
            direction: "output",
            interfaceInstanceId: "P2",
          },
          {
            id: "terminal-vdd",
            name: "VDD",
            netId: "net-vdd",
            direction: "passive",
            interfaceInstanceId: "P3",
          },
        ],
      },
      presentation: {
        styleProfileId: "razavi-textbook-v1",
        grid: 10,
        compactness: "normal",
        cellSymbol: {
          pinPlacements: [
            { terminalId: "terminal-vdd", side: "north", offset: 20 },
          ],
          pinLabelPlacements: [
            {
              terminalId: "terminal-vout",
              inwardOffset: 20,
            },
          ],
        },
      },
    });

    expect(symbol?.pins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "VERY_LONG_INPUT",
          direction: "west",
        }),
        expect.objectContaining({ name: "OUT", direction: "east" }),
        expect.objectContaining({
          name: "VDD",
          at: { x: 20, y: -30 },
          direction: "north",
        }),
      ]),
    );
    expect(
      symbol?.pins.find((pin) => pin.name === "OUT")?.presentation,
    ).toMatchObject({
      labelOffset: { x: -34, y: 0 },
    });
    expect(symbol?.viewBox.width).toBeGreaterThan(100);
    expect(
      symbol?.pins.every((pin) => pin.at.x % 10 === 0 && pin.at.y % 10 === 0),
    ).toBe(true);
  });

  it("keeps dense long-name interfaces grid-aligned on every body edge", () => {
    const terminals = Array.from({ length: 12 }, (_, index) => ({
      id: `terminal-${index}`,
      name: `VERY_LONG_SIGNAL_${index + 1}`,
      netId: `net-${index}`,
      direction: index % 2 === 0 ? ("input" as const) : ("output" as const),
      interfaceInstanceId: `P${index + 1}`,
    }));
    const symbol = createHierarchicalBlockSymbol({
      name: "DenseStage",
      netlist: { name: "DenseStage", terminals },
      presentation: {
        styleProfileId: "razavi-textbook-v1",
        grid: 10,
        compactness: "normal",
        cellSymbol: {
          pinPlacements: [
            { terminalId: "terminal-0", side: "north", offset: -40 },
            { terminalId: "terminal-1", side: "south", offset: 40 },
          ],
        },
      },
    });

    expect(symbol?.pins).toHaveLength(12);
    expect(symbol?.viewBox.width).toBeGreaterThanOrEqual(220);
    expect(symbol?.viewBox.height).toBeGreaterThanOrEqual(100);
    expect(
      symbol?.pins.map((pin) => `${pin.direction}:${pin.at.x}:${pin.at.y}`),
    ).toHaveLength(
      new Set(
        symbol?.pins.map((pin) => `${pin.direction}:${pin.at.x}:${pin.at.y}`),
      ).size,
    );
    expect(
      symbol?.pins.every((pin) => pin.at.x % 10 === 0 && pin.at.y % 10 === 0),
    ).toBe(true);
  });
});
