import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { deriveVisibleConnectivity } from "./connectivity.js";
import {
  contactRequiresJunctionDot,
  deriveDocumentContactEvidence,
} from "./contact.js";
import { resolveElectricalContactTargets } from "./contact-target.js";

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
  it("groups duplicate segment and endpoint hits by visible conductor", () => {
    const document = contactedResistorDocument();
    const targets = resolveElectricalContactTargets(document, resolver, [
      {
        kind: "endpoint",
        id: "junction",
        point: { x: 100, y: 100 },
        netId: "net-out",
        endpoint: { kind: "junction", junctionId: "junction-out" },
      },
      {
        kind: "route",
        id: "left-segment",
        point: { x: 100, y: 100 },
        netId: "net-out",
        routeId: "route-left",
        segmentIndex: 0,
      },
      {
        kind: "route",
        id: "right-segment",
        point: { x: 100, y: 100 },
        netId: "net-out",
        routeId: "route-right",
        segmentIndex: 0,
      },
    ]);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.candidates).toHaveLength(3);
    expect(targets[0]?.endpoint?.id).toBe("junction");
  });

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
    expect(contact && contactRequiresJunctionDot(contact)).toBe(true);
    expect(
      deriveVisibleConnectivity(document, resolver)[0]?.components,
    ).toHaveLength(1);
  });

  it("does not turn a same-Net geometric pass-through into a contact", () => {
    const document = contactedResistorDocument();
    document.junctions = [];
    document.routes = [
      {
        id: "route-through",
        netId: "net-out",
        from: { kind: "port", portId: "left" },
        to: { kind: "port", portId: "right" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    ];

    const evidence = deriveDocumentContactEvidence(document, resolver);
    const contact = evidence.byEndpointKey.get("terminal:R1:1");

    expect(contact?.routeArmCount).toBe(0);
    expect(contact?.branchDirections).toEqual([{ x: 0, y: 1 }]);
    expect(contact && contactRequiresJunctionDot(contact)).toBe(false);
    expect(
      deriveVisibleConnectivity(document, resolver)[0]?.components,
    ).toHaveLength(2);
  });

  it("dots three authored Route arms even when two are collinear", () => {
    const document = createEmptyDocument("collinear-branch", "Collinear");
    document.nets.push({
      id: "net-branch",
      scope: "local",
      terminals: [],
      ports: [],
    });
    document.junctions.push(
      {
        id: "center",
        netId: "net-branch",
        position: { x: 100, y: 100 },
        role: "branch",
      },
      ...[60, 140, 180].map((x, index) => ({
        id: `end-${index}`,
        netId: "net-branch",
        position: { x, y: 100 },
        role: "route-anchor" as const,
      })),
    );
    document.routes.push(
      ...document.junctions.slice(1).map((junction, index) => ({
        id: `route-${index}`,
        netId: "net-branch",
        from: { kind: "junction" as const, junctionId: "center" },
        to: { kind: "junction" as const, junctionId: junction.id },
        waypoints: [],
        segmentModes: ["manual" as const],
      })),
    );

    const contact = deriveDocumentContactEvidence(
      document,
      resolver,
    ).byEndpointKey.get("junction:center");

    expect(contact?.routeArmCount).toBe(3);
    expect(contact?.branchDirections).toEqual([
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(contact && contactRequiresJunctionDot(contact)).toBe(true);
  });

  it("dots a terminal plus two authored Route arms even when they are collinear", () => {
    const document = createEmptyDocument("mixed-branch", "Mixed branch");
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
        id: "left-a",
        name: "left-a",
        direction: "passive",
        position: { x: 40, y: 100 },
      },
      {
        id: "left-b",
        name: "left-b",
        direction: "passive",
        position: { x: 20, y: 100 },
      },
    );
    document.nets.push({
      id: "net-mixed",
      scope: "local",
      terminals: [{ instanceId: "R1", pinName: "1" }],
      ports: ["left-a", "left-b"],
    });
    document.routes.push(
      {
        id: "route-a",
        netId: "net-mixed",
        from: { kind: "terminal", instanceId: "R1", pinName: "1" },
        to: { kind: "port", portId: "left-a" },
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-b",
        netId: "net-mixed",
        from: { kind: "terminal", instanceId: "R1", pinName: "1" },
        to: { kind: "port", portId: "left-b" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    );

    const contact = deriveDocumentContactEvidence(
      document,
      resolver,
    ).contacts.find(
      (candidate) => candidate.point.x === 100 && candidate.point.y === 100,
    );

    expect(contact?.routeArmCount).toBe(2);
    expect(contact?.incidents).toHaveLength(3);
    expect(contact?.branchDirections).toHaveLength(2);
    expect(contact && contactRequiresJunctionDot(contact)).toBe(true);
  });
});
