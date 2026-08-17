import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { SchematicEdit } from "@icm/edit-engine";
import { flattenRichText } from "@icm/model";
import type { Annotation, DraftingObject, SchematicDocument } from "@icm/model";

import {
  componentParameters,
  effectiveComponentParameterValue,
} from "../component-insert/component-parameters";
import {
  createTextEditingSession,
  proposeTextEditingCommit,
  textDeletionEdit,
  updateTextEditingSession,
} from "../text-editing/text-editing";
import type { TextEditingSession } from "../text-editing/text-editing";

export interface InstancePropertyDraft {
  instanceId: string | null;
  parameters: Record<string, string>;
  x: string;
  y: string;
  rotation: "0" | "90" | "180" | "270";
}

const EMPTY_INSTANCE_PROPERTY_DRAFT: InstancePropertyDraft = {
  instanceId: null,
  parameters: {},
  x: "",
  y: "",
  rotation: "0",
};

type TransactionResult = { ok: boolean; revision: number };
type Route = SchematicDocument["routes"][number];
type Instance = SchematicDocument["instances"][number];

export interface UsePropertiesEditorOptions {
  document: SchematicDocument;
  selectedRoute: Route | undefined;
  selectedRouteNetLabel: Annotation | null;
  selectedRouteNetLabels: readonly Annotation[];
  selectedInstance: Instance | undefined;
  wireSourceActive: boolean;
  netLabelEditorInputRef: MutableRefObject<HTMLInputElement | null>;
  transact: (edits: SchematicEdit[]) => TransactionResult;
  setStatus: (status: string) => void;
  replaceSelectionKind: (kind: "annotation", ids: readonly string[]) => void;
  selectOnly: (kind: "annotation", ids: readonly string[]) => void;
  selectDraftingObject: (id: string) => void;
  clearSelectionKinds: (kinds: readonly ("annotation" | "drafting")[]) => void;
  netLabelForRoute: (route: Route) => Annotation | null | undefined;
  netLabelEditsForRoute: (
    route: Route,
    draft: string,
  ) => SchematicEdit[] | null;
  instancePropertyEdits: (draft: InstancePropertyDraft) => {
    edits: SchematicEdit[];
    invalidPosition: boolean;
  };
}

/** Flat owner for property drafts, Net Labels, and canvas text sessions. */
export function usePropertiesEditor(options: UsePropertiesEditorOptions) {
  const [netLabelDraft, setNetLabelDraft] = useState("");
  const [netLabelEditorOpen, setNetLabelEditorOpen] = useState(false);
  const [instancePropertyDraft, setInstancePropertyDraft] =
    useState<InstancePropertyDraft>(EMPTY_INSTANCE_PROPERTY_DRAFT);
  const [textEditing, setTextEditing] = useState<TextEditingSession | null>(
    null,
  );
  const netLabelDraftRouteRef = useRef<string | null>(null);
  const lastSelectedInstanceIdRef = useRef<string | null>(null);

  const draftForInstance = (instance: Instance): InstancePropertyDraft => ({
    instanceId: instance.id,
    parameters: Object.fromEntries(
      componentParameters(instance.symbolId).map((parameter) => [
        parameter.key,
        effectiveComponentParameterValue(instance, parameter),
      ]),
    ),
    x: instance.placement ? String(instance.placement.position.x) : "",
    y: instance.placement ? String(instance.placement.position.y) : "",
    rotation: String(instance.placement?.rotation ?? 0) as
      "0" | "90" | "180" | "270",
  });

  const commitPendingNetLabelDraft = (): void => {
    const routeId = netLabelDraftRouteRef.current;
    netLabelDraftRouteRef.current = null;
    if (!routeId) return;
    const route = options.document.routes.find(
      (candidate) => candidate.id === routeId,
    );
    if (!route) return;
    const existing = options.netLabelForRoute(route);
    const draftName = netLabelDraft.trim();
    const currentName = existing
      ? flattenRichText(existing.content).trim()
      : "";
    if (existing ? draftName === currentName : draftName === "") return;
    const edits = options.netLabelEditsForRoute(route, netLabelDraft);
    if (!edits) return;
    if (options.transact(edits).ok) {
      options.setStatus(
        draftName ? `Saved Net Label ${draftName}` : "Removed Net Label",
      );
    }
  };

  useEffect(() => {
    commitPendingNetLabelDraft();
    if (!options.selectedRoute) {
      setNetLabelDraft("");
      setNetLabelEditorOpen(false);
      return;
    }
    setNetLabelDraft(
      options.selectedRouteNetLabel
        ? flattenRichText(options.selectedRouteNetLabel.content)
        : "",
    );
    netLabelDraftRouteRef.current = options.selectedRoute.id;
  }, [options.selectedRoute, options.selectedRouteNetLabel]);

  useEffect(() => {
    const previousInstanceId = lastSelectedInstanceIdRef.current;
    lastSelectedInstanceIdRef.current = options.selectedInstance?.id ?? null;
    if ((options.selectedInstance?.id ?? null) !== previousInstanceId) {
      const pending = options.instancePropertyEdits(instancePropertyDraft);
      if (pending.edits.length > 0) options.transact(pending.edits);
    }
    setInstancePropertyDraft(
      options.selectedInstance
        ? draftForInstance(options.selectedInstance)
        : EMPTY_INSTANCE_PROPERTY_DRAFT,
    );
  }, [options.selectedInstance]);

  const applyNetLabel = (): void => {
    const route = options.selectedRoute;
    if (!route) return;
    const existingLabel = options.netLabelForRoute(route);
    const name = netLabelDraft.trim();
    if (!name && !existingLabel) {
      options.setStatus("Selected Route has no Net Label");
      return;
    }
    const edits = options.netLabelEditsForRoute(route, netLabelDraft);
    if (!edits || !options.transact(edits).ok) return;
    netLabelDraftRouteRef.current = null;
    if (!name) {
      options.replaceSelectionKind("annotation", []);
      options.setStatus(
        `Deleted Net Label ${flattenRichText(existingLabel!.content)}`,
      );
      return;
    }
    options.replaceSelectionKind("annotation", [
      existingLabel?.id ?? `net-label-${route.id}`,
    ]);
    options.setStatus(
      edits.some((edit) => edit.kind === "merge_nets")
        ? `Connected Nets through label ${name}`
        : `Named Net ${name}`,
    );
  };

  const deleteSelectedRouteNetLabel = (): void => {
    const label = options.selectedRouteNetLabel;
    if (!options.selectedRoute || !label) {
      options.setStatus(
        options.selectedRouteNetLabels.length > 1
          ? "This Net has multiple labels; select the label to delete"
          : "Selected Route has no Net Label",
      );
      return;
    }
    if (
      options.transact([
        { kind: "remove_schematic_annotation", annotationId: label.id },
      ]).ok
    ) {
      options.replaceSelectionKind("annotation", []);
      setNetLabelDraft("");
      options.setStatus(`Deleted Net Label ${flattenRichText(label.content)}`);
    }
  };

  const commitInstancePropertyDraft = (): boolean => {
    const { edits, invalidPosition } = options.instancePropertyEdits(
      instancePropertyDraft,
    );
    return !invalidPosition && edits.length > 0 && options.transact(edits).ok;
  };

  const applyInstanceProperties = (): void => {
    const instance = options.selectedInstance;
    if (!instance || instancePropertyDraft.instanceId !== instance.id) return;
    const { edits, invalidPosition } = options.instancePropertyEdits(
      instancePropertyDraft,
    );
    if (invalidPosition) {
      options.setStatus("Position must contain finite X and Y coordinates");
      return;
    }
    if (edits.length === 0) {
      options.setStatus("Component properties are unchanged");
      return;
    }
    if (options.transact(edits).ok) {
      options.setStatus(`Updated properties for ${instance.id}`);
    }
  };

  const discardInstancePropertyDraft = (): void => {
    if (!options.selectedInstance) return;
    setInstancePropertyDraft(draftForInstance(options.selectedInstance));
    options.setStatus(
      `Discarded property edits for ${options.selectedInstance.id}`,
    );
  };

  const beginNetLabelEditing = (): void => {
    if (!options.selectedRoute || options.wireSourceActive) {
      options.setStatus("Select a wire segment before adding a Net Label");
      return;
    }
    setNetLabelEditorOpen(true);
    requestAnimationFrame(() =>
      options.netLabelEditorInputRef.current?.focus(),
    );
  };

  const commitNetLabelEditing = (): void => {
    applyNetLabel();
    setNetLabelEditorOpen(false);
  };

  const beginAnnotationTextEditing = (annotation: Annotation): void => {
    options.selectOnly("annotation", [annotation.id]);
    setTextEditing(
      createTextEditingSession({ owner: "annotation", object: annotation }),
    );
  };

  const beginDraftingTextEditing = (
    object: Extract<DraftingObject, { kind: "text" }>,
  ): void => {
    options.selectDraftingObject(object.id);
    setTextEditing(createTextEditingSession({ owner: "drafting", object }));
  };

  const updateTextEditing = (
    change: Partial<Pick<TextEditingSession, "content" | "sizeScale">>,
  ): void => {
    setTextEditing((current) =>
      current ? updateTextEditingSession(current, change) : null,
    );
  };

  const deleteTextEditing = (): void => {
    if (!textEditing) return;
    if (options.transact([textDeletionEdit(textEditing)]).ok) {
      options.clearSelectionKinds(["annotation", "drafting"]);
      setTextEditing(null);
      options.setStatus(`Deleted text ${textEditing.id}`);
    }
  };

  const commitTextEditing = (): void => {
    if (!textEditing) return;
    const proposal = proposeTextEditingCommit(options.document, textEditing);
    if (proposal.kind === "blocked") return;
    if (proposal.kind === "unchanged") {
      setTextEditing(null);
      return;
    }
    if (!options.transact([proposal.edit]).ok) return;
    if (proposal.kind === "delete") {
      options.clearSelectionKinds(["annotation", "drafting"]);
      options.setStatus(`Deleted text ${proposal.id}`);
    } else {
      options.setStatus(`Updated text ${proposal.id}`);
    }
    setTextEditing(null);
  };

  return {
    applyInstanceProperties,
    applyNetLabel,
    beginAnnotationTextEditing,
    beginDraftingTextEditing,
    beginNetLabelEditing,
    commitInstancePropertyDraft,
    commitNetLabelEditing,
    commitPendingNetLabelDraft,
    commitTextEditing,
    clearTextEditing: () => setTextEditing(null),
    deleteSelectedRouteNetLabel,
    deleteTextEditing,
    discardInstancePropertyDraft,
    instancePropertyDraft,
    netLabelDraft,
    netLabelEditorOpen,
    setInstancePropertyDraft,
    setNetLabelDraft,
    setNetLabelEditorOpen,
    textEditing,
    updateTextEditing,
  };
}
