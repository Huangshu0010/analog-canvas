import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import {
  bindingForEditedModel,
  initialInstanceNetlist,
  nextInstanceReference,
} from "./netlist-authoring";

describe("netlist authoring", () => {
  it("allocates the lowest unused reference by reviewed device prefix", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(
      {
        id: "a",
        symbolId: "resistor",
        placement: null,
        properties: {},
        netlist: { reference: "R1", parameters: {} },
      },
      {
        id: "b",
        symbolId: "resistor",
        placement: null,
        properties: {},
        netlist: { reference: "R3", parameters: {} },
      },
    );
    expect(nextInstanceReference(document, "resistor")).toBe("R2");
    expect(nextInstanceReference(document, "nmos")).toBe("M1");
  });

  it("creates typed primitive facts while leaving MOS model explicit", () => {
    const document = createEmptyDocument("main", "Main");
    expect(
      initialInstanceNetlist(document, "resistor", { value: "10k" }),
    ).toEqual({
      reference: "R1",
      binding: { kind: "primitive", deviceClass: "resistor" },
      parameters: { value: "10k" },
    });
    expect(
      initialInstanceNetlist(document, "nmos", { w: "2u", l: "60n" }),
    ).toEqual({
      reference: "M1",
      parameters: { w: "2u", l: "60n" },
    });
  });

  it("creates a model binding only from explicit edited text", () => {
    expect(bindingForEditedModel("nmos", " nch_mac ")).toEqual({
      kind: "model",
      deviceClass: "mos",
      name: "nch_mac",
    });
    expect(bindingForEditedModel("nmos", "")).toBeUndefined();
  });
});
