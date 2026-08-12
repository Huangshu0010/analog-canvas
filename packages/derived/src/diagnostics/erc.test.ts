import { createEmptyProject, type CircuitProject } from "@icm/model";
import { InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { buildProjectConnectivityIndex } from "../connectivity-index.js";
import { runErcChecks } from "./erc.js";

const dual = {
  schemaVersion: 1 as const,
  id: "dual",
  name: "Dual",
  viewBox: { x: -20, y: -20, width: 40, height: 40 },
  pins: [
    {
      name: "L",
      role: "passive",
      at: { x: -20, y: 0 },
      direction: "west" as const,
      presentation: { visibility: "visible" as const },
    },
    {
      name: "R",
      role: "passive",
      at: { x: 20, y: 0 },
      direction: "east" as const,
      presentation: { visibility: "visible" as const },
    },
  ],
  primitives: [
    { kind: "line" as const, from: { x: -10, y: 0 }, to: { x: 10, y: 0 } },
  ],
  variants: [],
  aliases: [],
};

const resolver = new InMemorySymbolResolver([dual]);

function emptyProject(): CircuitProject {
  return createEmptyProject("erc", "ERC", "doc");
}

function instance(id: string, spiceName?: string) {
  return {
    id,
    symbolId: "dual",
    placement: {
      position: { x: 0, y: 0 },
      rotation: 0 as const,
      mirror: "none" as const,
    },
    properties: spiceName ? { "spice.name": spiceName } : {},
  };
}

function run(project: CircuitProject) {
  return runErcChecks(
    project,
    buildProjectConnectivityIndex(project, resolver),
    resolver,
  );
}

function codes(project: CircuitProject): string[] {
  return run(project).map((diagnostic) => diagnostic.code);
}

describe("ERC engine", () => {
  it("is silent on a clean project where every pin is connected", () => {
    const project = emptyProject();
    const document = project.documents[0]!;
    document.instances = [instance("I1", "M1")];
    document.nets = [
      {
        id: "net-1",
        name: "sig",
        scope: "local",
        terminals: [
          { instanceId: "I1", pinName: "L" },
          { instanceId: "I1", pinName: "R" },
        ],
        ports: [],
      },
    ];
    expect(run(project)).toEqual([]);
  });

  it("flags unconnected visible pins and suppresses them via NoConnect", () => {
    const project = emptyProject();
    project.documents[0]!.instances = [instance("I1")];
    expect(codes(project)).toEqual([
      "ERC_UNCONNECTED_PIN",
      "ERC_UNCONNECTED_PIN",
    ]);

    // Declaring L as NoConnect removes its warning; R remains.
    project.documents[0]!.noConnects = [
      {
        id: "nc1",
        endpoint: { kind: "terminal", instanceId: "I1", pinName: "L" },
      },
    ];
    expect(codes(project)).toEqual(["ERC_UNCONNECTED_PIN"]);
    expect(run(project)[0]!.primary).toMatchObject({
      kind: "terminal",
      endpoint: { kind: "terminal", instanceId: "I1", pinName: "R" },
    });
  });

  it("does not flag an implicit pin even when unconnected", () => {
    const implicitResolver = new InMemorySymbolResolver([
      {
        ...dual,
        id: "withImplicit",
        pins: [
          ...dual.pins,
          {
            name: "X",
            role: "passive",
            at: { x: 0, y: -20 },
            direction: "north" as const,
            presentation: { visibility: "implicit" as const },
          },
        ],
      },
    ]);
    const project = emptyProject();
    project.documents[0]!.instances = [
      { ...instance("I1"), symbolId: "withImplicit" },
    ];
    project.documents[0]!.nets = [
      {
        id: "net-1",
        name: "sig",
        scope: "local",
        terminals: [
          { instanceId: "I1", pinName: "L" },
          { instanceId: "I1", pinName: "R" },
        ],
        ports: [],
      },
    ];
    // L and R are connected; X is implicit and therefore not required.
    expect(
      runErcChecks(
        project,
        buildProjectConnectivityIndex(project, implicitResolver),
        implicitResolver,
      ),
    ).toEqual([]);
  });

  it("flags two instances sharing a normalized spice.name", () => {
    const project = emptyProject();
    project.documents[0]!.instances = [
      instance("I1", "M1"),
      instance("I2", "m1"),
    ];
    project.documents[0]!.nets = [
      {
        id: "net-1",
        name: "sig",
        scope: "local",
        terminals: [
          { instanceId: "I1", pinName: "L" },
          { instanceId: "I1", pinName: "R" },
          { instanceId: "I2", pinName: "L" },
          { instanceId: "I2", pinName: "R" },
        ],
        ports: [],
      },
    ];
    const diagnostic = run(project).find(
      (item) => item.code === "ERC_DUPLICATE_INSTANCE_NAME",
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.severity).toBe("error");
    expect(diagnostic!.related).toHaveLength(1);
  });

  it("flags two nets sharing a normalized name without an explicit merge", () => {
    const project = emptyProject();
    project.documents[0]!.instances = [instance("I1")];
    project.documents[0]!.nets = [
      {
        id: "net-a",
        name: "out",
        scope: "local",
        terminals: [{ instanceId: "I1", pinName: "L" }],
        ports: [],
      },
      {
        id: "net-b",
        name: "OUT",
        scope: "local",
        terminals: [{ instanceId: "I1", pinName: "R" }],
        ports: [],
      },
    ];
    const diagnostic = run(project).find(
      (item) => item.code === "ERC_DUPLICATE_NET_NAME",
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.severity).toBe("error");
  });

  it("defensively reports a NoConnect endpoint that is also on a Net", () => {
    // The schema invariant (WP-R7) rejects this at parse/Edit-Engine time; ERC
    // repeats the check defensively. Construct the invalid state via a cast.
    const project = emptyProject();
    project.documents[0]!.instances = [instance("I1")];
    project.documents[0]!.nets = [
      {
        id: "net-1",
        name: "sig",
        scope: "local",
        terminals: [{ instanceId: "I1", pinName: "L" }],
        ports: [],
      },
    ];
    project.documents[0]!.noConnects = [
      {
        id: "nc1",
        endpoint: { kind: "terminal", instanceId: "I1", pinName: "L" },
      },
    ];
    const diagnostics = runErcChecks(
      project as CircuitProject,
      buildProjectConnectivityIndex(project as CircuitProject, resolver),
      resolver,
    );
    expect(
      diagnostics.some((item) => item.code === "ERC_NO_CONNECT_CONFLICT"),
    ).toBe(true);
  });

  it("reports unresolved symbols instead of silently skipping their pins", () => {
    const project = emptyProject();
    project.documents[0]!.instances = [
      { ...instance("I1"), symbolId: "missing-symbol" },
    ];
    const diagnostics = run(project);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "ERC_UNRESOLVED_SYMBOL",
        primary: expect.objectContaining({ objectId: "I1" }),
      }),
    );
  });

  it("reports a missing hierarchy target and child interface mismatch", () => {
    const project = emptyProject();
    const parent = project.documents[0]!;
    parent.instances = [
      {
        ...instance("X1"),
        properties: { "spice.childDocumentId": "child" },
      },
    ];
    expect(codes(project)).toContain("ERC_HIERARCHY_TARGET_MISSING");

    const child = createEmptyProject("child-project", "Child", "child")
      .documents[0]!;
    child.ports = [
      {
        id: "port-a",
        name: "A",
        direction: "passive",
        position: { x: 0, y: 0 },
      },
    ];
    project.documents.push(child);
    const diagnostics = run(project);
    expect(diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "ERC_PORT_COUNT_MISMATCH",
        "ERC_PORT_NAME_MISMATCH",
      ]),
    );
  });
});
