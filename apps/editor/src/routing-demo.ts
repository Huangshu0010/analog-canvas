import { CURRENT_PROJECT_SCHEMA_VERSION, CircuitProjectSchema } from "@icm/model";
import type { CircuitProject, Instance } from "@icm/model";

function instance(
  id: string,
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270,
  mirror: "none" | "x" = "none",
): Instance {
  return {
    id,
    symbolId: "generic-block-1",
    placement: { position: { x, y }, rotation, mirror },
    properties: {},
  };
}

export function createRoutingDemoProject(): CircuitProject {
  return CircuitProjectSchema.parse({
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    id: "project-routing",
    name: "Phase 3 Routing Demo",
    source: { entry: null, dialect: "none", sourcePolicy: "copy", files: [] },
    symbolLibrary: {
      id: "builtin-analog",
      version: "0.0.0",
      hash: "development",
    },
    topDocumentId: "document-routing",
    documents: [
      {
        id: "document-routing",
        name: "Phase 3 Routing",
        revision: 0,
        sourceStatus: "in-sync",
        ports: [],
        instances: [
          instance("A", 140, 300, 0),
          instance("B", 460, 300, 0, "x"),
          instance("C", 300, 140, 90),
          instance("D", 300, 460, 270),
          instance("E", 340, 440, 90),
        ],
        nets: [
          {
            id: "net-h",
            name: "HORIZONTAL",
            scope: "local",
            terminals: ["A", "B", "E"].map((instanceId) => ({
              instanceId,
              pinName: "P1",
            })),
            ports: [],
          },
          {
            id: "net-v",
            name: "VERTICAL",
            scope: "local",
            terminals: ["C", "D"].map((instanceId) => ({
              instanceId,
              pinName: "P1",
            })),
            ports: [],
          },
        ],
        routes: [],
        junctions: [],
        annotations: [],
        presentation: {
          styleProfileId: "textbook-monochrome-v1",
          grid: 10,
          compactness: "normal",
        },
        layoutGroups: [],
        constraints: [],
      },
    ],
  });
}
