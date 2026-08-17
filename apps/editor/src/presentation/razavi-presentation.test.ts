import {
  createEmptyDocument,
  createEmptyProject,
  semanticTextDocument,
  validateNetContract,
} from "@icm/model";
import { describe, expect, it } from "vitest";

import {
  materializeRazaviProjectBulkConnections,
  razaviManualBulkConnectionEdits,
} from "./razavi-presentation";

function manualMos(id: string, symbolId: "nmos" | "pmos") {
  return {
    id,
    symbolId,
    symbolVariantId: "textbook-3terminal",
    placement: null,
    properties: {},
  };
}

describe("Razavi hidden bulk policy", () => {
  it("materializes a configured entry-boundary default without mutating the supplied Project", () => {
    const project = createEmptyProject("project-entry", "Entry");
    const document = project.documents[0]!;
    document.instances.push(manualMos("M1", "nmos"));
    document.nets.push({
      id: "net-ground",
      name: "0",
      scope: "global",
      powerDomain: "ground",
      terminals: [],
    });
    document.mosBulkDefaults = { nmosNetId: "net-ground" };

    const prepared = materializeRazaviProjectBulkConnections(project);

    expect(prepared.instanceCount).toBe(1);
    expect(project.documents[0]!.nets[0]!.terminals).toEqual([]);
    expect(prepared.project.documents[0]!.nets[0]).toMatchObject({
      id: "net-ground",
      terminals: [{ instanceId: "M1", pinName: "B" }],
    });
  });

  it("delegates matching-supply materialization to the Edit Engine", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(manualMos("M4", "pmos"));
    document.nets.push({
      id: "net-vdd",
      name: "VDD",
      scope: "global",
      powerDomain: "vdd",
      terminals: [],
    });
    document.mosBulkDefaults = { pmosNetId: "net-vdd" };

    expect(
      razaviManualBulkConnectionEdits(document, document.instances),
    ).toEqual([
      {
        kind: "reconcile_mos_bulk",
        instanceIds: ["M4"],
      },
    ]);
  });

  it("reuses an unconfigured global VDD supply Net", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(manualMos("M4", "pmos"));
    document.nets.push({
      id: "net-ui-2",
      name: "VDD",
      scope: "global",
      powerDomain: "vdd",
      terminals: [],
    });

    expect(
      razaviManualBulkConnectionEdits(document, document.instances),
    ).toEqual([
      {
        kind: "reconcile_mos_bulk",
        instanceIds: ["M4"],
      },
    ]);
  });

  it("applies a supply default only to manual MOS instances", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(
      {
        ...manualMos("Ximported", "nmos"),
        sourceRef: {
          fileId: "source.sp",
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 1, line: 1, column: 2 },
        },
      },
      manualMos("MnoSupply", "nmos"),
    );
    expect(
      razaviManualBulkConnectionEdits(document, document.instances),
    ).toEqual([
      {
        kind: "reconcile_mos_bulk",
        instanceIds: ["MnoSupply"],
      },
    ]);
  });

  it("creates and materializes both canonical supply defaults at entry", () => {
    const project = createEmptyProject("project-entry", "Entry");
    const document = project.documents[0]!;
    document.instances.push(manualMos("MN", "nmos"), manualMos("MP", "pmos"));

    const prepared = materializeRazaviProjectBulkConnections(project);
    const preparedDocument = prepared.project.documents[0]!;

    expect(prepared.instanceCount).toBe(2);
    expect(preparedDocument.nets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "net-global-0",
          name: "0",
          scope: "global",
          powerDomain: "ground",
          terminals: [{ instanceId: "MN", pinName: "B" }],
        }),
        expect.objectContaining({
          id: "net-global-vdd",
          name: "VDD",
          scope: "global",
          powerDomain: "vdd",
          terminals: [{ instanceId: "MP", pinName: "B" }],
        }),
      ]),
    );
  });

  it("repairs compatible legacy ground duplicates before installing the Project", () => {
    const project = createEmptyProject("project-entry", "Entry");
    const document = project.documents[0]!;
    document.nets.push(
      {
        id: "net-ground-a",
        name: "0",
        scope: "global",
        powerDomain: "ground",
        terminals: [],
      },
      {
        id: "net-ground-b",
        name: "0",
        scope: "global",
        powerDomain: "ground",
        terminals: [],
      },
    );

    const prepared = materializeRazaviProjectBulkConnections(project);

    expect(prepared.repairCount).toBe(1);
    expect(prepared.project.documents[0]!.nets).toEqual([
      expect.objectContaining({ id: "net-ground-a", name: "0" }),
    ]);
    expect(validateNetContract(prepared.project.documents[0]!)).toEqual([]);
    expect(project.documents[0]!.nets).toHaveLength(2);
  });

  it("retargets every source-Net reference during legacy ground repair", () => {
    const project = createEmptyProject("project-entry", "Entry");
    const document = project.documents[0]!;
    document.instances.push(
      {
        id: "GND1",
        symbolId: "ground",
        placement: null,
        properties: {},
      },
      {
        ...manualMos("M1", "nmos"),
        mosBulkBinding: { origin: "supply-default", netId: "net-ground-b" },
      },
    );
    document.nets.push(
      {
        id: "net-ground-a",
        name: "0",
        scope: "global",
        powerDomain: "ground",
        terminals: [],
      },
      {
        id: "net-ground-b",
        name: "0",
        scope: "global",
        powerDomain: "ground",
        terminals: [
          { instanceId: "GND1", pinName: "0" },
          { instanceId: "M1", pinName: "B" },
        ],
      },
    );
    document.junctions.push(
      {
        id: "junction-source-a",
        netId: "net-ground-b",
        position: { x: 100, y: 100 },
      },
      {
        id: "junction-source-b",
        netId: "net-ground-b",
        position: { x: 200, y: 100 },
      },
    );
    document.routes.push({
      id: "route-source",
      netId: "net-ground-b",
      from: { kind: "junction", junctionId: "junction-source-a" },
      to: { kind: "junction", junctionId: "junction-source-b" },
      waypoints: [],
      segmentModes: ["manual"],
    });
    document.annotations.push({
      id: "label-source",
      kind: "net-label",
      content: semanticTextDocument("0", "net-label"),
      netId: "net-ground-b",
      anchor: {
        kind: "route",
        routeId: "route-source",
        segmentIndex: 0,
        t: 0.5,
        normalOffset: -10,
        direction: "forward",
        orientation: "follow",
        fallbackPosition: { x: 150, y: 90 },
      },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });
    document.netlist!.terminals.push({ name: "VSS", netId: "net-ground-b" });

    const prepared = materializeRazaviProjectBulkConnections(project);
    const repaired = prepared.project.documents[0]!;

    expect(prepared.repairCount).toBe(1);
    expect(repaired.nets).toEqual([
      expect.objectContaining({
        id: "net-ground-a",
        terminals: [
          { instanceId: "GND1", pinName: "0" },
          { instanceId: "M1", pinName: "B" },
        ],
      }),
    ]);
    expect(repaired.routes).toEqual([
      expect.objectContaining({ netId: "net-ground-a" }),
    ]);
    expect(repaired.junctions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ netId: "net-ground-a" }),
      ]),
    );
    expect(repaired.annotations).toEqual([
      expect.objectContaining({ netId: "net-ground-a" }),
    ]);
    expect(repaired.instances.find((item) => item.id === "M1")).toMatchObject({
      mosBulkBinding: { netId: "net-ground-a" },
    });
    expect(repaired.netlist!.terminals).toEqual([
      { name: "VSS", netId: "net-ground-a" },
    ]);
  });
});
