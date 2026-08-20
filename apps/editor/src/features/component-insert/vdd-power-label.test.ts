import { executeTransaction } from "@icm/edit-engine";
import { AnnotationSchema, createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { proposedStandalonePowerConnection } from "./placement-connectivity";
import { vddPowerLabelAnnotation } from "./vdd-power-label";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("vdd power label annotation", () => {
  it("builds a schema-valid power label anchored to the device instance", () => {
    const annotation = vddPowerLabelAnnotation({
      instanceId: "VDD3",
      netId: "net-power-vdd3",
      position: { x: 120, y: 80 },
    });
    expect(AnnotationSchema.parse(annotation)).toEqual(annotation);
    expect(annotation).toMatchObject({
      id: "power-label-vdd3",
      kind: "power-label",
      netId: "net-power-vdd3",
      anchor: {
        kind: "object",
        objectId: "VDD3",
        localOffset: { x: 10, y: 10 },
        fallbackPosition: { x: 130, y: 90 },
      },
    });
    expect(annotation.binding).toEqual({
      kind: "net-name",
      netId: "net-power-vdd3",
    });
  });

  it("never collides with the drawn rail label id namespace", () => {
    const annotation = vddPowerLabelAnnotation({
      instanceId: "VDD1",
      netId: "net-power-vdd1",
      position: { x: 0, y: 0 },
    });
    // The rail owns `label-VDDn`; the device label must not upsert over it.
    expect(annotation.id).not.toBe("label-VDD1");
  });

  it("commits together with the standalone power connection edits", () => {
    const document = createEmptyDocument("main", "Main");
    const instance = {
      id: "VDD1",
      symbolId: "vdd-port",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
    };
    const proposal = proposedStandalonePowerConnection(document, instance);
    const powerNetId = proposal.powerNetId;
    expect(powerNetId).toBeDefined();
    const result = executeTransaction(
      document,
      {
        transactionId: "vdd-label-test",
        documentId: "main",
        expectedRevision: 0,
        actor: { kind: "human" as const, id: "test" },
        dryRun: false,
        edits: [
          { kind: "add_instance", instance },
          ...proposal.edits,
          {
            kind: "upsert_schematic_annotation",
            annotation: vddPowerLabelAnnotation({
              instanceId: "VDD1",
              netId: powerNetId!,
              position: { x: 100, y: 100 },
            }),
          },
        ],
      },
      { symbolResolver: resolver },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.annotations).toHaveLength(1);
    expect(result.document.annotations[0]).toMatchObject({
      id: "power-label-vdd1",
      kind: "power-label",
      netId: "net-power-vdd1",
    });
  });
});
