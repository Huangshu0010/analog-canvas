import type { RouteEndpoint } from "@icm/model";
import { describe, expect, it } from "vitest";

import {
  createFreeWireAnchor,
  createRouteWireAnchor,
  proposeWireCommit,
  proposeWireCommitThroughContacts,
} from "./routing-planner.js";
import type { WireSource } from "./routing-planner.js";

function source(
  endpoint: RouteEndpoint,
  point: { x: number; y: number },
  netId: string | null = null,
  routePresentation?: WireSource["routePresentation"],
): WireSource {
  return {
    endpoint,
    point,
    netId,
    preludeEdits: [],
    ...(routePresentation ? { routePresentation } : {}),
  };
}

describe("wire editing proposals", () => {
  it("orders anchor preludes before merging existing nets", () => {
    const from = createFreeWireAnchor({ x: 0, y: 0 }, "net-a", false, 3);
    const to = createFreeWireAnchor({ x: 40, y: 0 }, "net-b", false, 4);
    const proposal = proposeWireCommit(from, to, [], 5);

    expect(proposal.netId).toBe("net-a");
    expect(proposal.edits.map((edit) => edit.kind)).toEqual([
      "add_junction",
      "add_junction",
      "merge_nets",
      "connect_endpoints",
      "set_route_points",
    ]);
    expect(proposal.edits[2]).toEqual({
      kind: "merge_nets",
      targetNetId: "net-a",
      sourceNetId: "net-b",
    });
    expect(proposal.edits[3]).not.toHaveProperty("newNetId");
  });

  it("does not short another pin on a selected endpoint device", () => {
    const from = source(
      { kind: "terminal", instanceId: "R1", pinName: "2" },
      { x: 0, y: 0 },
    );
    const to = source(
      { kind: "terminal", instanceId: "R2", pinName: "1" },
      { x: 80, y: 40 },
    );
    const proposal = proposeWireCommitThroughContacts(
      from,
      to,
      [],
      [
        source(
          { kind: "terminal", instanceId: "R2", pinName: "2" },
          { x: 80, y: 0 },
        ),
        source(
          { kind: "terminal", instanceId: "C1", pinName: "1" },
          { x: 40, y: 0 },
        ),
      ],
      14,
    );

    const routed = proposal.edits.filter(
      (edit) => edit.kind === "set_route_points",
    );
    expect(routed).toHaveLength(2);
    expect(routed).toEqual([
      expect.objectContaining({
        from: from.endpoint,
        to: { kind: "terminal", instanceId: "C1", pinName: "1" },
      }),
      expect.objectContaining({
        from: { kind: "terminal", instanceId: "C1", pinName: "1" },
        to: to.endpoint,
      }),
    ]);
    expect(
      proposal.edits.some(
        (edit) =>
          edit.kind === "connect_endpoints" &&
          [edit.from, edit.to].some(
            (endpoint) =>
              endpoint.kind === "terminal" &&
              endpoint.instanceId === "R2" &&
              endpoint.pinName === "2",
          ),
      ),
    ).toBe(false);
  });
});
