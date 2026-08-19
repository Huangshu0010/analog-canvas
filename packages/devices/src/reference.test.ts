import { describe, expect, it } from "vitest";

import { createEmptyDocument } from "@icm/model";

import {
  createReferenceIndex,
  nextReference,
  referencePolicyForInstance,
} from "./reference.js";

describe("ReferencePolicy and ReferenceIndex", () => {
  it("allocates the lowest free reviewed prefix suffix per Cell", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(
      {
        id: "R1",
        symbolId: "resistor",
        placement: null,
        netlist: { reference: "R1", parameters: {} },
      },
      {
        id: "R3",
        symbolId: "resistor",
        placement: null,
        netlist: { reference: "R3", parameters: {} },
      },
      {
        id: "M1",
        symbolId: "nmos",
        placement: null,
        netlist: { reference: "M1", parameters: {} },
      },
    );
    const index = createReferenceIndex(document);
    expect(
      nextReference(index, referencePolicyForInstance(document.instances[0]!)),
    ).toBe("R2");
    expect(
      nextReference(index, referencePolicyForInstance(document.instances[2]!)),
    ).toBe("M2");
  });

  it("reports missing, unexpected, prefix, and case-folded duplicate evidence", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(
      { id: "R1", symbolId: "resistor", placement: null },
      {
        id: "R2",
        symbolId: "resistor",
        placement: null,
        netlist: { reference: "C1", parameters: {} },
      },
      {
        id: "R3",
        symbolId: "resistor",
        placement: null,
        netlist: { reference: "c1", parameters: {} },
      },
      {
        id: "G1",
        symbolId: "ground",
        placement: null,
        netlist: { reference: "G1", parameters: {} },
      },
    );
    expect(
      createReferenceIndex(document).issues.map((issue) => issue.code),
    ).toEqual([
      "MISSING_REFERENCE",
      "WRONG_REFERENCE_PREFIX",
      "WRONG_REFERENCE_PREFIX",
      "UNEXPECTED_REFERENCE",
      "DUPLICATE_REFERENCE",
      "DUPLICATE_REFERENCE",
    ]);
  });

  it("does not allocate a reference already claimed by an invalid prefix", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: null,
      netlist: { reference: "X1", parameters: {} },
    });

    expect(
      nextReference(createReferenceIndex(document), {
        kind: "required",
        prefix: "X",
      }),
    ).toBe("X2");
  });
});
