import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { endpointKey, resolveRouteGeometry } from "@icm/derived";
import type { RouteEndpoint, SchematicDocument } from "@icm/model";
import { parseProject } from "@icm/project-protocol";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { executeTransaction } from "./transaction.js";
import { DocumentHistory } from "./history.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);
const context = { symbolResolver: resolver };
const terminal = (instanceId: string): RouteEndpoint => ({
  kind: "terminal",
  instanceId,
  pinName: "P",
});

function fixture(): SchematicDocument {
  const document = parseProject(
    readFileSync(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-3-routing/project.icproj.json",
      ),
      "utf8",
    ),
  ).documents[0]!;
  document.instances = document.instances.filter((instance) =>
    ["A", "B"].includes(instance.id),
  );
  document.nets = [
    {
      id: "net-contact",

      terminals: [
        { instanceId: "A", pinName: "P" },
        { instanceId: "B", pinName: "P" },
      ],
    },
  ];
  document.netlist!.terminals = ["A", "B"].map((instanceId) => ({
    id: `cell-terminal-${instanceId.toLowerCase()}`,
    name: instanceId,
    netId: "net-contact",
    direction: "passive" as const,
    interfaceInstanceIds: [instanceId],
  }));
  document.connectivityEvidence = [];
  document.instances.find((instance) => instance.id === "B")!.placement = {
    position: { x: 160, y: 300 },
    rotation: 0,
    mirror: "x",
  };
  return document;
}

function transaction(
  document: SchematicDocument,
  edits: unknown[],
  suffix = "edit",
) {
  return {
    transactionId: `direct-contact-${suffix}-${document.revision}`,
    documentId: document.id,
    expectedRevision: document.revision,
    actor: { kind: "human" as const, id: "direct-contact-test" },
    edits,
  };
}

describe("direct-contact transform lifecycle", () => {
  it("materializes an ordinary Route when one endpoint moves away", () => {
    const document = fixture();
    const result = executeTransaction(
      document,
      transaction(document, [
        {
          kind: "move_instance",
          instanceId: "A",
          position: { x: 100, y: 300 },
        },
      ]),
      context,
    );

    if (!result.ok) throw new Error(result.error.message);
    expect(result.document.routes).toHaveLength(1);
    const route = result.document.routes[0]!;
    expect(new Set([endpointKey(route.from), endpointKey(route.to)])).toEqual(
      new Set([endpointKey(terminal("A")), endpointKey(terminal("B"))]),
    );
    expect(route.netId).toBe("net-contact");
    expect(
      resolveRouteGeometry(result.document, resolver, route)?.centerline,
    ).toEqual(
      expect.arrayContaining([
        { x: 110, y: 300 },
        { x: 150, y: 300 },
      ]),
    );
  });

  it("keeps a jointly moved direct contact route-free", () => {
    const document = fixture();
    const result = executeTransaction(
      document,
      transaction(document, [
        {
          kind: "move_instance",
          instanceId: "A",
          position: { x: 180, y: 320 },
        },
        {
          kind: "move_instance",
          instanceId: "B",
          position: { x: 200, y: 320 },
        },
      ]),
      context,
    );

    if (!result.ok) throw new Error(result.error.message);
    expect(result.document.routes).toEqual([]);
  });

  it.each([
    {
      label: "rotation",
      edit: { kind: "rotate_instance", instanceId: "A", rotation: 90 },
    },
    {
      label: "mirror",
      edit: { kind: "mirror_instance", instanceId: "A", mirror: "x" },
    },
  ])("materializes a Route after $label separates the pins", ({ edit }) => {
    const document = fixture();
    const result = executeTransaction(
      document,
      transaction(document, [edit], edit.kind),
      context,
    );

    if (!result.ok) throw new Error(result.error.message);
    expect(result.document.routes).toHaveLength(1);
    expect(result.document.routes[0]).toMatchObject({ netId: "net-contact" });
  });

  it("does not add a duplicate Route when another physical path remains", () => {
    const document = fixture();
    document.junctions.push({
      id: "J1",
      netId: "net-contact",
      position: { x: 300, y: 300 },
      role: "route-anchor",
    });
    document.routes.push(
      {
        id: "route-a-j1",
        netId: "net-contact",
        from: terminal("A"),
        to: { kind: "junction", junctionId: "J1" },
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-b-j1",
        netId: "net-contact",
        from: terminal("B"),
        to: { kind: "junction", junctionId: "J1" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    );

    const result = executeTransaction(
      document,
      transaction(
        document,
        [
          {
            kind: "move_instance",
            instanceId: "A",
            position: { x: 100, y: 300 },
          },
        ],
        "alternate-path",
      ),
      context,
    );

    if (!result.ok) throw new Error(result.error.message);
    expect(result.document.routes.map((route) => route.id).sort()).toEqual([
      "route-a-j1",
      "route-b-j1",
    ]);
  });

  it("splits the Base Net when the materialized Route is deleted", () => {
    const document = fixture();
    const moved = executeTransaction(
      document,
      transaction(
        document,
        [
          {
            kind: "move_instance",
            instanceId: "A",
            position: { x: 100, y: 300 },
          },
        ],
        "move-before-cut",
      ),
      context,
    );
    if (!moved.ok) throw new Error(moved.error.message);
    const routeId = moved.document.routes[0]!.id;

    const cut = executeTransaction(
      moved.document,
      transaction(moved.document, [{ kind: "cut_connection", routeId }], "cut"),
      context,
    );
    if (!cut.ok) throw new Error(cut.error.message);
    const owner = (instanceId: string) =>
      cut.document.nets.find((net) =>
        net.terminals.some((terminal) => terminal.instanceId === instanceId),
      )?.id;
    expect(cut.document.routes).toEqual([]);
    expect(owner("A")).toBeTruthy();
    expect(owner("B")).toBeTruthy();
    expect(owner("A")).not.toBe(owner("B"));
  });

  it("preserves a direct-contact component when another Route is cut", () => {
    const document = fixture();
    document.junctions.push({
      id: "J1",
      netId: "net-contact",
      position: { x: 300, y: 300 },
      role: "route-anchor",
    });
    document.routes.push({
      id: "route-a-j1",
      netId: "net-contact",
      from: terminal("A"),
      to: { kind: "junction", junctionId: "J1" },
      waypoints: [],
      segmentModes: ["manual"],
    });

    const cut = executeTransaction(
      document,
      transaction(
        document,
        [{ kind: "cut_connection", routeId: "route-a-j1" }],
        "direct-contact-cut",
      ),
      context,
    );
    if (!cut.ok) throw new Error(cut.error.message);
    const aOwner = cut.document.nets.find((net) =>
      net.terminals.some((candidate) => candidate.instanceId === "A"),
    )?.id;
    const bOwner = cut.document.nets.find((net) =>
      net.terminals.some((candidate) => candidate.instanceId === "B"),
    )?.id;
    expect(aOwner).toBe(bOwner);
  });

  it("does not merge different Base Nets from raw geometric coincidence", () => {
    const document = fixture();
    document.instances.find((instance) => instance.id === "B")!.placement = {
      position: { x: 460, y: 300 },
      rotation: 0,
      mirror: "x",
    };
    document.nets = [
      {
        id: "net-a",

        terminals: [{ instanceId: "A", pinName: "P" }],
      },
      {
        id: "net-b",

        terminals: [{ instanceId: "B", pinName: "P" }],
      },
    ];
    document.netlist!.terminals[0]!.netId = "net-a";
    document.netlist!.terminals[1]!.netId = "net-b";
    const result = executeTransaction(
      document,
      transaction(
        document,
        [
          {
            kind: "move_instance",
            instanceId: "B",
            position: { x: 160, y: 300 },
          },
        ],
        "conflict",
      ),
      context,
    );

    if (!result.ok) throw new Error(result.error.message);
    expect(result.document.nets).toHaveLength(2);
    expect(result.document.nets.map((net) => net.id).sort()).toEqual([
      "net-a",
      "net-b",
    ]);
  });

  it("restores both zero-length contact and materialized Route with history", () => {
    const document = fixture();
    const history = new DocumentHistory(document, context);
    const moved = history.transact(
      transaction(
        document,
        [
          {
            kind: "move_instance",
            instanceId: "A",
            position: { x: 100, y: 300 },
          },
        ],
        "history-move",
      ),
    );
    if (!moved.ok) throw new Error(moved.error.message);
    expect(history.document.routes).toHaveLength(1);

    const undo = history.transact(
      transaction(history.document, [{ kind: "undo" }], "undo"),
    );
    if (!undo.ok) throw new Error(undo.error.message);
    expect(history.document.routes).toEqual([]);
    expect(
      history.document.instances.find((instance) => instance.id === "A")
        ?.placement?.position,
    ).toEqual({ x: 140, y: 300 });

    const redo = history.transact(
      transaction(history.document, [{ kind: "redo" }], "redo"),
    );
    if (!redo.ok) throw new Error(redo.error.message);
    expect(history.document.routes).toHaveLength(1);
    expect(
      history.document.instances.find((instance) => instance.id === "A")
        ?.placement?.position,
    ).toEqual({ x: 100, y: 300 });
  });
});
