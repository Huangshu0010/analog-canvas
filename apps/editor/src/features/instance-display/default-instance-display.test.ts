import { resolveSchematicStyleProfile } from "@icm/derived";
import { createEmptyDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { defaultInstanceDisplayAnnotations } from "./default-instance-display";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("default instance display annotations", () => {
  it("creates an electrical designator and master label for an external call", () => {
    const document = createEmptyDocument("main", "Main");
    const instance = {
      id: "opaque-import-id",
      symbolId: "resistor",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      netlist: {
        reference: "X1",
        binding: {
          kind: "external-subcircuit" as const,
          definitionId: "master-opamp",
        },
        parameters: {},
      },
    };
    const annotations = defaultInstanceDisplayAnnotations(
      document,
      instance,
      resolver,
      resolveSchematicStyleProfile(document.presentation.styleProfileId),
      { masterName: "sky130_fd_pr__nfet_01v8" },
    );

    expect(annotations).toMatchObject([
      {
        kind: "instance-label",
        binding: {
          kind: "instance-designator",
          instanceId: "opaque-import-id",
        },
      },
      {
        id: "instance-master-opaque-import-id",
        kind: "instance-value",
      },
    ]);
  });

  it("shows the Port reference and formal terminal name separately", () => {
    const document = createEmptyDocument("main", "Main");
    const instance = {
      id: "derived-internal-port-id",
      symbolId: "port",
      schematicReference: "P1",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
    };
    const annotations = defaultInstanceDisplayAnnotations(
      document,
      instance,
      resolver,
      resolveSchematicStyleProfile(document.presentation.styleProfileId),
      { formalTerminalId: "terminal-input" },
    );

    expect(annotations).toEqual([
      expect.objectContaining({
        binding: {
          kind: "instance-designator",
          instanceId: "derived-internal-port-id",
        },
      }),
      expect.objectContaining({
        binding: { kind: "cell-terminal-name", terminalId: "terminal-input" },
      }),
    ]);
  });
});
