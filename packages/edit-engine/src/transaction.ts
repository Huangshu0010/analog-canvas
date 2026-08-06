import { SchematicDocumentSchema, StableIdSchema } from "@icm/model";
import type { SchematicDocument } from "@icm/model";
import { z } from "zod";

export const EditActorSchema = z.strictObject({
  kind: z.enum(["human", "agent"]),
  id: StableIdSchema,
});

export const NoopEditSchema = z.strictObject({
  kind: z.literal("noop"),
  reason: z.string().min(1).optional(),
});

export const SchematicEditSchema = z.discriminatedUnion("kind", [
  NoopEditSchema,
]);

export const EditTransactionSchema = z.strictObject({
  transactionId: StableIdSchema,
  documentId: StableIdSchema,
  expectedRevision: z.number().int().nonnegative(),
  actor: EditActorSchema,
  dryRun: z.boolean().optional(),
  edits: z.array(SchematicEditSchema).min(1).max(256),
});

export type EditActor = z.infer<typeof EditActorSchema>;
export type SchematicEdit = z.infer<typeof SchematicEditSchema>;
export type EditTransaction = z.infer<typeof EditTransactionSchema>;

export type EditErrorCode =
  | "INVALID_TRANSACTION"
  | "DOCUMENT_MISMATCH"
  | "STALE_REVISION"
  | "INVALID_RESULT";

export interface EditDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  path?: ReadonlyArray<string | number>;
}

export interface EditDiff {
  documentId: string;
  fromRevision: number;
  toRevision: number;
  editKinds: readonly SchematicEdit["kind"][];
  changedObjectIds: readonly string[];
}

export interface AppliedTransaction {
  ok: true;
  applied: boolean;
  revision: number;
  proposedRevision: number;
  document: SchematicDocument;
  diff: EditDiff;
  diagnostics: readonly EditDiagnostic[];
}

export interface RejectedTransaction {
  ok: false;
  applied: false;
  revision: number;
  document: SchematicDocument;
  error: {
    code: EditErrorCode;
    message: string;
  };
  diagnostics: readonly EditDiagnostic[];
}

export type EditTransactionResult = AppliedTransaction | RejectedTransaction;

function reject(
  document: SchematicDocument,
  code: EditErrorCode,
  message: string,
  diagnostics: readonly EditDiagnostic[] = [],
): RejectedTransaction {
  return {
    ok: false,
    applied: false,
    revision: document.revision,
    document,
    error: { code, message },
    diagnostics,
  };
}

export function executeTransaction(
  document: SchematicDocument,
  input: EditTransaction | unknown,
): EditTransactionResult {
  const parsed = EditTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return reject(
      document,
      "INVALID_TRANSACTION",
      "Transaction schema validation failed",
      parsed.error.issues.map((issue) => ({
        code: "INVALID_TRANSACTION",
        severity: "error" as const,
        message: issue.message,
        path: issue.path.map((segment) =>
          typeof segment === "symbol"
            ? (segment.description ?? "symbol")
            : segment,
        ),
      })),
    );
  }

  const transaction = parsed.data;
  if (transaction.documentId !== document.id) {
    return reject(
      document,
      "DOCUMENT_MISMATCH",
      `Transaction targets ${transaction.documentId}, but the open Document is ${document.id}`,
    );
  }
  if (transaction.expectedRevision !== document.revision) {
    return reject(
      document,
      "STALE_REVISION",
      `Expected revision ${transaction.expectedRevision}, actual revision ${document.revision}`,
    );
  }

  const proposedRevision = document.revision + 1;
  const diff: EditDiff = {
    documentId: document.id,
    fromRevision: document.revision,
    toRevision: proposedRevision,
    editKinds: transaction.edits.map((edit) => edit.kind),
    changedObjectIds: [],
  };

  if (transaction.dryRun === true) {
    return {
      ok: true,
      applied: false,
      revision: document.revision,
      proposedRevision,
      document,
      diff,
      diagnostics: [],
    };
  }

  const candidate = SchematicDocumentSchema.safeParse({
    ...structuredClone(document),
    revision: proposedRevision,
  });
  if (!candidate.success) {
    return reject(
      document,
      "INVALID_RESULT",
      "Transaction result failed Document validation",
      candidate.error.issues.map((issue) => ({
        code: "INVALID_RESULT",
        severity: "error" as const,
        message: issue.message,
        path: issue.path.map((segment) =>
          typeof segment === "symbol"
            ? (segment.description ?? "symbol")
            : segment,
        ),
      })),
    );
  }

  return {
    ok: true,
    applied: true,
    revision: candidate.data.revision,
    proposedRevision,
    document: candidate.data,
    diff,
    diagnostics: [],
  };
}
