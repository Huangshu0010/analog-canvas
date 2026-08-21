import { resolveSchematicStyleProfile } from "@icm/derived";
import { createEmptyDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  defaultInstanceDisplayAnnotations,
  missingDefaultInstanceDisplayAnnotations,
} from "./default-instance-display";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("default instance display annotations", () => {
  it("creates a RichText schematic label and master label for an external call", () => {
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
          kind: "instance-schematic-name",
          instanceId: "opaque-import-id",
        },
      },
      {
        id: "instance-master-opaque-import-id",
        kind: "instance-value",
      },
    ]);
  });

  it("shows a formal Port terminal name as its only visible identity", () => {
    const document = createEmptyDocument("main", "Main");
    const instance = {
      id: "derived-internal-port-id",
      symbolId: "port",
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
        binding: { kind: "cell-terminal-name", terminalId: "terminal-input" },
      }),
    ]);
  });

  it("materializes a free Port label from its connected Net name", () => {
    const document = createEmptyDocument("main", "Main");
    const instance = {
      id: "P1",
      symbolId: "port",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
    };
    document.instances.push(instance);
    document.nets.push({
      id: "net-vin",
      name: "VIN",
      scope: "local",
      terminals: [{ instanceId: instance.id, pinName: "P" }],
    });

    expect(
      missingDefaultInstanceDisplayAnnotations(
        document,
        instance,
        resolver,
        resolveSchematicStyleProfile(document.presentation.styleProfileId),
      ),
    ).toEqual([
      expect.objectContaining({
        kind: "net-label",
        binding: { kind: "net-name", netId: "net-vin" },
        netId: "net-vin",
      }),
    ]);
  });

  it("materializes an imported reference once when a retained Instance is placed", () => {
    const document = createEmptyDocument("main", "Main");
    const instance = {
      id: "imported-resistor-opaque-id",
      symbolId: "resistor",
      schematicReference: "R7",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      netlist: { reference: "R7", parameters: { value: "10k" } },
    };

    const missing = missingDefaultInstanceDisplayAnnotations(
      document,
      instance,
      resolver,
      resolveSchematicStyleProfile(document.presentation.styleProfileId),
    );
    expect(missing).toEqual([
      expect.objectContaining({
        binding: {
          kind: "instance-schematic-name",
          instanceId: "imported-resistor-opaque-id",
        },
      }),
    ]);

    document.annotations.push(...missing);
    expect(
      missingDefaultInstanceDisplayAnnotations(
        document,
        instance,
        resolver,
        resolveSchematicStyleProfile(document.presentation.styleProfileId),
      ),
    ).toEqual([]);
  });
});
