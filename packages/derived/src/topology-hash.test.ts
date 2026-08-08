import { describe, expect, it } from "vitest";

import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";
import type { CircuitProject } from "@icm/model";

import { electricalTopologyHash } from "./topology-hash.js";

function project(documents: CircuitProject["documents"]): CircuitProject {
  return {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    id: "p",
    name: "P",
    source: { entry: null, dialect: "none", sourcePolicy: "copy", files: [] },
    symbolLibrary: { id: "builtin-analog", version: "0.1.0", hash: "razavi-v1" },
    topDocumentId: "doc",
    documents,
  };
}

function baseDoc(overrides: Partial<CircuitProject["documents"][number]>): CircuitProject["documents"][number] {
  return {
    id: "doc",
    name: "Doc",
    revision: 0,
    sourceStatus: "in-sync",
    ports: [],
    instances: [],
    nets: [],
    routes: [],
    junctions: [],
    annotations: [],
    presentation: { styleProfileId: "razavi-textbook-v1", grid: 10, compactness: "normal" },
    layoutGroups: [],
    constraints: [],
    ...overrides,
  };
}

describe("electricalTopologyHash", () => {
  it("is stable regardless of placement, annotations, and drafting", () => {
    const electrical = {
      instances: [{ id: "M1", symbolId: "nmos", symbolVariantId: "v", properties: {}, placement: null as null }],
      nets: [{ id: "n1", scope: "local" as const, terminals: [{ instanceId: "M1", pinName: "D" }], ports: [] }],
    };
    const placed = project([
      baseDoc({
        ...electrical,
        instances: [{ ...electrical.instances[0]!, placement: { position: { x: 100, y: 100 }, rotation: 0, mirror: "none" as const } }],
        annotations: [{ id: "a1", kind: "instance-label", text: "M1", position: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, alignment: "middle", rotation: 0, locked: false }],
      }),
    ]);
    const moved = project([
      baseDoc({
        ...electrical,
        instances: [{ ...electrical.instances[0]!, placement: { position: { x: 500, y: 500 }, rotation: 90 as const, mirror: "x" as const } }],
        drafting: { objects: [{ id: "d1", kind: "text", locked: false, zIndex: 0, anchor: { kind: "free", position: { x: 1, y: 1 } }, content: { runs: [{ kind: "text", value: "x" }] }, alignment: "start", rotation: 0 }], guides: [] },
      }),
    ]);
    expect(electricalTopologyHash(placed)).toBe(electricalTopologyHash(moved));
  });

  it("changes when a terminal is added to a Net", () => {
    const before = project([
      baseDoc({ instances: [{ id: "M1", symbolId: "nmos", symbolVariantId: "v", properties: {}, placement: null }], nets: [{ id: "n1", scope: "local", terminals: [], ports: [] }] }),
    ]);
    const after = project([
      baseDoc({ instances: [{ id: "M1", symbolId: "nmos", symbolVariantId: "v", properties: {}, placement: null }], nets: [{ id: "n1", scope: "local", terminals: [{ instanceId: "M1", pinName: "D" }], ports: [] }] }),
    ]);
    expect(electricalTopologyHash(before)).not.toBe(electricalTopologyHash(after));
  });

  it("produces a lowercase 64-char hex sha256", () => {
    const hash = electricalTopologyHash(project([baseDoc({})]));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
