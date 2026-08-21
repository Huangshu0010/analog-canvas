import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  CircuitProjectSchema,
} from "@icm/model";
import type { CircuitProject, Instance } from "@icm/model";

function instance(
  id: string,
  schematicReference: string,
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270,
  mirror: "none" | "x" = "none",
): Instance {
  return {
    id,
    symbolId: "port",
    schematicReference,
    placement: { position: { x, y }, rotation, mirror },
  };
}

export function createRoutingDemoProject(): CircuitProject {
  return CircuitProjectSchema.parse({
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    id: "project-routing",
    name: "Phase 3 Routing Demo",
    source: { entry: null, dialect: "none", sourcePolicy: "copy", files: [] },
    symbolLibrary: {
      id: "razavi-symbols",
      version: "1",
      hash: "razavi-reference-v1",
    },
    structureRevision: 0,
    topDocumentId: "document-routing",
    documents: [
      {
        id: "document-routing",
        name: "Phase 3 Routing",
        revision: 0,
        sourceStatus: "in-sync",
        netlist: { name: "Phase_3_Routing", terminals: [] },
        instances: [
          instance("A", "P1", 140, 300, 0),
          instance("B", "P2", 460, 300, 0, "x"),
          instance("C", "P3", 300, 140, 90),
          instance("D", "P4", 300, 460, 270),
          instance("E", "P5", 340, 440, 90),
        ],
        nets: [
          {
            id: "net-h",
            name: "HORIZONTAL",
            scope: "local",
            origin: { kind: "authored" },
            terminals: ["A", "B", "E"].map((instanceId) => ({
              instanceId,
              pinName: "P",
            })),
          },
          {
            id: "net-v",
            name: "VERTICAL",
            scope: "local",
            origin: { kind: "authored" },
            terminals: ["C", "D"].map((instanceId) => ({
              instanceId,
              pinName: "P",
            })),
          },
        ],
        routes: [],
        junctions: [],
        annotations: [],
        noConnects: [],
        drafting: { objects: [] },
        presentation: {
          styleProfileId: "razavi-textbook-v1",
          grid: 10,
          compactness: "normal",
        },
        layoutGroups: [],
        constraints: [],
      },
    ],
  });
}
