import type { CircuitProject } from "@icm/model";

import type { SchematicEdit } from "./edit-schema.js";
import type { EditDiagnostic } from "./transaction-result.js";

export type CellResetIntent =
  "clear-drawing" | "reset-placement" | "reset-body";

export interface CellResetPlan {
  readonly scope: { kind: "cell"; documentId: string };
  readonly intent: CellResetIntent;
  readonly preconditionToken: string;
  readonly summary: string;
  readonly affectedObjectIds: readonly string[];
  readonly diagnostics: readonly EditDiagnostic[];
  readonly destructive: true;
  readonly rollback: { kind: "document-undo" };
  readonly edits: readonly SchematicEdit[];
}

function requireDocument(project: CircuitProject, documentId: string) {
  const document = project.documents.find((item) => item.id === documentId);
  if (!document) throw new Error(`Document does not exist: ${documentId}`);
  return document;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

/**
 * Build the reviewable impact for one Cell-local reset. Execution remains in
 * the ordinary typed edit transaction, so revision checks and Document Undo
 * are shared with every other editor mutation.
 */
export function planCellReset(
  project: CircuitProject,
  documentId: string,
  intent: CellResetIntent,
): CellResetPlan {
  const document = requireDocument(project, documentId);
  const callers = project.documents.flatMap((parent) =>
    parent.instances.flatMap((instance) => {
      const binding = instance.netlist?.binding;
      return binding?.kind === "subcircuit" &&
        binding.childDocumentId === documentId
        ? [`${parent.id}.${instance.id}`]
        : [];
    }),
  );
  let affectedObjectIds: string[];
  let edit: SchematicEdit;
  let summary: string;

  if (intent === "clear-drawing") {
    affectedObjectIds = uniqueIds([
      ...document.routes.map((route) => route.id),
      ...(document.drafting?.objects.map((object) => object.id) ?? []),
    ]);
    edit = { kind: "clear_cell_drawing" };
    summary = `Remove ${document.routes.length} Route geometries and ${document.drafting?.objects.length ?? 0} drafting objects; retain Instances, Nets, ports, and semantic annotations`;
  } else if (intent === "reset-placement") {
    const placedInstances = document.instances.filter(
      (instance) => instance.placement !== null,
    );
    affectedObjectIds = uniqueIds([
      ...placedInstances.map((instance) => instance.id),
      ...document.routes.map((route) => route.id),
      ...document.layoutGroups.map((group) => group.id),
      ...document.constraints.map((constraint) => constraint.id),
    ]);
    edit = { kind: "reset_cell_placement" };
    summary = `Return ${placedInstances.length} Instances to the tray and remove ${document.routes.length} Route geometries; retain devices, Nets, and formal interface`;
  } else {
    const interfaceInstanceIds = new Set(
      document.netlist?.terminals.flatMap(
        (terminal) => terminal.interfaceInstanceIds,
      ) ?? [],
    );
    const interfaceNetIds = new Set(
      document.netlist?.terminals.map((terminal) => terminal.netId) ?? [],
    );
    const retainedAnnotationIds = new Set(
      document.annotations.flatMap((annotation) =>
        annotation.anchor.kind === "object" &&
        interfaceInstanceIds.has(annotation.anchor.objectId)
          ? [annotation.id]
          : [],
      ),
    );
    const allObjects = [
      ...document.instances,
      ...document.nets,
      ...document.routes,
      ...document.junctions,
      ...document.noConnects,
      ...document.annotations,
      ...document.layoutGroups,
      ...document.constraints,
      ...(document.drafting?.objects ?? []),
    ];
    affectedObjectIds = uniqueIds([
      ...allObjects.flatMap((object) => {
        const retained =
          ("symbolId" in object && interfaceInstanceIds.has(object.id)) ||
          ("terminals" in object &&
            interfaceNetIds.has(object.id) &&
            object.terminals.every((terminal) =>
              interfaceInstanceIds.has(terminal.instanceId),
            )) ||
          retainedAnnotationIds.has(object.id);
        return retained ? [] : [object.id];
      }),
      ...(document.mosBulkDefaults ? [document.id] : []),
    ]);
    edit = { kind: "reset_cell_body" };
    summary = `Remove ${affectedObjectIds.length} body objects; retain ${document.netlist?.terminals.length ?? 0} formal terminals and their interface markers`;
  }

  return {
    scope: { kind: "cell", documentId },
    intent,
    preconditionToken: `${document.id}:${document.revision}`,
    summary,
    affectedObjectIds,
    diagnostics:
      intent === "reset-body" && callers.length > 0
        ? [
            {
              code: "CELL_CALLERS_PRESERVED",
              severity: "info",
              message: `Formal interface retained for ${callers.length} caller${callers.length === 1 ? "" : "s"}`,
              objectIds: callers,
            },
          ]
        : [],
    destructive: true,
    rollback: { kind: "document-undo" },
    edits: affectedObjectIds.length > 0 ? [edit] : [],
  };
}
