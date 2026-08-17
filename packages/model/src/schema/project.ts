import { z } from "zod";

import { CURRENT_PROJECT_SCHEMA_VERSION, StableIdSchema } from "./common.js";
import { SourceManifestSchema, SymbolLibraryLockSchema } from "./source.js";
import { SchematicDocumentSchema } from "./document.js";
import { reportDuplicateIds } from "./validation.js";
export const CircuitProjectSchema = z
  .strictObject({
    schemaVersion: z.literal(CURRENT_PROJECT_SCHEMA_VERSION),
    id: StableIdSchema,
    name: z.string().min(1),
    source: SourceManifestSchema,
    symbolLibrary: SymbolLibraryLockSchema,
    topDocumentId: StableIdSchema,
    documents: z.array(SchematicDocumentSchema).min(1),
  })
  .superRefine((project, context) => {
    const cellNames = new Set<string>();
    for (const [documentIndex, document] of project.documents.entries()) {
      const name = document.netlist?.name.toLowerCase();
      if (!name) continue;
      if (cellNames.has(name)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate netlist Cell name: ${document.netlist!.name}`,
          path: ["documents", documentIndex, "netlist", "name"],
        });
      }
      cellNames.add(name);
    }
    reportDuplicateIds(project.documents, "documents", context);
    if (
      !project.documents.some(
        (document) => document.id === project.topDocumentId,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `Unknown top document: ${project.topDocumentId}`,
        path: ["topDocumentId"],
      });
    }
  });

export const CircuitProjectJsonSchema = z.toJSONSchema(CircuitProjectSchema, {
  target: "draft-2020-12",
});
export const SchematicDocumentJsonSchema = z.toJSONSchema(
  SchematicDocumentSchema,
  {
    target: "draft-2020-12",
  },
);
