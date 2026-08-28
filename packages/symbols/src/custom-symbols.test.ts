import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@icm/model";
import type { CustomSymbolDefinition } from "@icm/model";

import {
  createCustomSymbol,
  createProjectCustomSymbols,
  customSymbolId,
  findCustomSymbolIdConflicts,
} from "./custom-symbols.js";
import {
  createProjectSymbolResolver,
  findUnsupportedProjectSymbolIds,
} from "./resolver.js";
import type { SymbolDefinition } from "./schema.js";

const catalogResistor: SymbolDefinition = {
  schemaVersion: 1,
  id: "resistor",
  name: "Resistor",
  viewBox: { x: -20, y: -10, width: 40, height: 20 },
  pins: [
    {
      name: "1",
      role: "passive",
      at: { x: -20, y: 0 },
      direction: "west",
      presentation: { visibility: "visible" },
    },
    {
      name: "2",
      role: "passive",
      at: { x: 20, y: 0 },
      direction: "east",
      presentation: { visibility: "visible" },
    },
  ],
  primitives: [{ kind: "line", from: { x: -10, y: 0 }, to: { x: 10, y: 0 } }],
  variants: [],
};

/** Imported artwork whose own id deliberately matches a catalog asset. */
const collidingArtworkDefinition: CustomSymbolDefinition = {
  id: "def-resistor-clone",
  symbol: {
    ...catalogResistor,
    name: "Lookalike Resistor",
    primitives: [{ kind: "line", from: { x: -12, y: 0 }, to: { x: 12, y: 0 } }],
  },
};

describe("custom symbol namespace (ADR 0047)", () => {
  it("derives a stable namespaced runtime ID", () => {
    expect(customSymbolId("def-resistor-clone")).toBe(
      customSymbolId("def-resistor-clone"),
    );
    expect(customSymbolId("def-resistor-clone")).toMatch(
      /^custom-symbol-[0-9a-f]{16}$/u,
    );
    expect(customSymbolId("def-resistor-clone")).not.toBe(
      customSymbolId("def-other"),
    );
  });

  it("re-keys embedded artwork to the definition identity", () => {
    const runtime = createCustomSymbol(collidingArtworkDefinition);
    expect(runtime.id).toBe(customSymbolId("def-resistor-clone"));
    expect(runtime.name).toBe("Lookalike Resistor");
    expect(runtime.pins.map((pin) => pin.name)).toEqual(["1", "2"]);
  });

  it("never lets imported artwork shadow a catalog symbol", () => {
    const project = createEmptyProject("custom-shadow", "Shadow");
    project.customSymbolDefinitions.push(collidingArtworkDefinition);
    const resolver = createProjectSymbolResolver(project, [catalogResistor]);

    expect(resolver.resolve("resistor")?.definition.name).toBe("Resistor");
    expect(
      resolver.resolve(customSymbolId("def-resistor-clone"))?.definition.name,
    ).toBe("Lookalike Resistor");
    expect(
      resolver.resolve(customSymbolId("def-resistor-clone"))?.definition
        .primitives,
    ).not.toEqual(catalogResistor.primitives);
  });

  it("resolves instances placed on a custom symbol and does not report them unsupported", () => {
    const project = createEmptyProject("custom-place", "Place");
    project.customSymbolDefinitions.push(collidingArtworkDefinition);
    project.documents[0]!.instances.push({
      id: "U1",
      symbolId: customSymbolId("def-resistor-clone"),
      placement: null,
    });

    const resolver = createProjectSymbolResolver(project, [catalogResistor]);
    expect(
      resolver.resolve(customSymbolId("def-resistor-clone"))?.definition.pins
        .length,
    ).toBe(2);
    expect(findUnsupportedProjectSymbolIds(project, [catalogResistor])).toEqual(
      [],
    );
  });

  it("still reports an instance that names a removed custom symbol", () => {
    const project = createEmptyProject("custom-gone", "Gone");
    project.documents[0]!.instances.push({
      id: "U1",
      symbolId: customSymbolId("def-removed"),
      placement: null,
    });
    expect(findUnsupportedProjectSymbolIds(project, [catalogResistor])).toEqual(
      [customSymbolId("def-removed")],
    );
  });

  it("reports no conflicts for a well-formed project", () => {
    const project = createEmptyProject("custom-clean", "Clean");
    project.customSymbolDefinitions.push(collidingArtworkDefinition);
    expect(findCustomSymbolIdConflicts(project, [catalogResistor])).toEqual([]);
  });

  it("reports a custom definition whose derived ID collides with a base symbol", () => {
    const project = createEmptyProject("custom-collide", "Collide");
    project.customSymbolDefinitions.push(collidingArtworkDefinition);
    // Forge the pathological case: a base definition that already occupies
    // the custom namespace's derived runtime ID. The namespace scheme makes
    // this unreachable through ordinary authoring; the check must still
    // report it instead of crashing the resolver.
    const occupiedId = customSymbolId(collidingArtworkDefinition.id);
    const squattingBase: SymbolDefinition = {
      ...catalogResistor,
      id: occupiedId,
      name: "Squatter",
    };
    const conflicts = findCustomSymbolIdConflicts(project, [squattingBase]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toEqual({
      definitionId: collidingArtworkDefinition.id,
      conflictingSymbolId: occupiedId,
    });
  });

  it("reports a custom definition colliding with an earlier duplicate definition", () => {
    const project = createEmptyProject("custom-dupe", "Dupe");
    project.customSymbolDefinitions.push(
      collidingArtworkDefinition,
      collidingArtworkDefinition,
    );
    const conflicts = findCustomSymbolIdConflicts(project, [catalogResistor]);
    expect(conflicts).toEqual([
      {
        definitionId: collidingArtworkDefinition.id,
        conflictingSymbolId: customSymbolId(collidingArtworkDefinition.id),
      },
    ]);
  });

  it("maps every persisted definition through the project projection", () => {
    const project = createEmptyProject("custom-many", "Many");
    project.customSymbolDefinitions.push(collidingArtworkDefinition, {
      id: "def-decorative",
      symbol: {
        schemaVersion: 1,
        id: "note-arrow",
        name: "Note Arrow",
        viewBox: { x: -10, y: -10, width: 20, height: 20 },
        pins: [],
        primitives: [
          { kind: "line", from: { x: -5, y: 5 }, to: { x: 5, y: -5 } },
        ],
        variants: [],
        decorative: true,
      },
    });
    const symbols = createProjectCustomSymbols(project);
    expect(symbols.map((symbol) => symbol.id)).toEqual([
      customSymbolId("def-resistor-clone"),
      customSymbolId("def-decorative"),
    ]);
    expect(symbols[1]?.decorative).toBe(true);
  });
});
