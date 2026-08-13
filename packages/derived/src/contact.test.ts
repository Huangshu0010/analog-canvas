import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { deriveVisibleConnectivity } from "./connectivity.js";
import { deriveDocumentContactEvidence } from "./contact.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

function contactedResistorDocument() {
  const document = createEmptyDocument("contacted-resistor", "Contact");
  document.instances.push({
    id: "R1",
    symbolId: "resistor",
    placement: {
      position: { x: 100, y: 120 },
      rotation: 0,
      mirror: "none",
    },
    properties: {},
  });
  document.ports.push(
    {
      id: "left",
      name: "left",
      direction: "passive",
      position: { x: 60, y: 100 },
    },
    {
      id: "right",
      name: "right",
      direction: "passive",
      position: { x: 140, y: 100 },
    },
  );
  document.nets.push({
    id: "net-out",
    scope: "local",
    terminals: [{ instanceId: "R1", pinName: "1" }],
    ports: ["left", "right"],
  });
  document.junctions.push({
    id: "junction-out",
    netId: "net-out",
    position: { x: 100, y: 100 },
    role: "branch",
  });
  document.routes.push(
    {
      id: "route-left",
      netId: "net-out",
      from: { kind: "port", portId: "left" },
      to: { kind: "junction", junctionId: "junction-out" },
      waypoints: [],
      segmentModes: ["manual"],
    },
    {
      id: "route-right",
      netId: "net-out",
      from: { kind: "junction", junctionId: "junction-out" },
      to: { kind: "port", portId: "right" },
      waypoints: [],
      segmentModes: ["manual"],
    },
  );
  return document;
}

describe("coincident contact evidence", () => {
  it("contracts a same-Net terminal and Junction without treating crossings as contacts", () => {
    const document = contactedResistorDocument();
    const evidence = deriveDocumentContactEvidence(document, resolver);
    const contact = evidence.byEndpointKey.get("junction:junction-out");

    expect(contact?.endpoints).toEqual([
      { kind: "junction", junctionId: "junction-out" },
      { kind: "terminal", instanceId: "R1", pinName: "1" },
    ]);
    expect(contact?.branchDirections).toEqual([
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ]);
    expect(
      deriveVisibleConnectivity(document, resolver)[0]?.components,
    ).toHaveLength(1);
  });
});
