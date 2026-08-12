import { createEmptyProject } from "@icm/model";
import type { Net, RouteEndpoint } from "@icm/model";
import { InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  endpointBelongsToNet,
  endpointKey,
  endpointsEqual,
  isVisibleEndpoint,
  netEndpoints,
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
} from "./index.js";

// Minimal custom symbol gives full control over pin directions, positions, and
// presentation visibility so endpoint primitives are characterized without
// coupling to a fixture's internal geometry. Pin R faces east; pin L faces
// west; pin X is an implicit presentation terminal; variant "hide-r" hides R.
const resolver = new InMemorySymbolResolver([
  {
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
      {
        name: "X",
        role: "passive",
        at: { x: 0, y: -20 },
        direction: "north" as const,
        presentation: { visibility: "implicit" as const },
      },
    ],
    primitives: [
      { kind: "line" as const, from: { x: -10, y: 0 }, to: { x: 10, y: 0 } },
    ],
    variants: [{ id: "hide-r", hiddenPinNames: ["R"] }],
    aliases: [],
  },
]);

const terminal = (instanceId: string, pinName: string): RouteEndpoint => ({
  kind: "terminal",
  instanceId,
  pinName,
});

function placeDual(
  rotation: 0 | 90 | 180 | 270 = 0,
  position: { x: number; y: number } = { x: 100, y: 100 },
) {
  return {
    id: "I1",
    symbolId: "dual",
    placement: { position, rotation, mirror: "none" as const },
    properties: {},
  };
}

describe("endpoint primitives", () => {
  describe("endpointKey", () => {
    it("encodes each endpoint kind in a stable string format", () => {
      expect(endpointKey(terminal("A", "P"))).toBe("terminal:A:P");
      expect(endpointKey({ kind: "port", portId: "port-1" })).toBe(
        "port:port-1",
      );
      expect(endpointKey({ kind: "junction", junctionId: "j-1" })).toBe(
        "junction:j-1",
      );
    });

    it("distinguishes kinds even when ids coincide", () => {
      expect(endpointKey(terminal("shared", "P"))).not.toBe(
        endpointKey({ kind: "port", portId: "shared" }),
      );
    });
  });

  describe("endpointsEqual", () => {
    it("compares by endpoint key across all kinds", () => {
      expect(endpointsEqual(terminal("A", "P"), terminal("A", "P"))).toBe(true);
      expect(endpointsEqual(terminal("A", "P"), terminal("A", "Q"))).toBe(
        false,
      );
      expect(
        endpointsEqual(
          { kind: "port", portId: "p" },
          { kind: "junction", junctionId: "p" },
        ),
      ).toBe(false);
    });
  });

  describe("isVisibleEndpoint", () => {
    it("treats non-terminal endpoints as always visible", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      expect(
        isVisibleEndpoint(document, resolver, { kind: "port", portId: "p" }),
      ).toBe(true);
      expect(
        isVisibleEndpoint(document, resolver, {
          kind: "junction",
          junctionId: "j",
        }),
      ).toBe(true);
    });

    it("sees a visible pin, hides a variant-hidden pin, and hides an implicit pin", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      document.instances = [placeDual()];

      expect(isVisibleEndpoint(document, resolver, terminal("I1", "L"))).toBe(
        true,
      );
      // Pin X has presentation.visibility === "implicit" even without a variant.
      expect(isVisibleEndpoint(document, resolver, terminal("I1", "X"))).toBe(
        false,
      );

      document.instances = [{ ...placeDual(), symbolVariantId: "hide-r" }];
      expect(isVisibleEndpoint(document, resolver, terminal("I1", "R"))).toBe(
        false,
      );
      // The variant hides R from visibility but does not remove the pin
      // definition; other pins remain visible.
      expect(isVisibleEndpoint(document, resolver, terminal("I1", "L"))).toBe(
        true,
      );
    });

    it("returns false when the instance or symbol cannot be resolved", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      expect(
        isVisibleEndpoint(document, resolver, terminal("missing", "L")),
      ).toBe(false);
      document.instances = [{ ...placeDual(), symbolId: "no-such-symbol" }];
      expect(isVisibleEndpoint(document, resolver, terminal("I1", "L"))).toBe(
        false,
      );
    });
  });

  describe("resolveEndpointPoint", () => {
    it("resolves ports and junctions from the document collections", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      document.ports = [
        {
          id: "port-1",
          name: "in",
          direction: "passive",
          position: { x: 5, y: 7 },
        },
      ];
      document.junctions = [
        { id: "j-1", netId: "n", position: { x: 9, y: 3 } },
      ];
      expect(
        resolveEndpointPoint(document, resolver, {
          kind: "port",
          portId: "port-1",
        }),
      ).toEqual({ x: 5, y: 7 });
      expect(
        resolveEndpointPoint(document, resolver, {
          kind: "junction",
          junctionId: "j-1",
        }),
      ).toEqual({ x: 9, y: 3 });
    });

    it("resolves a terminal pin through the instance placement transform", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      document.instances = [placeDual(0, { x: 100, y: 100 })];
      // Pin R sits at local {20,0}; at rotation 0 it lands at {120,100}.
      expect(
        resolveEndpointPoint(document, resolver, terminal("I1", "R")),
      ).toEqual({ x: 120, y: 100 });
    });

    it("returns null for unknown ids, missing placement, or unknown pins", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      document.instances = [placeDual()];
      expect(
        resolveEndpointPoint(document, resolver, {
          kind: "port",
          portId: "no",
        }),
      ).toBeNull();
      expect(
        resolveEndpointPoint(document, resolver, {
          kind: "junction",
          junctionId: "no",
        }),
      ).toBeNull();
      expect(
        resolveEndpointPoint(document, resolver, terminal("I1", "nope")),
      ).toBeNull();

      document.instances = [
        { id: "I1", symbolId: "dual", placement: null, properties: {} },
      ];
      expect(
        resolveEndpointPoint(document, resolver, terminal("I1", "R")),
      ).toBeNull();
    });
  });

  describe("resolveEndpointOutwardDirection", () => {
    it("returns null for non-terminal endpoints", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      expect(
        resolveEndpointOutwardDirection(document, resolver, {
          kind: "port",
          portId: "p",
        }),
      ).toBeNull();
    });

    it("maps a pin direction through rotation", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      // Pin R faces east {1,0}; each rotation transforms the direction vector.
      for (const [rotation, expected] of [
        [0, { x: 1, y: 0 }],
        [90, { x: 0, y: 1 }],
        [180, { x: -1, y: 0 }],
        [270, { x: 0, y: -1 }],
      ] as const) {
        document.instances = [placeDual(rotation)];
        expect(
          resolveEndpointOutwardDirection(
            document,
            resolver,
            terminal("I1", "R"),
          ),
        ).toEqual(expected);
      }
      // Pin L faces west {-1,0} at rotation 0.
      document.instances = [placeDual(0)];
      expect(
        resolveEndpointOutwardDirection(
          document,
          resolver,
          terminal("I1", "L"),
        ),
      ).toEqual({ x: -1, y: 0 });
    });

    it("returns null when instance, placement, or pin is missing", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      expect(
        resolveEndpointOutwardDirection(
          document,
          resolver,
          terminal("no", "R"),
        ),
      ).toBeNull();
      document.instances = [
        { id: "I1", symbolId: "dual", placement: null, properties: {} },
      ];
      expect(
        resolveEndpointOutwardDirection(
          document,
          resolver,
          terminal("I1", "R"),
        ),
      ).toBeNull();
    });
  });

  describe("endpointBelongsToNet and netEndpoints", () => {
    it("reports membership across terminals, ports, and net-owned junctions", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      const net: Net = {
        id: "net-a",
        name: "a",
        scope: "local",
        terminals: [
          { instanceId: "I1", pinName: "L" },
          { instanceId: "I1", pinName: "R" },
        ],
        ports: ["port-z", "port-a"],
      };
      document.junctions = [
        { id: "j-in", netId: "net-a", position: { x: 0, y: 0 } },
        { id: "j-out", netId: "other-net", position: { x: 0, y: 0 } },
      ];

      expect(endpointBelongsToNet(document, net, terminal("I1", "L"))).toBe(
        true,
      );
      expect(endpointBelongsToNet(document, net, terminal("I1", "X"))).toBe(
        false,
      );
      expect(
        endpointBelongsToNet(document, net, { kind: "port", portId: "port-a" }),
      ).toBe(true);
      expect(
        endpointBelongsToNet(document, net, { kind: "port", portId: "port-q" }),
      ).toBe(false);
      expect(
        endpointBelongsToNet(document, net, {
          kind: "junction",
          junctionId: "j-in",
        }),
      ).toBe(true);
      // A junction endpoint only belongs to the net that owns it.
      expect(
        endpointBelongsToNet(document, net, {
          kind: "junction",
          junctionId: "j-out",
        }),
      ).toBe(false);
    });

    it("unions terminals, ports, and net junctions sorted by endpoint key", () => {
      const project = createEmptyProject("ep", "EP");
      const document = project.documents[0]!;
      const net: Net = {
        id: "net-a",
        name: "a",
        scope: "local",
        terminals: [
          { instanceId: "I1", pinName: "L" },
          { instanceId: "I1", pinName: "R" },
        ],
        ports: ["port-z", "port-a"],
      };
      document.junctions = [
        { id: "j-in", netId: "net-a", position: { x: 0, y: 0 } },
        { id: "j-out", netId: "other-net", position: { x: 0, y: 0 } },
      ];

      expect(netEndpoints(document, net)).toEqual<RouteEndpoint[]>([
        { kind: "junction", junctionId: "j-in" },
        { kind: "port", portId: "port-a" },
        { kind: "port", portId: "port-z" },
        { kind: "terminal", instanceId: "I1", pinName: "L" },
        { kind: "terminal", instanceId: "I1", pinName: "R" },
      ]);
    });
  });
});
