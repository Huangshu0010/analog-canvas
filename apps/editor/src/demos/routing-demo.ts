import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  CircuitProjectSchema,
} from "@icm/model";
import type { CircuitProject } from "@icm/model";

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
    topDocumentId: "document-routing",
    documents: [
      {
        id: "document-routing",
        name: "Phase 3 Routing",
        revision: 0,
        sourceStatus: "in-sync",
        ports: [
          {
            id: "A",
            name: "A",
            direction: "passive",
            position: { x: 150, y: 300 },
            presentation: "hollow",
          },
          {
            id: "B",
            name: "B",
            direction: "passive",
            position: { x: 450, y: 300 },
            presentation: "hollow",
          },
          {
            id: "C",
            name: "C",
            direction: "passive",
            position: { x: 300, y: 150 },
            presentation: "hollow",
          },
          {
            id: "D",
            name: "D",
            direction: "passive",
            position: { x: 300, y: 450 },
            presentation: "hollow",
          },
          {
            id: "E",
            name: "E",
            direction: "passive",
            position: { x: 340, y: 450 },
            presentation: "hollow",
          },
        ],
        instances: [],
        nets: [
          {
            id: "net-h",
            name: "HORIZONTAL",
            scope: "local",
            terminals: [],
            ports: ["A", "B", "E"],
          },
          {
            id: "net-v",
            name: "VERTICAL",
            scope: "local",
            terminals: [],
            ports: ["C", "D"],
          },
        ],
        routes: [],
        junctions: [],
        annotations: [],
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
