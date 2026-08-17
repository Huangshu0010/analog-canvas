import { z } from "zod";

import { StableIdSchema } from "./common.js";
import { reportDuplicateIds } from "./validation.js";
export const SourcePositionSchema = z.strictObject({
  offset: z.number().int().nonnegative(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
});
export const SourceSpanSchema = z
  .strictObject({
    fileId: StableIdSchema,
    start: SourcePositionSchema,
    end: SourcePositionSchema,
  })
  .superRefine((span, context) => {
    if (span.end.offset < span.start.offset) {
      context.addIssue({
        code: "custom",
        message: "Source span end must not precede its start",
        path: ["end", "offset"],
      });
    }
  });

export const SourceFileRecordSchema = z.strictObject({
  id: StableIdSchema,
  path: z.string().min(1),
  hash: z.string().min(1),
});
export const SourceManifestSchema = z
  .strictObject({
    entry: z.string().min(1).nullable(),
    dialect: z.string().min(1),
    sourcePolicy: z.enum(["copy", "reference"]),
    files: z.array(SourceFileRecordSchema),
  })
  .superRefine((manifest, context) => {
    reportDuplicateIds(manifest.files, "files", context);
  });
export const SymbolLibraryLockSchema = z.strictObject({
  id: StableIdSchema,
  version: z.string().min(1),
  hash: z.string().min(1),
});
