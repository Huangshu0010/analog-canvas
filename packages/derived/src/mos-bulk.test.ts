import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import {
  mosBulkShouldBeVisible,
  resolveMosBulkConnection,
} from "./mos-bulk.js";

function mos(id: string, symbolId: "nmos" | "pmos") {
  return {
    id,
    symbolId,
    symbolVariantId: "textbook-3terminal",
    placement: null,
    properties: {},
  };
}

describe("MOS bulk resolution", () => {
  it("prefers explicit membership over defaults and exposes body bias", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(mos("M1", "nmos"));
    document.nets.push(
      {
        id: "net-vss",
        name: "VSS",
        scope: "global",
        terminals: [],
        ports: [],
      },
      {
        id: "net-body",
        name: "VBODY",
        scope: "local",
        terminals: [{ instanceId: "M1", pinName: "B" }],
        ports: [],
      },
    );
    document.mosBulkDefaults = { nmosNetId: "net-vss" };

    expect(resolveMosBulkConnection(document, "M1")).toMatchObject({
      status: "explicit",
      net: { id: "net-body" },
    });
    expect(mosBulkShouldBeVisible(document, "M1")).toBe(true);
  });

  it("uses the stable cell default before the named product fallback", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(mos("M1", "nmos"));
    document.nets.push(
      {
        id: "net-cell-substrate",
        name: "SUBSTRATE",
        scope: "local",
        terminals: [],
        ports: [],
      },
      {
        id: "net-vss",
        name: "VSS",
        scope: "global",
        terminals: [],
        ports: [],
      },
    );
    document.mosBulkDefaults = { nmosNetId: "net-cell-substrate" };

    expect(resolveMosBulkConnection(document, "M1")).toMatchObject({
      status: "cell-default",
      net: { id: "net-cell-substrate" },
      materialized: false,
    });
  });

  it("keeps a materialized Cell default visually implicit", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(mos("M1", "nmos"));
    document.nets.push({
      id: "net-cell-substrate",
      name: "SUBSTRATE",
      scope: "local",
      terminals: [{ instanceId: "M1", pinName: "B" }],
      ports: [],
    });
    document.mosBulkDefaults = { nmosNetId: "net-cell-substrate" };

    expect(mosBulkShouldBeVisible(document, "M1")).toBe(false);
  });

  it("does not guess when imported fourth-node evidence is missing", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push({
      ...mos("M1", "pmos"),
      sourceRef: {
        fileId: "source.sp",
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 1, line: 1, column: 2 },
      },
    });

    expect(resolveMosBulkConnection(document, "M1")).toMatchObject({
      status: "unresolved",
      net: undefined,
    });
  });
});
