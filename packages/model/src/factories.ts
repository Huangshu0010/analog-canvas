import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  CircuitProjectSchema,
} from "./schema.js";
import type { CircuitProject, SchematicDocument } from "./schema.js";

export function createEmptyDocument(
  id: string,
  name: string,
): SchematicDocument {
  return {
    id,
    name,
    revision: 0,
    sourceStatus: "in-sync",
    ports: [],
    instances: [],
    nets: [],
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
  };
}

export function createEmptyProject(
  id: string,
  name: string,
  documentId = "document-main",
): CircuitProject {
  return CircuitProjectSchema.parse({
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    id,
    name,
    source: {
      entry: null,
      dialect: "none",
      sourcePolicy: "copy",
      files: [],
    },
    symbolLibrary: {
      id: "builtin-analog",
      version: "0.0.0",
      hash: "development",
    },
    topDocumentId: documentId,
    documents: [createEmptyDocument(documentId, "Main")],
  });
}
