import { useState } from "react";

import type {
  ProjectStructureEdit,
  SchematicEdit,
  WireSource,
} from "@icm/edit-engine";
import {
  createHierarchyInstance,
  planCreateCellPort,
  planPlaceCellInstance,
} from "@icm/edit-engine";
import type { SchematicStyleProfile } from "@icm/derived";
import { defaultDraftTextDocument, semanticTextDocument } from "@icm/model";
import type {
  CircuitProject,
  Point,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import type { ComponentInsertRequest } from "./insert-component-dialog";
import {
  powerConnectionForSymbol,
  proposePlacementContact,
  proposedStandalonePowerConnection,
  type PlacementContactProposal,
} from "./placement-connectivity";
import { planVddRailEdits } from "./vdd-rail";
import { vddPowerLabelAnnotation } from "./vdd-power-label";
import {
  defaultInstanceLabel,
  defaultInstanceValue,
} from "../wiring/route-interaction-geometry";
import {
  initialInstanceNetlist,
  netlistReferenceMatchesPlacement,
  nextInstanceDesignator,
} from "../netlist-export/netlist-authoring";
import {
  defaultRazaviSymbolVariantId,
  razaviManualBulkConnectionEdits,
} from "../../presentation/razavi-presentation";
import type { ScreenFlip } from "../../interaction/shortcut-orientation";
import type { PendingComponentPlacement } from "../../interaction/interaction-state";

type TransactionResult = { ok: boolean; revision: number };

export interface UseComponentPlacementOptions {
  recentStorageKey: string;
  document: SchematicDocument;
  project: CircuitProject;
  resolver: SymbolResolver;
  styleProfile: SchematicStyleProfile;
  visibleEndpoints: readonly WireSource[];
  transact: (
    edits: SchematicEdit[],
    options?: { preserveInteraction?: boolean },
  ) => TransactionResult;
  transactProject: (
    transactionId: string,
    edits: ProjectStructureEdit[],
  ) => boolean;
  selectOnly: (kind: "instance" | "route", ids: readonly string[]) => void;
  cancelAllTransientInteraction: () => void;
  cancelCanvasDrag: () => void;
  clearTransientCanvasState: () => void;
  paintSnapGuides: (guides: []) => void;
  beginVddRailInteraction: () => void;
  beginComponentPlacement: (request: PendingComponentPlacement) => void;
  rotateComponentPlacement: (delta: 90 | -90) => void;
  mirrorComponentPlacement: (direction: ScreenFlip) => void;
  componentPlacementRotation: 0 | 90 | 180 | 270;
  componentPlacementMirror: NonNullable<
    SchematicDocument["instances"][number]["placement"]
  >["mirror"];
  completeVddRailPlacement: () => void;
  setComponentPreviewPoint: (point: Point) => void;
  setStatus: (status: string) => void;
  vddRailMode: boolean;
  vddRailStart: Point | null;
  pendingSymbolId: string | null;
  pendingComponentPlacement: PendingComponentPlacement | null;
  setVddRailStart: (point: Point) => void;
  setVddRailPreviewPoint: (point: Point) => void;
}

/** Flat owner of component/VDD placement, dialog recents, and its transactions. */
export function useComponentPlacement(options: UseComponentPlacementOptions) {
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [cellInsertOnly, setCellInsertOnly] = useState(false);
  const [recentSymbolIds, setRecentSymbolIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(options.recentStorageKey) ?? "[]",
      );
      return Array.isArray(stored)
        ? stored.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  });

  const placeNewComponent = (
    symbolId: string,
    position: Point,
    placementRequest: PendingComponentPlacement,
  ): void => {
    if (placementRequest.kind !== "symbol") return;
    const id = nextInstanceDesignator(options.document, symbolId);
    const symbolVariantId = defaultRazaviSymbolVariantId(symbolId);
    const instance = {
      id,
      symbolId,
      ...(symbolVariantId ? { symbolVariantId } : {}),
      placement: {
        position,
        rotation: options.componentPlacementRotation,
        mirror: options.componentPlacementMirror,
      },
      netlist: initialInstanceNetlist(
        options.document,
        symbolId,
        placementRequest.parameters,
        netlistReferenceMatchesPlacement(symbolId) ? id : undefined,
      ),
    };
    const defaultLabel = defaultInstanceLabel(
      options.document,
      instance,
      options.resolver,
      options.styleProfile,
    );
    const instanceLabel =
      placementRequest.showReference && defaultLabel
        ? {
            ...defaultLabel,
            content: semanticTextDocument(
              placementRequest.referenceText ?? instance.id,
              "instance-label",
            ),
          }
        : null;
    const instanceValue = placementRequest.showValue
      ? defaultInstanceValue(
          options.document,
          instance,
          options.resolver,
          options.styleProfile,
        )
      : null;
    const contact = proposePlacementContact(
      options.document,
      options.resolver,
      instance,
      options.visibleEndpoints,
    );
    const standalonePower: PlacementContactProposal =
      contact.matched || contact.ambiguous
        ? { edits: [], matched: false, ambiguous: false }
        : proposedStandalonePowerConnection(options.document, instance);
    const powerRejection = contact.rejected ?? standalonePower.rejected;
    if (powerRejection) {
      options.setStatus(`Cannot place ${id}: ${powerRejection}`);
      return;
    }
    const powerNetId = standalonePower.powerNetId ?? contact.powerNetId;
    const vddPowerLabel =
      powerConnectionForSymbol(symbolId)?.domain === "vdd" && powerNetId
        ? vddPowerLabelAnnotation({
            instanceId: id,
            netId: powerNetId,
            position,
          })
        : null;
    const projectedDocument = structuredClone(options.document);
    projectedDocument.instances.push(instance);
    for (const edit of [...contact.edits, ...standalonePower.edits]) {
      if (edit.kind !== "connect_endpoints" || !edit.newNetId) continue;
      projectedDocument.nets.push({
        id: edit.newNetId,
        ...(edit.newNetName ? { name: edit.newNetName } : {}),
        scope: edit.newNetScope ?? "local",
        terminals: [edit.from, edit.to]
          .filter(
            (
              endpoint,
            ): endpoint is Extract<RouteEndpoint, { kind: "terminal" }> =>
              endpoint.kind === "terminal",
          )
          .map(({ instanceId, pinName }) => ({ instanceId, pinName }))
          .filter(
            (terminal, index, terminals) =>
              terminals.findIndex(
                (candidate) =>
                  candidate.instanceId === terminal.instanceId &&
                  candidate.pinName === terminal.pinName,
              ) === index,
          ),
      });
    }
    const result = options.transact(
      [
        { kind: "add_instance", instance },
        ...contact.edits,
        ...standalonePower.edits,
        ...razaviManualBulkConnectionEdits(
          projectedDocument,
          projectedDocument.instances,
        ),
        ...(vddPowerLabel
          ? [
              {
                kind: "upsert_schematic_annotation" as const,
                annotation: vddPowerLabel,
              },
            ]
          : []),
        ...(instanceLabel
          ? [
              {
                kind: "upsert_schematic_annotation" as const,
                annotation: instanceLabel,
              },
            ]
          : []),
        ...(instanceValue
          ? [
              {
                kind: "upsert_schematic_annotation" as const,
                annotation: instanceValue,
              },
            ]
          : []),
      ],
      { preserveInteraction: true },
    );
    if (!result.ok) return;
    options.selectOnly("instance", [id]);
    options.setComponentPreviewPoint(position);
    options.setStatus(
      contact.ambiguous
        ? `Added ${id} (${symbolId}); overlapping pins are ambiguous, wire explicitly · click to place another · Esc exits`
        : contact.matched
          ? `Added ${id} (${symbolId}) and connected its contacted pin · click to place another · Esc exits`
          : `Added ${id} (${symbolId}) · click to place another · Esc exits`,
    );
  };

  const placeNewCell = (
    symbolId: string,
    position: Point,
    placementRequest: PendingComponentPlacement,
  ): void => {
    if (
      placementRequest.kind !== "cell" ||
      !placementRequest.childDocumentId ||
      !placementRequest.cellName
    ) {
      return;
    }
    const child = options.project.documents.find(
      (candidate) => candidate.id === placementRequest.childDocumentId,
    );
    if (!child?.netlist) {
      options.setStatus("The selected Cell no longer exists");
      return;
    }
    const id = nextInstanceDesignator(options.document, symbolId);
    const instance = createHierarchyInstance(id, child, {
      position,
      rotation: options.componentPlacementRotation,
      mirror: options.componentPlacementMirror,
    });
    const defaultLabel = defaultInstanceLabel(
      options.document,
      instance,
      options.resolver,
      options.styleProfile,
    );
    const instanceValue = defaultLabel
      ? {
          ...defaultLabel,
          id: `instance-value-${instance.id}`,
          kind: "instance-value" as const,
          content: defaultDraftTextDocument(placementRequest.cellName),
        }
      : null;
    const committed = options.transactProject(
      "place-cell-instance",
      planPlaceCellInstance(
        options.project,
        options.document.id,
        instance,
        [instanceValue].filter(
          (annotation): annotation is NonNullable<typeof annotation> =>
            annotation !== null,
        ),
      ),
    );
    if (!committed) return;
    options.selectOnly("instance", [id]);
    options.setComponentPreviewPoint(position);
    options.setStatus(
      `Placed ${placementRequest.cellName} as ${id} · click to place another · Esc exits`,
    );
  };

  const placeNewCellPort = (
    symbolId: "port" | "port-filled",
    position: Point,
    placementRequest: PendingComponentPlacement,
  ): void => {
    const id = nextInstanceDesignator(options.document, symbolId);
    const formalName = placementRequest.formalName ?? id;
    if (
      placementRequest.kind !== "cell-port" ||
      !placementRequest.direction ||
      options.document.netlist?.terminals.some(
        (terminal) => terminal.name === formalName,
      )
    ) {
      options.setStatus(`Cell port ${formalName} already exists`);
      return;
    }
    const instance = {
      id,
      symbolId,
      placement: {
        position,
        rotation: options.componentPlacementRotation,
        mirror: options.componentPlacementMirror,
      },
      parameters: {},
      netlist: initialInstanceNetlist(options.document, symbolId, {}),
    };
    const annotation = defaultInstanceLabel(
      options.document,
      instance,
      options.resolver,
      options.styleProfile,
    );
    const contact = proposePlacementContact(
      options.document,
      options.resolver,
      instance,
      options.visibleEndpoints,
    );
    if (contact.rejected || contact.ambiguous) {
      options.setStatus(
        contact.rejected ?? "Port overlaps multiple Nets; choose one contact",
      );
      return;
    }
    const baseNetId = `net-cell-port-${id.toLowerCase()}`;
    let netId = contact.netId ?? baseNetId;
    let netSuffix = 2;
    while (
      !contact.netId &&
      options.document.nets.some((net) => net.id.toLowerCase() === netId)
    ) {
      netId = `${baseNetId}-${netSuffix}`;
      netSuffix += 1;
    }
    const connectionEdits: SchematicEdit[] = [
      ...contact.edits,
      ...(contact.matched
        ? []
        : [
            {
              kind: "connect_endpoints" as const,
              from: {
                kind: "terminal" as const,
                instanceId: id,
                pinName: "P",
              },
              to: {
                kind: "terminal" as const,
                instanceId: id,
                pinName: "P",
              },
              newNetId: netId,
            },
          ]),
    ];
    const committed = options.transactProject(
      "place-cell-port",
      planCreateCellPort(options.project, options.document.id, {
        instance,
        connectionEdits,
        terminal: {
          id: `terminal-${id.toLowerCase()}`,
          name: formalName,
          netId,
          direction: placementRequest.direction,
          interfaceInstanceId: id,
        },
        ...(annotation
          ? {
              annotation: {
                ...annotation,
                content: semanticTextDocument(formalName, "formal-port"),
              },
            }
          : {}),
      }),
    );
    if (!committed) return;
    options.selectOnly("instance", [id]);
    options.setComponentPreviewPoint(position);
    options.setStatus(
      `Added Cell port ${formalName} · click to place another · Esc exits`,
    );
  };

  const placeVddRail = (start: Point, end: Point): void => {
    const idsExist = (candidate: string): boolean => {
      const key = candidate.toLowerCase();
      return (
        options.document.instances.some(
          (instance) => instance.id === candidate,
        ) ||
        options.document.routes.some(
          (route) => route.id === `route-${key}-rail`,
        ) ||
        options.document.junctions.some(
          (junction) =>
            junction.id === `junction-${key}-start` ||
            junction.id === `junction-${key}-end`,
        ) ||
        options.document.annotations.some(
          (annotation) => annotation.id === `label-${candidate}`,
        )
      );
    };
    let sequence = 1;
    while (idsExist(`VDD${sequence}`)) sequence += 1;
    const instanceId = `VDD${sequence}`;
    const routeId = `route-${instanceId.toLowerCase()}-rail`;
    const railPlan = planVddRailEdits(options.document, {
      instanceId,
      start,
      end,
    });
    if (!railPlan.ok) {
      options.setStatus(`Cannot add VDD rail: ${railPlan.message}`);
      return;
    }
    const result = options.transact([...railPlan.edits]);
    if (!result.ok) return;
    options.selectOnly("route", [routeId]);
    options.completeVddRailPlacement();
    options.setStatus(`Added VDD rail ${instanceId}`);
  };

  const openInsertComponentDialog = (cellOnly = false): void => {
    options.cancelAllTransientInteraction();
    setCellInsertOnly(cellOnly);
    setInsertDialogOpen(true);
    options.setStatus(
      cellOnly ? "Choose a Cell to place" : "Choose a component to place",
    );
  };

  const beginInsertedComponentPlacement = (
    request: ComponentInsertRequest,
  ): void => {
    const nextRecent = [
      request.symbolId,
      ...recentSymbolIds.filter((symbolId) => symbolId !== request.symbolId),
    ].slice(0, 8);
    setRecentSymbolIds(nextRecent);
    try {
      window.localStorage.setItem(
        options.recentStorageKey,
        JSON.stringify(nextRecent),
      );
    } catch {
      // Recency is convenience-only and must never block placement.
    }
    options.cancelCanvasDrag();
    options.clearTransientCanvasState();
    options.paintSnapGuides([]);
    setInsertDialogOpen(false);
    setCellInsertOnly(false);
    if (request.kind === "vdd-rail") {
      options.beginVddRailInteraction();
      options.setStatus("Place VDD Rail: click the first end · Esc cancels");
      return;
    }
    const pendingRequest: PendingComponentPlacement =
      request.kind === "symbol" &&
      options.document.id !== options.project.topDocumentId &&
      (request.symbolId === "port" || request.symbolId === "port-filled")
        ? {
            kind: "cell-port",
            symbolId: request.symbolId,
            parameters: {},
            initialRotation: request.initialRotation,
            showReference: false,
            referenceText: null,
            showValue: false,
            direction: "passive",
          }
        : request;
    options.beginComponentPlacement(pendingRequest);
    options.setStatus(
      `Place ${request.symbolName} on the canvas · R rotates · Shift+R / Ctrl+R mirrors · Esc cancels`,
    );
  };

  const cancelComponentInsert = (): void => {
    setInsertDialogOpen(false);
    setCellInsertOnly(false);
    options.cancelAllTransientInteraction();
    options.setStatus("Component insertion cancelled");
  };

  const closeInsertDialog = (): void => {
    setInsertDialogOpen(false);
    setCellInsertOnly(false);
  };

  const rotatePendingComponent = (delta: 90 | -90): void => {
    options.rotateComponentPlacement(delta);
    options.setStatus(`Component rotation ${delta > 0 ? "+90°" : "−90°"}`);
  };

  const mirrorPendingComponent = (direction: ScreenFlip): void => {
    options.mirrorComponentPlacement(direction);
    options.setStatus(
      `Place component mirrored ${direction === "left-right" ? "left/right" : "top/bottom"} · R rotates · Esc cancels`,
    );
  };

  const commitPendingPlacementAt = (point: Point): void => {
    if (options.vddRailMode) {
      if (!options.vddRailStart) {
        options.setVddRailStart(point);
        options.setVddRailPreviewPoint(point);
        options.setStatus("VDD rail: click the right end (Esc cancels)");
      } else if (point.x === options.vddRailStart.x) {
        options.setStatus("VDD rail needs a non-zero horizontal length");
      } else {
        placeVddRail(options.vddRailStart, {
          x: point.x,
          y: options.vddRailStart.y,
        });
      }
      return;
    }
    if (!options.pendingSymbolId || !options.pendingComponentPlacement) return;
    if (options.pendingComponentPlacement.kind === "cell-port") {
      placeNewCellPort(
        options.pendingSymbolId as "port" | "port-filled",
        point,
        options.pendingComponentPlacement,
      );
    } else if (options.pendingComponentPlacement.kind === "cell") {
      placeNewCell(
        options.pendingSymbolId,
        point,
        options.pendingComponentPlacement,
      );
    } else {
      placeNewComponent(
        options.pendingSymbolId,
        point,
        options.pendingComponentPlacement,
      );
    }
  };

  return {
    beginInsertedComponentPlacement,
    cancelComponentInsert,
    cellInsertOnly,
    closeInsertDialog,
    commitPendingPlacementAt,
    insertDialogOpen,
    mirrorPendingComponent,
    openInsertComponentDialog,
    recentSymbolIds,
    rotatePendingComponent,
  };
}
