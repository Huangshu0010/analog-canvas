import { CircuitProjectSchema } from "@icm/model";
import type { CircuitProject, SchematicDocument } from "@icm/model";

/** Replace one validated Document without allowing callers to patch Project. */
export function replaceProjectDocument(
  project: CircuitProject,
  document: SchematicDocument,
): CircuitProject {
  return CircuitProjectSchema.parse({
    ...project,
    documents: project.documents.map((candidate) =>
      candidate.id === document.id ? document : candidate,
    ),
  });
}

/** Resolve the active Document, falling back deterministically to top. */
export function resolveActiveDocument(
  project: CircuitProject,
  activeDocumentId: string,
): SchematicDocument {
  return (
    project.documents.find((candidate) => candidate.id === activeDocumentId) ??
    project.documents.find(
      (candidate) => candidate.id === project.topDocumentId,
    )!
  );
}

/** Resolve stable imported hierarchy links with read-only legacy fallback. */
export function referencedDocumentId(
  project: CircuitProject,
  instance: SchematicDocument["instances"][number],
): string | null {
  const stableChildDocumentId = instance.properties["spice.childDocumentId"];
  if (
    typeof stableChildDocumentId === "string" &&
    project.documents.some(
      (candidate) => candidate.id === stableChildDocumentId,
    )
  ) {
    return stableChildDocumentId;
  }

  const target = instance.properties["spice.target"];
  if (typeof target !== "string" || !target.startsWith("subcircuit:")) {
    return null;
  }
  const name = target.slice("subcircuit:".length).toLowerCase();
  return (
    project.documents.find(
      (candidate) =>
        candidate.name.toLowerCase() === name ||
        candidate.sourceBinding?.cellName.toLowerCase() === name,
    )?.id ?? null
  );
}
