import { createEmptyDocument, createEmptyProject } from "@icm/model";
import {
  executeTransaction,
  proposeVisualRouteDeletion,
} from "@icm/edit-engine";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  collectVisualRouteDeletion,
  explicitAnnotationRemovals,
  proposeConnectedInstanceDeletion,
} from "./delete-selection";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("connected instance deletion", () => {
  it("does not remove an attached label twice in a mixed marquee deletion", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push({
      id: "M1",
      symbolId: "nmos",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0,
        mirror: "none",
      },
      properties: {},
    });
    document.annotations.push({
      id: "label-M1",
      kind: "instance-label",
      content: { runs: [{ kind: "text", value: "M1" }] },
      anchor: {
        kind: "object",
        objectId: "M1",
        localOffset: { x: 0, y: 50 },
        fallbackPosition: { x: 100, y: 150 },
      },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });
    document.annotations.push({
      id: "free-net-label",
      kind: "net-label",
      content: { runs: [{ kind: "text", value: "VIN" }] },
      netId: "net-1",
      anchor: { kind: "free", position: { x: 220, y: 100 } },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });

    expect(
      explicitAnnotationRemovals(
        document,
        ["M1"],
        ["label-M1", "free-net-label"],
      ),
    ).toEqual(["free-net-label"]);
  });

  it("preserves routed wire geometry as a dangling Junction", () => {
    const document = createEmptyDocument("document-main", "Main");
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
          position: { x: 240, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    );
    document.nets.push({
      id: "net-1",
      scope: "local",
      terminals: [
        { instanceId: "R1", pinName: "2" },
        { instanceId: "R2", pinName: "1" },
      ],
      ports: [],
    });
    document.routes.push({
      id: "route-1",
      netId: "net-1",
      from: { kind: "terminal", instanceId: "R1", pinName: "2" },
      to: { kind: "terminal", instanceId: "R2", pinName: "1" },
      waypoints: [{ x: 100, y: 80 }],
      segmentModes: ["manual", "manual"],
    });

    const result = executeTransaction(
      document,
      {
        transactionId: "delete-connected",
        documentId: document.id,
        expectedRevision: 0,
        actor: { kind: "human", id: "test" },
        edits: proposeConnectedInstanceDeletion(document, resolver, ["R1"], 1),
      },
      { symbolResolver: resolver },
    );
    expect(result).toMatchObject({
      ok: true,
      document: {
        instances: [{ id: "R2" }],
        nets: [{ terminals: [{ instanceId: "R2", pinName: "1" }] }],
        junctions: [
          {
            id: "junction-delete-1-1",
            position: { x: 100, y: 120 },
          },
        ],
        routes: [
          {
            from: { kind: "junction", junctionId: "junction-delete-1-1" },
            to: { kind: "terminal", instanceId: "R2", pinName: "1" },
          },
        ],
      },
    });
  });
});

function documentWithJunctionRoute() {
  const document = createEmptyProject("delete-routes", "Delete routes")
    .documents[0]!;
  document.nets.push({
    id: "net-1",
    name: "N1",
    scope: "local",
    terminals: [],
    ports: [],
  });
  document.junctions.push(
    { id: "junction-left", netId: "net-1", position: { x: 100, y: 100 } },
    { id: "junction-right", netId: "net-1", position: { x: 200, y: 100 } },
  );
  document.routes.push({
    id: "route-1",
    netId: "net-1",
    from: { kind: "junction", junctionId: "junction-left" },
    to: { kind: "junction", junctionId: "junction-right" },
    waypoints: [],
    segmentModes: ["auto"],
  });
  return document;
}

describe("collectVisualRouteDeletion", () => {
  it("cleans both orphan junction endpoints when a route is deleted", () => {
    expect(
      collectVisualRouteDeletion(documentWithJunctionRoute(), ["route-1"], []),
    ).toEqual({
      routeIds: ["route-1"],
      junctionIds: ["junction-left", "junction-right"],
    });
  });

  it("deletes every route attached to a selected junction before removing it", () => {
    expect(
      collectVisualRouteDeletion(
        documentWithJunctionRoute(),
        [],
        ["junction-left"],
      ),
    ).toEqual({
      routeIds: ["route-1"],
      junctionIds: ["junction-left", "junction-right"],
    });
  });

  it("submits the visual deletion closure without duplicate junction removals", () => {
    const document = documentWithJunctionRoute();
    const proposal = proposeVisualRouteDeletion(document, ["route-1"], []);
    expect(proposal.edits).toEqual([
      { kind: "cut_connection", routeId: "route-1" },
    ]);
    const result = executeTransaction(
      document,
      {
        transactionId: "delete-route",
        documentId: document.id,
        expectedRevision: 0,
        actor: { kind: "human", id: "test" },
        edits: proposal.edits,
      },
      { symbolResolver: resolver },
    );
    expect(result).toMatchObject({
      ok: true,
      document: { routes: [], junctions: [] },
    });
  });
});
