import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@icm/model";
import type { Annotation } from "@icm/model";
import { InMemorySymbolResolver } from "@icm/symbols";

import { resolveNetLabelBinding } from "./net-label";

function fixture() {
  const document = createEmptyDocument("main", "Main");
  document.ports = [
    {
      id: "left",
      name: "left",
      direction: "passive",
      position: { x: 0, y: 100 },
    },
    {
      id: "right",
      name: "right",
      direction: "passive",
      position: { x: 200, y: 100 },
    },
  ];
  document.nets = [
    {
      id: "signal",
      scope: "local",
      terminals: [],
      ports: ["left", "right"],
    },
  ];
  document.junctions = [
    { id: "left-stub", netId: "signal", position: { x: 40, y: 100 } },
    { id: "right-stub", netId: "signal", position: { x: 160, y: 100 } },
  ];
  document.routes = [
    {
      id: "left-route",
      netId: "signal",
      from: { kind: "port", portId: "left" },
      to: { kind: "junction", junctionId: "left-stub" },
      waypoints: [],
      segmentModes: ["manual"],
    },
    {
      id: "right-route",
      netId: "signal",
      from: { kind: "junction", junctionId: "right-stub" },
      to: { kind: "port", portId: "right" },
      waypoints: [],
      segmentModes: ["manual"],
    },
  ];
  return document;
}

function label(netId: string, x = 180): Annotation {
  return {
    id: "label",
    kind: "net-label",
    content: { runs: [{ kind: "text", value: "SIGNAL" }] },
    netId,
    anchor: { kind: "free", position: { x, y: 92 } },
    alignment: "middle",
    rotation: 0,
    locked: false,
  };
}

describe("Net Label binding", () => {
  const resolver = new InMemorySymbolResolver([]);

  it("uses netId as the electrical identity and resolves its nearest Route", () => {
    expect(
      resolveNetLabelBinding(fixture(), resolver, label("signal")),
    ).toEqual({
      annotationId: "label",
      netId: "signal",
      routeId: "right-route",
      segmentIndex: 0,
      endpoint: { kind: "junction", junctionId: "right-stub" },
    });
  });

  it("rejects the legacy Junction-id overload", () => {
    expect(
      resolveNetLabelBinding(fixture(), resolver, label("right-stub")),
    ).toBeNull();
  });
});
