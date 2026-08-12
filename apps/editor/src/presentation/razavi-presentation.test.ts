import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { razaviManualBulkConnectionEdits } from "./razavi-presentation";

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
  it("connects a new manual MOS bulk only to its matching explicit global supply", () => {
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
        kind: "connect_endpoints",
        from: { kind: "terminal", instanceId: "M4", pinName: "B" },
        to: { kind: "terminal", instanceId: "VDD1", pinName: "P" },
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
        kind: "connect_endpoints",
        from: { kind: "terminal", instanceId: "M4", pinName: "B" },
        to: { kind: "terminal", instanceId: "VDD3", pinName: "P" },
      },
    ]);
  });

  it("never guesses a body short for imported or supply-less MOS", () => {
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
    ).toEqual([]);
  });
});
