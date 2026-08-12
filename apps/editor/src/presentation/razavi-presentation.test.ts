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
  it("materializes entry-boundary fallback without mutating the supplied Project", () => {
    const project = createEmptyProject("project-entry", "Entry");
    project.documents[0]!.instances.push(manualMos("M1", "nmos"));

    const prepared = materializeRazaviProjectBulkConnections(project);

    expect(prepared.instanceCount).toBe(1);
    expect(project.documents[0]!.nets).toEqual([]);
    expect(prepared.project.documents[0]!.nets[0]).toMatchObject({
      id: "net-global-0",
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
      terminals: [{ instanceId: "VDD1", pinName: "P" }],
      ports: [],
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

  it("recognizes a VDD symbol Net before legacy metadata normalization", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(manualMos("M4", "pmos"), {
      id: "VDD3",
      symbolId: "vdd",
      placement: null,
      properties: {},
    });
    document.nets.push({
      id: "net-ui-2",
      scope: "local",
      terminals: [{ instanceId: "VDD3", pinName: "P" }],
      ports: [],
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

  it("never guesses imported source data but applies the product fallback manually", () => {
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
    document.nets.push({
      id: "net-vdd",
      name: "VDD",
      scope: "global",
      terminals: [{ instanceId: "VDD1", pinName: "P" }],
      ports: [],
    });

    expect(
      razaviManualBulkConnectionEdits(document, document.instances),
    ).toEqual([{ kind: "reconcile_mos_bulk", instanceIds: ["MnoSupply"] }]);
  });
});
