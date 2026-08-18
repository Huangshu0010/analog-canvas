import { executeProjectTransaction } from "@icm/edit-engine";
import {
  CircuitProjectSchema,
  createEmptyDocument,
  type CircuitProject,
  type Rotation,
  type SchematicDocument,
} from "@icm/model";
import { hierarchicalSymbolId } from "@icm/symbols";

export interface RectangleToCellConversion {
  project: CircuitProject;
  parentDocumentId: string;
  childDocumentId: string;
  instanceId: string;
  cellName: string;
}

function nextCellIdentity(project: CircuitProject): {
  cellName: string;
  documentId: string;
} {
  const cellNames = new Set(
    project.documents.flatMap((document) =>
      document.netlist?.name ? [document.netlist.name.toLowerCase()] : [],
    ),
  );
  const documentIds = new Set(
    project.documents.map((document) => document.id.toLowerCase()),
  );
  let index = 1;
  while (
    cellNames.has(`cell${index}`) ||
    documentIds.has(`document-cell-${index}`)
  ) {
    index += 1;
  }
  return {
    cellName: `Cell${index}`,
    documentId: `document-cell-${index}`,
  };
}

function allDocumentObjectIds(document: SchematicDocument): Set<string> {
  return new Set(
    [
      ...document.instances,
      ...document.nets,
      ...document.routes,
      ...document.junctions,
      ...document.noConnects,
      ...document.annotations,
      ...document.layoutGroups,
      ...document.constraints,
      ...(document.drafting?.objects ?? []),
    ].map((object) => object.id.toLowerCase()),
  );
}

function nextHierarchyInstanceId(document: SchematicDocument): string {
  const usedIds = allDocumentObjectIds(document);
  const usedReferences = new Set(
    document.instances.flatMap((instance) =>
      instance.netlist?.reference
        ? [instance.netlist.reference.toLowerCase()]
        : [],
    ),
  );
  let index = 1;
  while (usedIds.has(`x${index}`) || usedReferences.has(`x${index}`)) {
    index += 1;
  }
  return `X${index}`;
}

function nearestOrthogonalRotation(rotation: number): Rotation {
  const normalized = ((rotation % 360) + 360) % 360;
  const choices = [0, 90, 180, 270] as const;
  return choices.reduce((best, candidate) => {
    const bestDistance = Math.min(
      Math.abs(normalized - best),
      360 - Math.abs(normalized - best),
    );
    const candidateDistance = Math.min(
      Math.abs(normalized - candidate),
      360 - Math.abs(normalized - candidate),
    );
    return candidateDistance < bestDistance ? candidate : best;
  }, choices[0]);
}

/**
 * Convert one unlocked drafting rectangle into a persisted subcircuit
 * instance and create its empty child Document. The parent mutation still
 * crosses the typed Edit Engine boundary; Project validation then commits the
 * new Document and edited parent as one structural value.
 */
export function convertRectangleToHierarchy(
  sourceProject: CircuitProject,
  parentDocumentId: string,
  rectangleId: string,
): RectangleToCellConversion {
  const project = CircuitProjectSchema.parse(structuredClone(sourceProject));
  const parent = project.documents.find(
    (document) => document.id === parentDocumentId,
  );
  if (!parent) throw new Error(`Document not found: ${parentDocumentId}`);

  const object = parent.drafting?.objects.find(
    (candidate) => candidate.id === rectangleId,
  );
  if (!object || object.kind !== "rectangle") {
    throw new Error(`Rectangle not found: ${rectangleId}`);
  }
  if (object.locked) {
    throw new Error(`Unlock rectangle ${rectangleId} before creating a Cell`);
  }

  const { cellName, documentId: childDocumentId } = nextCellIdentity(project);
  const child = createEmptyDocument(childDocumentId, cellName);
  child.presentation = structuredClone(parent.presentation);
  const instanceId = nextHierarchyInstanceId(parent);
  const instance: SchematicDocument["instances"][number] = {
    id: instanceId,
    symbolId: hierarchicalSymbolId(cellName),
    placement: {
      position: object.center,
      rotation: nearestOrthogonalRotation(object.rotation),
      mirror: "none",
    },
    properties: {},
    netlist: {
      reference: instanceId,
      parameters: {},
      terminals: [],
      binding: {
        kind: "subcircuit",
        name: cellName,
        childDocumentId,
      },
    },
  };
  const transaction = executeProjectTransaction(project, {
    transactionId: `rectangle-to-cell-${parent.id}-${rectangleId}`,
    projectId: project.id,
    expectedStructureRevision: project.structureRevision,
    actor: { kind: "human", id: "human-local" },
    edits: [
      {
        kind: "add_document",
        document: child,
      },
      {
        kind: "transact_document",
        documentId: parent.id,
        expectedRevision: parent.revision,
        edits: [
          { kind: "remove_drafting_object", objectId: rectangleId },
          {
            kind: "add_instance",
            instance,
          },
        ],
      },
    ],
  });
  if (!transaction.ok || !transaction.applied) {
    const detail = transaction.diagnostics[0]?.message;
    throw new Error(
      !transaction.ok
        ? `${transaction.error.message}${detail ? ` — ${detail}` : ""}`
        : "Rectangle conversion did not commit",
    );
  }

  return {
    project: transaction.project,
    parentDocumentId: parent.id,
    childDocumentId,
    instanceId,
    cellName,
  };
}
