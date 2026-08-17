import { describe, expect, it } from "vitest";

import {
  createEmptyDocument,
  createEmptyProject,
  type DraftRectangle,
} from "@icm/model";
import { createProjectSymbolResolver, builtInSymbols } from "@icm/symbols";

import { convertRectangleToHierarchy } from "./rectangle-to-cell";

function rectangle(locked = false): DraftRectangle {
  return {
    id: "rectangle-1",
    kind: "rectangle",
    locked,
    zIndex: 0,
    anchor: { kind: "free", position: { x: 100, y: 120 } },
    center: { x: 100, y: 120 },
    width: 120,
    height: 80,
    rotation: 90,
    lineStyle: "solid",
  };
}

describe("rectangle to hierarchical Cell conversion", () => {
  it("atomically replaces a rectangle with a formal child Cell instance", () => {
    const source = createEmptyProject("manual-hierarchy", "Manual hierarchy");
    source.documents[0]!.drafting!.objects.push(rectangle());

    const converted = convertRectangleToHierarchy(
      source,
      source.topDocumentId,
      "rectangle-1",
    );
    const parent = converted.project.documents.find(
      (document) => document.id === source.topDocumentId,
    )!;
    const child = converted.project.documents.find(
      (document) => document.id === converted.childDocumentId,
    )!;

    expect(source.documents).toHaveLength(1);
    expect(parent.revision).toBe(1);
    expect(parent.drafting?.objects).toEqual([]);
    expect(child).toMatchObject({
      id: "document-cell-1",
      name: "Cell1",
      netlist: { name: "Cell1", terminals: [] },
      instances: [],
    });
    expect(child.presentation).toEqual(parent.presentation);
    expect(parent.instances).toEqual([
      expect.objectContaining({
        id: "X1",
        placement: {
          position: { x: 100, y: 120 },
          rotation: 90,
          mirror: "none",
        },
        netlist: expect.objectContaining({
          reference: "X1",
          binding: {
            kind: "subcircuit",
            name: "Cell1",
            childDocumentId: "document-cell-1",
          },
        }),
      }),
    ]);
    const resolver = createProjectSymbolResolver(
      converted.project,
      builtInSymbols,
    );
    expect(
      resolver.resolve(parent.instances[0]!.symbolId)?.definition.pins,
    ).toEqual([]);
  });

  it("allocates collision-free Cell, Document, and instance identities", () => {
    const source = createEmptyProject("manual-hierarchy", "Manual hierarchy");
    source.documents.push(createEmptyDocument("document-cell-1", "Cell1"));
    source.documents[0]!.instances.push({
      id: "X1",
      symbolId: "resistor",
      placement: null,
      properties: {},
      netlist: { reference: "X1", parameters: {} },
    });
    source.documents[0]!.drafting!.objects.push(rectangle());

    const converted = convertRectangleToHierarchy(
      source,
      source.topDocumentId,
      "rectangle-1",
    );

    expect(converted).toMatchObject({
      cellName: "Cell2",
      childDocumentId: "document-cell-2",
      instanceId: "X2",
    });
  });

  it("rejects a locked rectangle without mutating the source Project", () => {
    const source = createEmptyProject("manual-hierarchy", "Manual hierarchy");
    source.documents[0]!.drafting!.objects.push(rectangle(true));

    expect(() =>
      convertRectangleToHierarchy(source, source.topDocumentId, "rectangle-1"),
    ).toThrow("Unlock rectangle rectangle-1");
    expect(source.documents).toHaveLength(1);
    expect(source.documents[0]!.drafting?.objects).toHaveLength(1);
  });
});
