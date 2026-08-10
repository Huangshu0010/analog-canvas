import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  CircuitProjectSchema,
} from "@icm/model";
import type { CircuitProject } from "@icm/model";

const demoProject = CircuitProjectSchema.parse({
  schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
  id: "project-phase-1-manual",
  name: "Phase 1 Manual Editor",
  source: {
    entry: null,
    dialect: "none",
    sourcePolicy: "copy",
    files: [],
  },
  symbolLibrary: {
    id: "builtin-analog",
    version: "0.1.0",
    hash: "phase-1-builtins",
  },
  topDocumentId: "document-main",
  documents: [
    {
      id: "document-main",
      name: "Manual Editor Demo",
      revision: 0,
      sourceStatus: "in-sync",
      ports: [],
      instances: [
        {
          id: "M1",
          symbolId: "nmos",
          symbolVariantId: "textbook-3terminal",
          placement: null,
          properties: {},
        },
        {
          id: "M2",
          symbolId: "pmos",
          symbolVariantId: "textbook-3terminal",
          placement: null,
          properties: {},
        },
        {
          id: "R1",
          symbolId: "resistor",
          placement: null,
          properties: { value: "10k" },
        },
      ],
      nets: [],
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

export function createDemoProject(): CircuitProject {
  return structuredClone(demoProject);
}
