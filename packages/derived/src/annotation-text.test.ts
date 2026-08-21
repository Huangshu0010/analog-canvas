import {
  createEmptyDocument,
  flattenRichText,
  semanticTextDocument,
} from "@icm/model";
import { describe, expect, it } from "vitest";

import { resolveAnnotationText } from "./annotation-text.js";

describe("bound annotation text", () => {
  it("separates the electrical designator from the user-owned schematic name", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push({
      id: "M1",
      symbolId: "nmos",
      placement: null,
      netlist: { reference: "M_INTERNAL", parameters: {} },
      schematicName: {
        runs: [
          {
            kind: "span",
            style: "bold",
            children: [{ kind: "text", value: "M" }],
          },
          {
            kind: "span",
            style: "overbar",
            children: [{ kind: "text", value: "1" }],
          },
        ],
      },
    });
    const annotation = {
      id: "instance-label-M1",
      kind: "instance-label" as const,
      binding: { kind: "instance-designator" as const, instanceId: "M1" },
      anchor: { kind: "free" as const, position: { x: 0, y: 0 } },
      alignment: "start" as const,
      rotation: 0 as const,
      locked: false,
    };

    expect(resolveAnnotationText(document, annotation)).toEqual(
      semanticTextDocument("M_INTERNAL", "instance-label"),
    );
    expect(
      resolveAnnotationText(document, {
        ...annotation,
        binding: { kind: "instance-schematic-name", instanceId: "M1" },
      }),
    ).toEqual(document.instances[0]!.schematicName);
    expect(document.instances[0]!.netlist!.reference).toBe("M_INTERNAL");
  });

  it("projects a Net name without touching its movable route anchor", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.nets.push({
      id: "net-vin",
      name: "V_{in,cm}",
      scope: "local",
      terminals: [],
    });
    const annotation = {
      id: "net-label-route-1",
      kind: "net-label" as const,
      binding: { kind: "net-name" as const, netId: "net-vin" },
      netId: "net-vin",
      anchor: {
        kind: "route" as const,
        routeId: "route-1",
        segmentIndex: 2,
        t: 0.7,
        normalOffset: 60,
        direction: "reverse" as const,
        orientation: "horizontal" as const,
        fallbackPosition: { x: 120, y: 80 },
      },
      alignment: "middle" as const,
      rotation: 0 as const,
      locked: false,
    };

    const before = structuredClone(annotation.anchor);
    expect(flattenRichText(resolveAnnotationText(document, annotation))).toBe(
      "Vin,cm",
    );
    document.nets[0]!.name = "V_{refp}";
    expect(flattenRichText(resolveAnnotationText(document, annotation))).toBe(
      "Vrefp",
    );
    expect(annotation.anchor).toEqual(before);
  });

  it("projects a master name without falling back to the internal object ID", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push({
      id: "opaque-object-id",
      symbolId: "nmos",
      placement: null,
      netlist: {
        reference: "M1",
        binding: { kind: "model", deviceClass: "mos", name: "sky130_nfet" },
        parameters: {},
      },
    });
    const annotation = {
      id: "master-M1",
      kind: "instance-label" as const,
      binding: {
        kind: "instance-master-name" as const,
        instanceId: "opaque-object-id",
      },
      anchor: { kind: "free" as const, position: { x: 0, y: 0 } },
      alignment: "start" as const,
      rotation: 0 as const,
      locked: false,
    };

    expect(flattenRichText(resolveAnnotationText(document, annotation))).toBe(
      "sky130nfet",
    );
  });
});
