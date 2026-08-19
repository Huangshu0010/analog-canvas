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

function sameInstancePropertyDraft(
  left: InstancePropertyDraft,
  right: InstancePropertyDraft,
): boolean {
  if (
    left.instanceId !== right.instanceId ||
    left.x !== right.x ||
    left.y !== right.y ||
    left.rotation !== right.rotation
  ) {
    return false;
  }
  const keys = new Set([
    ...Object.keys(left.parameters),
    ...Object.keys(right.parameters),
  ]);
  return [...keys].every(
    (key) => left.parameters[key] === right.parameters[key],
  );
}

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
  referenceLabelVisibilityEdits: (
    instanceIds: readonly string[],
    visible: boolean,
  ) => SchematicEdit[];
  valueVisibilityEdits: (
    source: SchematicDocument,
    instanceIds: readonly string[],
    visible: boolean,
  ) => SchematicEdit[];
  commitCellPortAnnotation?: (annotation: Annotation, name: string) => boolean;
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
  const instancePropertyDraftRef = useRef<InstancePropertyDraft>(
    EMPTY_INSTANCE_PROPERTY_DRAFT,
  );
  const instancePropertyBaselineRef = useRef<InstancePropertyDraft>(
    EMPTY_INSTANCE_PROPERTY_DRAFT,
  );

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
    const instanceId = options.selectedInstance?.id ?? null;
    if (instanceId === lastSelectedInstanceIdRef.current) return;
    lastSelectedInstanceIdRef.current = instanceId;
    const nextDraft = options.selectedInstance
      ? draftForInstance(options.selectedInstance)
      : EMPTY_INSTANCE_PROPERTY_DRAFT;
    instancePropertyDraftRef.current = nextDraft;
    instancePropertyBaselineRef.current = nextDraft;
    setInstancePropertyDraft(nextDraft);
  }, [options.selectedInstance]);

  const updateInstancePropertyDraft = (
    update: (current: InstancePropertyDraft) => InstancePropertyDraft,
  ): void => {
    const nextDraft = update(instancePropertyDraftRef.current);
    instancePropertyDraftRef.current = nextDraft;
    setInstancePropertyDraft(nextDraft);
    if (
      !options.selectedInstance ||
      nextDraft.instanceId !== options.selectedInstance.id
    ) {
      return;
    }
    const { edits, invalidPosition } = options.instancePropertyEdits(nextDraft);
    if (!invalidPosition && edits.length > 0) options.transact(edits);
  };

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

  const updateNetLabelDraft = (draft: string): void => {
    setNetLabelDraft(draft);
    const route = options.selectedRoute;
    if (!route) return;
    const existing = options.netLabelForRoute(route);
    const nextName = draft.trim();
    const currentName = existing
      ? flattenRichText(existing.content).trim()
      : "";
    if (nextName === currentName || (!nextName && !existing)) return;
    const edits = options.netLabelEditsForRoute(route, draft);
    if (!edits || !options.transact(edits).ok) return;
    options.setStatus(
      nextName ? `Saved Net Label ${nextName}` : "Removed Net Label",
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
      instancePropertyDraftRef.current,
    );
    return !invalidPosition && edits.length > 0 && options.transact(edits).ok;
  };

  const discardInstancePropertyDraft = (): void => {
    const instance = options.selectedInstance;
    const baseline = instancePropertyBaselineRef.current;
    if (!instance || baseline.instanceId !== instance.id) return;
    const { edits, invalidPosition } = options.instancePropertyEdits(baseline);
    if (!invalidPosition && edits.length > 0) options.transact(edits);
    instancePropertyDraftRef.current = baseline;
    setInstancePropertyDraft(baseline);
    options.setStatus(`Discarded property edits for ${instance.id}`);
  };

  const setReferenceLabelsVisible = (
    instanceIds: readonly string[],
    visible: boolean,
  ): void => {
    const edits = options.referenceLabelVisibilityEdits(instanceIds, visible);
    if (edits.length === 0) {
      options.setStatus(
        visible
          ? "No reference labels are available for this selection"
          : "Selected components have no reference labels",
      );
      return;
    }
    if (options.transact(edits).ok) {
      options.setStatus(
        `${visible ? "Showing" : "Hiding"} reference labels on ${edits.length} component${edits.length === 1 ? "" : "s"}`,
      );
    }
  };

  const setValueLabelsVisible = (
    instanceIds: readonly string[],
    visible: boolean,
  ): void => {
    const edits = options.valueVisibilityEdits(
      options.document,
      instanceIds,
      visible,
    );
    if (edits.length === 0) {
      options.setStatus(
        visible
          ? "No component values are available for this selection"
          : "Selected components have no value displays",
      );
      return;
    }
    if (options.transact(edits).ok) {
      options.setStatus(
        `${visible ? "Showing" : "Hiding"} component values on ${edits.length} component${edits.length === 1 ? "" : "s"}`,
      );
    }
  };

  const showSelectedInstanceValue = (): void => {
    const instance = options.selectedInstance;
    if (!instance) return;
    const propertyEdits =
      instancePropertyDraft.instanceId === instance.id
        ? options
            .instancePropertyEdits(instancePropertyDraft)
            .edits.filter((edit) => edit.kind === "set_instance_netlist")
        : [];
    const projected = structuredClone(options.document);
    for (const edit of propertyEdits) {
      if (edit.kind !== "set_instance_netlist") continue;
      const target = projected.instances.find(
        (item) => item.id === edit.instanceId,
      );
      if (target) target.netlist = structuredClone(edit.netlist);
    }
    const valueEdits = options.valueVisibilityEdits(
      projected,
      [instance.id],
      true,
    );
    if (propertyEdits.length === 0 && valueEdits.length === 0) {
      options.setStatus("No component value is available for this selection");
      return;
    }
    if (options.transact([...propertyEdits, ...valueEdits]).ok) {
      options.setStatus(`Showing component value for ${instance.id}`);
    }
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
    if (
      proposal.kind === "update" &&
      proposal.edit.kind === "upsert_schematic_annotation" &&
      options.commitCellPortAnnotation &&
      proposal.edit.annotation.kind === "instance-label" &&
      proposal.edit.annotation.anchor.kind === "object"
    ) {
      const name = flattenRichText(proposal.edit.annotation.content).trim();
      if (
        !name ||
        !options.commitCellPortAnnotation(proposal.edit.annotation, name)
      )
        return;
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
    hasInstancePropertyDraftChanges: !sameInstancePropertyDraft(
      instancePropertyDraft,
      instancePropertyBaselineRef.current,
    ),
    netLabelDraft,
    netLabelEditorOpen,
    updateInstancePropertyDraft,
    updateNetLabelDraft,
    setNetLabelEditorOpen,
    setReferenceLabelsVisible,
    setValueLabelsVisible,
    showSelectedInstanceValue,
    textEditing,
    updateTextEditing,
  };
}
