import { describe, expect, it } from "vitest";

import { createEmptyDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";

import {
  annotationAnchor,
  attachmentAtPoint,
  defaultInstanceLabel,
  effectiveRouteAttachment,
  looseRouteAnchorIds,
} from "./route-interaction-geometry";
import { resolveSchematicStyleProfile } from "@icm/render-svg";

const resolver = new InMemorySymbolResolver(builtInSymbols);

function looseRouteDocument() {
  const document = createEmptyDocument("route-geometry", "Route geometry");
  document.nets.push({
    id: "net-1",
    scope: "local",
    terminals: [],
    ports: [],
  });
  document.junctions.push(
    {
      id: "j1",
      netId: "net-1",
      position: { x: 0, y: 0 },
      role: "route-anchor",
    },
    {
      id: "j2",
      netId: "net-1",
      position: { x: 100, y: 0 },
      role: "route-anchor",
    },
  );
  document.routes.push({
    id: "route-1",
    netId: "net-1",
    from: { kind: "junction", junctionId: "j1" },
    to: { kind: "junction", junctionId: "j2" },
    waypoints: [],
    segmentModes: ["manual"],
  });
  return document;
}

describe("route interaction geometry", () => {
  it("recognizes a free route backed by two loose route anchors", () => {
    const document = looseRouteDocument();
    expect(looseRouteAnchorIds(document, document.routes[0]!)).toEqual([
      "j1",
      "j2",
    ]);

    document.junctions[0]!.role = "branch";
    document.routes.push({
      ...document.routes[0]!,
      id: "route-branch",
      to: { kind: "junction", junctionId: "j1" },
    });
    expect(looseRouteAnchorIds(document, document.routes[0]!)).toBeNull();
  });

  it("projects to the nearest route segment and resolves a route VisualAnchor", () => {
    const document = looseRouteDocument();
    const record = {
      route: document.routes[0]!,
      polyline: {
        routeId: "route-1",
        netId: "net-1",
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        segmentModes: ["manual" as const],
      },
    };
    const attached = attachmentAtPoint([record], { x: 75, y: 12 });
    expect(attached).toEqual({
      routeAttachment: {
        routeId: "route-1",
        segmentIndex: 0,
        t: 0.75,
        direction: "forward",
        normalOffset: -14,
      },
      position: { x: 75, y: 0 },
    });

    const marker = {
      id: "current-1",
      kind: "route-marker" as const,
      markerKind: "current" as const,
      text: "I_1",
      position: { x: -1, y: -1 },
      anchor: {
        kind: "route" as const,
        routeId: "route-1",
        segmentIndex: 0,
        t: 0.5,
        normalOffset: -14,
        direction: "forward" as const,
        orientation: "follow" as const,
        fallbackPosition: { x: -1, y: -1 },
      },
      offset: { x: 0, y: 0 },
      alignment: "middle" as const,
      rotation: 0 as const,
      locked: false,
    };
    expect(effectiveRouteAttachment(marker)?.t).toBe(0.5);
    expect(annotationAnchor(marker, [record])).toEqual({ x: 50, y: 0 });
  });

  it("builds an implicit instance label only while no explicit label exists", () => {
    const document = createEmptyDocument("labels", "Labels");
    const instance = {
      id: "R1",
      symbolId: "resistor",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    document.instances.push(instance);
    const profile = resolveSchematicStyleProfile(
      document.presentation.styleProfileId,
    );
    const label = defaultInstanceLabel(document, instance, resolver, profile);
    expect(label).toMatchObject({
      id: "instance-label-R1",
      kind: "instance-label",
      text: "R1",
      attachedObjectId: "R1",
    });
    document.annotations.push(label!);
    expect(
      defaultInstanceLabel(document, instance, resolver, profile),
    ).toBeNull();
  });
});
