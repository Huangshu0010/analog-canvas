import { createEmptyDocument, createEmptyProject } from "@icm/model";
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
});
