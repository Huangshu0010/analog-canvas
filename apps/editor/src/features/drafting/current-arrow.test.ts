import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { copySelection, proposePaste } from "../clipboard/clipboard";

describe("route-attached current arrows", () => {
  it("copies a route-marker with its route VisualAnchor re-mapped on paste", () => {
    const document = createEmptyDocument("document-main", "Route marker");
    document.instances.push(
      {
        id: "R1",
        symbolId: "resistor",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
      {
        id: "R2",
        symbolId: "resistor",
        placement: {
          position: { x: 220, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    );
    document.nets.push({
      id: "net-signal",
      scope: "local",
      terminals: [
        { instanceId: "R1", pinName: "2" },
        { instanceId: "R2", pinName: "1" },
      ],
      ports: [],
    });
    document.routes.push({
      id: "route-signal",
      netId: "net-signal",
      from: { kind: "terminal", instanceId: "R1", pinName: "2" },
      to: { kind: "terminal", instanceId: "R2", pinName: "1" },
      waypoints: [],
      segmentModes: ["manual"],
    });
    document.annotations.push({
      id: "current-1",
      kind: "route-marker",
      markerKind: "current",
      text: "I_x",
      position: { x: 160, y: 100 },
      anchor: {
        kind: "route",
        routeId: "route-signal",
        segmentIndex: 0,
        t: 0.5,
        normalOffset: -14,
        direction: "forward",
        orientation: "follow",
        fallbackPosition: { x: 160, y: 100 },
      },
      offset: { x: 0, y: 0 },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });

    const copied = copySelection(document, ["R1", "R2"]);
    expect(copied?.annotations).toHaveLength(1);

    const proposal = proposePaste(document, copied!, { x: 20, y: 20 }, 1);
    const annotationEdit = proposal.edits.find(
      (edit) => edit.kind === "upsert_schematic_annotation",
    );
    expect(annotationEdit).toMatchObject({
      kind: "upsert_schematic_annotation",
      annotation: {
        id: "current-1-copy-1",
        kind: "route-marker",
        markerKind: "current",
        anchor: { routeId: "route-signal-copy-1" },
      },
    });
  });

  it("copies a route-bound current arrow with its internal route", () => {
    const document = createEmptyDocument("document-main", "Current arrow");
    document.instances.push(
      {
        id: "R1",
        symbolId: "resistor",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
      {
        id: "R2",
        symbolId: "resistor",
        placement: {
          position: { x: 220, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    );
    document.nets.push({
      id: "net-signal",
      scope: "local",
      terminals: [
        { instanceId: "R1", pinName: "2" },
        { instanceId: "R2", pinName: "1" },
      ],
      ports: [],
    });
    document.routes.push({
      id: "route-signal",
      netId: "net-signal",
      from: { kind: "terminal", instanceId: "R1", pinName: "2" },
      to: { kind: "terminal", instanceId: "R2", pinName: "1" },
      waypoints: [],
      segmentModes: ["manual"],
    });
    document.annotations.push({
      id: "current-1",
      kind: "route-marker",
      markerKind: "current",
      text: "I_x",
      position: { x: 160, y: 100 },
      anchor: {
        kind: "route",
        routeId: "route-signal",
        segmentIndex: 0,
        t: 0.5,
        normalOffset: -14,
        direction: "forward",
        orientation: "follow",
        fallbackPosition: { x: 160, y: 100 },
      },
      offset: { x: 0, y: 0 },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });

    const copied = copySelection(document, ["R1", "R2"]);
    expect(copied?.annotations).toHaveLength(1);

    const proposal = proposePaste(document, copied!, { x: 20, y: 20 }, 1);
    const annotationEdit = proposal.edits.find(
      (edit) => edit.kind === "upsert_schematic_annotation",
    );
    expect(annotationEdit).toMatchObject({
      kind: "upsert_schematic_annotation",
      annotation: {
        id: "current-1-copy-1",
        position: { x: 180, y: 120 },
        anchor: { routeId: "route-signal-copy-1" },
      },
    });
  });
});
