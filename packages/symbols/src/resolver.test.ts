import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@icm/model";

import { hierarchicalSymbolId } from "./hierarchical-block.js";
import {
  createProjectSymbolResolver,
  findUnsupportedProjectSymbolIds,
  InMemorySymbolResolver,
} from "./resolver.js";
import { SymbolDefinitionSchema } from "./schema.js";

const resistor = {
  schemaVersion: 1 as const,
  id: "resistor",
  name: "Resistor",
  viewBox: { x: -20, y: -10, width: 40, height: 20 },
  pins: [
    {
      name: "1",
      role: "passive",
      at: { x: -20, y: 0 },
      direction: "west" as const,
      presentation: { visibility: "visible" as const },
    },
    {
      name: "2",
      role: "passive",
      at: { x: 20, y: 0 },
      direction: "east" as const,
      presentation: { visibility: "visible" as const },
    },
  ],
  primitives: [
    { kind: "line" as const, from: { x: -10, y: 0 }, to: { x: 10, y: 0 } },
  ],
  variants: [{ id: "compact", hiddenPinNames: [] }],
  aliases: ["res"],
};

describe("Symbol Resolver boundary", () => {
  it("resolves canonical IDs, aliases, and variants", () => {
    const resolver = new InMemorySymbolResolver([resistor]);
    expect(resolver.resolve("res")?.definition.id).toBe("resistor");
    expect(resolver.resolve("resistor", "compact")?.variant?.id).toBe(
      "compact",
    );
    expect(resolver.resolve("missing")).toBeUndefined();
  });

  it("rejects duplicate electrical pin names", () => {
    expect(
      SymbolDefinitionSchema.safeParse({
        ...resistor,
        pins: [resistor.pins[0], resistor.pins[0]],
      }).success,
    ).toBe(false);
  });

  it("does not remove an electrical pin when a variant hides it", () => {
    const hidden = SymbolDefinitionSchema.parse({
      ...resistor,
      variants: [{ id: "implicit-terminal", hiddenPinNames: ["2"] }],
    });
    expect(hidden.pins.map((pin) => pin.name)).toEqual(["1", "2"]);
  });

  it("does not generate a compatibility block for an unknown symbol", () => {
    const resolver = new InMemorySymbolResolver([resistor]);
    expect(resolver.resolve("generic-block-5")).toBeUndefined();
    expect(resolver.resolve("generic-block-0")).toBeUndefined();
  });

  it("derives a named hierarchy symbol from the imported Document interface", () => {
    const project = createEmptyProject("project-test", "Hierarchy Test");
    const document = project.documents[0]!;
    document.name = "Filter Cell";
    document.sourceBinding = {
      cellName: "filter_cell",
      sourceRef: {
        fileId: "source-main",
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 1, line: 1, column: 2 },
      },
    };
    document.ports = ["IN", "OUT", "VSS"].map((name, index) => ({
      id: `port-${index}`,
      name,
      direction: "passive",
      position: null,
    }));

    const resolver = createProjectSymbolResolver(project, [resistor]);
    const definition = resolver.resolve(
      hierarchicalSymbolId("filter_cell"),
    )?.definition;
    expect(definition?.name).toBe("Filter Cell");
    expect(definition?.pins.map((pin) => pin.name)).toEqual([
      "IN",
      "OUT",
      "VSS",
    ]);
    expect(definition?.pins.every((pin) => pin.presentation.showName)).toBe(
      true,
    );
  });

  it("reports unsupported Project device symbols without rejecting hierarchy", () => {
    const project = createEmptyProject("coverage", "Coverage");
    project.documents[0]!.instances.push({
      id: "D1",
      symbolId: "diode",
      placement: null,
      properties: {},
    });
    expect(findUnsupportedProjectSymbolIds(project, [resistor])).toEqual([
      "diode",
    ]);
  });
});
