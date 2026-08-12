import { executeTransaction, type SchematicEdit } from "@icm/edit-engine";
import { mosBulkShouldBeVisible, resolveMosBulkConnection } from "@icm/derived";
import { replaceProjectDocument } from "../document/editor-session";
import type { CircuitProject, SchematicDocument } from "@icm/model";
import { builtInSymbols, createProjectSymbolResolver } from "@icm/symbols";

const DEFAULT_SYMBOL_VARIANTS: Readonly<Record<string, string>> = {
  nmos: "textbook-3terminal",
  pmos: "textbook-3terminal",
};

export function defaultRazaviSymbolVariantId(
  symbolId: string,
): string | undefined {
  return DEFAULT_SYMBOL_VARIANTS[symbolId];
}

/** Compatibility helper: explicit body-bias is information, never an error. */
export function razaviHiddenBulkRisk(
  document: SchematicDocument,
  instanceId: string,
): SchematicDocument["nets"][number] | undefined {
  const resolution = resolveMosBulkConnection(document, instanceId);
  return resolution?.status === "explicit" &&
    mosBulkShouldBeVisible(document, instanceId)
    ? resolution.net
    : undefined;
}

/** One Edit-Engine operation owns all manual MOS default/fallback materialization. */
export function razaviManualBulkConnectionEdits(
  document: SchematicDocument,
  instances: readonly SchematicDocument["instances"][number][],
): SchematicEdit[] {
  const instanceIds = instances
    .filter((instance) => {
      const resolution = resolveMosBulkConnection(document, instance);
      return Boolean(
        resolution &&
        !resolution.materialized &&
        (resolution.status === "cell-default" ||
          resolution.status === "product-fallback"),
      );
    })
    .map((instance) => instance.id);
  return instanceIds.length > 0
    ? [{ kind: "reconcile_mos_bulk", instanceIds }]
    : [];
}

/**
 * Upgrade manual-authoring bulk defaults at a Project entry boundary. This is
 * intentionally performed before the editor history/recovery graph is
 * installed, so compatibility materialization is not presented as a human
 * edit or stored as a spurious unsaved recovery.
 */
export function materializeRazaviProjectBulkConnections(
  project: CircuitProject,
): { project: CircuitProject; instanceCount: number } {
  let nextProject = structuredClone(project);
  let instanceCount = 0;
  for (const sourceDocument of [...nextProject.documents]) {
    const edits = razaviManualBulkConnectionEdits(
      sourceDocument,
      sourceDocument.instances,
    );
    if (edits.length === 0) continue;
    const affectedCount =
      edits[0]?.kind === "reconcile_mos_bulk"
        ? (edits[0].instanceIds?.length ?? sourceDocument.instances.length)
        : 0;
    const result = executeTransaction(
      sourceDocument,
      {
        transactionId: `razavi-bulk-entry-${sourceDocument.id}`,
        documentId: sourceDocument.id,
        expectedRevision: sourceDocument.revision,
        // This is a deterministic editor compatibility transform, not an
        // Agent request. It executes before user history is installed.
        actor: { kind: "human", id: "razavi-bulk-entry" },
        edits,
      },
      {
        symbolResolver: createProjectSymbolResolver(
          nextProject,
          builtInSymbols,
        ),
      },
    );
    if (!result.ok) {
      throw new Error(
        `Cannot materialize Razavi bulk defaults for ${sourceDocument.id}: ${result.error.message}`,
      );
    }
    nextProject = replaceProjectDocument(nextProject, result.document);
    instanceCount += affectedCount;
  }
  return { project: nextProject, instanceCount };
}

export function razaviBulkAnchorIsVisible(
  document: SchematicDocument,
  instanceId: string,
): boolean {
  return mosBulkShouldBeVisible(document, instanceId);
}

export function razaviMosPresentationEdits(
  document: SchematicDocument,
): SchematicEdit[] {
  return document.instances.flatMap((instance) => {
    const symbolVariantId = defaultRazaviSymbolVariantId(instance.symbolId);
    if (!symbolVariantId || instance.symbolVariantId === symbolVariantId) {
      return [];
    }
    return [
      {
        kind: "set_instance_symbol",
        instanceId: instance.id,
        symbolId: instance.symbolId,
        symbolVariantId,
      },
    ];
  });
}
