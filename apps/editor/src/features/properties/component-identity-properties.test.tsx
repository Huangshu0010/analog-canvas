import { createEmptyDocument } from "@icm/model";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ComponentIdentityProperties,
  componentTargetDescription,
} from "./component-identity-properties";

describe("component identity properties", () => {
  it("describes a built-in primitive target", () => {
    const document = createEmptyDocument("cell", "Cell");
    const instance: (typeof document.instances)[number] = {
      id: "R1",
      symbolId: "resistor",
      placement: null,
      netlist: {
        reference: "R1",
        parameters: {},
        binding: { kind: "primitive", deviceClass: "resistor" },
      },
    };
    expect(componentTargetDescription(instance)).toBe(
      "Built-in primitive: resistor",
    );
  });

  it("renders identity, editable marker name, and model suggestions", () => {
    const document = createEmptyDocument("cell", "Cell");
    const instance: (typeof document.instances)[number] = {
      id: "M1",
      symbolId: "nmos",
      placement: null,
      netlist: { reference: "M1", parameters: {} },
    };
    const markup = renderToStaticMarkup(
      <ComponentIdentityProperties
        instance={instance}
        revision={0}
        cellName="Cell"
        formalTerminalSelected={false}
        portNet={{ id: "net", logicalName: "VDD", supply: true }}
        targetDescription={null}
        capacitorPlateRows={null}
        modelTarget={{
          defaultValue: "sky130_fd_pr__nfet_01v8",
          suggestions: ["sky130_fd_pr__nfet_01v8"],
          listId: "mos-model-options-nmos",
          externalSubcircuit: false,
        }}
        onMarkerNameChange={vi.fn()}
        onSchematicNameChange={vi.fn()}
        onReferenceChange={vi.fn()}
        onModelTargetChange={vi.fn()}
      />,
    );
    expect(markup).toContain('aria-label="Supply name"');
    expect(markup).toContain("sky130_fd_pr__nfet_01v8");
  });
});
