import { createEmptyProject, type CircuitProject } from "@icm/model";
import { InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { buildProjectConnectivityIndex } from "../connectivity-index.js";
import type { VisualDiagnostic } from "../visual.js";
import { runErcChecks } from "./erc.js";
import { adaptVisualDiagnostic, mergeDiagnostics } from "./diagnostic.js";

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
};

const resolver = new InMemorySymbolResolver([dual]);

function projectWithInstance(): CircuitProject {
  const project = createEmptyProject("d", "D", "doc");
  project.documents[0]!.instances = [
    {
      id: "I1",
      symbolId: "dual",
      placement: {
        position: { x: 0, y: 0 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    },
  ];
  return project;
}

const shortSegment: VisualDiagnostic = {
  code: "VISUAL_SHORT_SEGMENT",
  severity: "warning",
  category: "observation",
  confidence: "medium",
  gateEligible: false,
  message: "Segment is shorter than the configured minimum",
  objectIds: ["I1"],
  parameters: { length: 2 },
};

describe("diagnostic aggregation", () => {
  it("adapts a route-quality observation with a resolved primary locator", () => {
    const project = projectWithInstance();
    const index = buildProjectConnectivityIndex(project, resolver);
    const diagnostic = adaptVisualDiagnostic(shortSegment, "doc", index);
    expect(diagnostic.domain).toBe("routing");
    expect(diagnostic.code).toBe("VISUAL_SHORT_SEGMENT");
    expect(diagnostic.primary).toEqual({
      documentId: "doc",
      hierarchyPath: [],
      kind: "instance",
      objectId: "I1",
    });
    expect(diagnostic.related).toEqual([]);
  });

  it("keeps ERC and routing diagnostics in distinct domains after merging", () => {
    const project = projectWithInstance();
    const index = buildProjectConnectivityIndex(project, resolver);
    const erc = runErcChecks(project, index, resolver); // unconnected pins -> warnings
    const visual = [adaptVisualDiagnostic(shortSegment, "doc", index)];

    const merged = mergeDiagnostics(erc, visual);
    expect(merged.map((item) => item.domain).sort()).toEqual([
      "erc",
      "erc",
      "routing",
    ]);
    // ERC errors/warnings sort before routing warnings by domain then severity.
    expect(
      merged.findIndex((item) => item.domain === "routing"),
    ).toBeGreaterThan(merged.findIndex((item) => item.domain === "erc"));
  });

  it("classifies route-quality observations as routing without changing their locator", () => {
    const project = projectWithInstance();
    const index = buildProjectConnectivityIndex(project, resolver);
    const routing = adaptVisualDiagnostic(
      { ...shortSegment, objectIds: ["I1"] },
      "doc",
      index,
    );
    expect(routing.domain).toBe("routing");
    expect(routing.primary).toEqual({
      documentId: "doc",
      hierarchyPath: [],
      kind: "instance",
      objectId: "I1",
    });
  });

  it("keeps distinct visual observations on one primary object uniquely addressable", () => {
    const project = projectWithInstance();
    const index = buildProjectConnectivityIndex(project, resolver);
    const first = adaptVisualDiagnostic(
      { ...shortSegment, objectIds: ["I1", "foreign-a"] },
      "doc",
      index,
    );
    const second = adaptVisualDiagnostic(
      { ...shortSegment, objectIds: ["I1", "foreign-b"] },
      "doc",
      index,
    );
    expect(first.primary).toEqual(second.primary);
    expect(first.id).not.toBe(second.id);
  });

  it("produces a deterministic merged order", () => {
    const project = projectWithInstance();
    const index = buildProjectConnectivityIndex(project, resolver);
    const erc = runErcChecks(project, index, resolver);
    const visual = [adaptVisualDiagnostic(shortSegment, "doc", index)];
    expect(mergeDiagnostics(visual, erc)).toEqual(
      mergeDiagnostics(erc, visual),
    );
  });
});
