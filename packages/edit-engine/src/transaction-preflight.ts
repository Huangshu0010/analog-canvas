import type { Point, SchematicDocument } from "@icm/model";
import { z } from "zod";

import type { SchematicEdit } from "./edit-schema.js";
import type { EditDiagnostic } from "./transaction-result.js";

export function schemaDiagnostics(
  error: z.ZodError,
  code: string,
): EditDiagnostic[] {
  return error.issues.map((issue) => ({
    code,
    severity: "error" as const,
    message: issue.message,
    path: issue.path.map((segment) =>
      typeof segment === "symbol" ? (segment.description ?? "symbol") : segment,
    ),
  }));
}

export function gridAlignmentDiagnostics(
  value: unknown,
  grid: number,
  path: ReadonlyArray<string | number> = [],
): EditDiagnostic[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      gridAlignmentDiagnostics(item, grid, [...path, index]),
    );
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const diagnostics: EditDiagnostic[] = [];
  if (typeof record.x === "number" && typeof record.y === "number") {
    for (const axis of ["x", "y"] as const) {
      const coordinate = record[axis] as number;
      if (coordinate % grid === 0) continue;
      diagnostics.push({
        code: "GRID_ALIGNMENT",
        severity: "error",
        message: `Document page coordinates must align to grid ${grid}`,
        path: [...path, axis],
      });
    }
  }
  for (const [key, child] of Object.entries(record)) {
    diagnostics.push(...gridAlignmentDiagnostics(child, grid, [...path, key]));
  }
  return diagnostics;
}

export function snapPointToDocumentGrid(point: Point, grid: number): Point {
  return {
    x: Math.round(point.x / grid) * grid,
    y: Math.round(point.y / grid) * grid,
  };
}

/**
 * Source synchronization and routing guidance have different lifetimes. An
 * imported Document starts with dashed guidance active; placing its initially
 * unplaced symbols or committing ordinary Wire must not dismiss the remaining
 * imported Nets. Deliberate presentation/geometry interventions do dismiss it
 * so a manually revised drawing is never repopulated with inferred guidance.
 */
export function transactionDismissesFlightlineGuidance(
  document: SchematicDocument,
  edits: readonly SchematicEdit[],
): boolean {
  if (!document.sourceBinding || document.flightlineGuidance === "dismissed") {
    return false;
  }
  const isWireCommit = edits.some((edit) => edit.kind === "connect_endpoints");
  return edits.some((edit) => {
    switch (edit.kind) {
      case "upsert_schematic_annotation":
        return edit.annotation.kind === "net-label";
      case "remove_schematic_annotation":
        return (
          document.annotations.find(
            (annotation) => annotation.id === edit.annotationId,
          )?.kind === "net-label"
        );
      case "move_instance":
      case "rotate_instance":
      case "mirror_instance":
      case "align_instances":
      case "move_junction":
      case "cut_connection":
      case "make_flightline":
        return true;
      case "set_route_points":
      case "route_orthogonal":
      case "add_junction":
      case "attach_endpoint_to_route":
        return !isWireCommit;
      default:
        return false;
    }
  });
}

export function isHistoryEdit(
  edit: SchematicEdit,
): edit is Extract<SchematicEdit, { kind: "undo" | "redo" }> {
  return edit.kind === "undo" || edit.kind === "redo";
}
