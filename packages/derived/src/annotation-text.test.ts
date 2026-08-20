import { createEmptyDocument, flattenRichText } from "@icm/model";
import { describe, expect, it } from "vitest";

import { resolveAnnotationText } from "./annotation-text.js";

describe("bound annotation text", () => {
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
});
