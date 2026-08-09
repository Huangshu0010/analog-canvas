import { createEmptyDocument } from "@icm/model";
import { executeTransaction } from "@icm/edit-engine";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
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
      text: "M1",
      position: { x: 100, y: 150 },
      attachedObjectId: "M1",
      offset: { x: 0, y: 50 },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });
    document.annotations.push({
      id: "free-net-label",
      kind: "net-label",
      text: "VIN",
      position: { x: 220, y: 100 },
      offset: { x: 0, y: 0 },
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
