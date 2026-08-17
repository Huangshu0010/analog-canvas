import { useState } from "react";

import type { ComponentInsertRequest } from "./insert-component-dialog";
import type { ScreenFlip } from "../../interaction/shortcut-orientation";
import type { Point } from "@icm/model";
import type { PendingComponentPlacement } from "../../interaction/interaction-state";

export interface UseComponentPlacementOptions {
  recentStorageKey: string;
  cancelAllTransientInteraction: () => void;
  cancelCanvasDrag: () => void;
  clearTransientCanvasState: () => void;
  paintSnapGuides: (guides: []) => void;
  beginVddRailInteraction: () => void;
  beginComponentPlacement: (request: ComponentInsertRequest) => void;
  rotateComponentPlacement: (delta: 90 | -90) => void;
  mirrorComponentPlacement: (direction: ScreenFlip) => void;
  setStatus: (status: string) => void;
  vddRailMode: boolean;
  vddRailStart: Point | null;
  pendingSymbolId: string | null;
  pendingComponentPlacement: PendingComponentPlacement | null;
  setVddRailStart: (point: Point) => void;
  setVddRailPreviewPoint: (point: Point) => void;
  placeVddRail: (start: Point, end: Point) => void;
  placeNewComponent: (
    symbolId: string,
    point: Point,
    placement: PendingComponentPlacement,
  ) => void;
}

/** Flat placement dialog and component-placement command owner. */
export function useComponentPlacement(options: UseComponentPlacementOptions) {
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [recentSymbolIds, setRecentSymbolIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(window.localStorage.getItem(options.recentStorageKey) ?? "[]");
      return Array.isArray(stored)
        ? stored.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  });

  const openInsertComponentDialog = (): void => {
    options.cancelAllTransientInteraction();
    setInsertDialogOpen(true);
    options.setStatus("Choose a component to place");
  };

  const beginInsertedComponentPlacement = (request: ComponentInsertRequest): void => {
    const nextRecent = [
      request.symbolId,
      ...recentSymbolIds.filter((symbolId) => symbolId !== request.symbolId),
    ].slice(0, 8);
    setRecentSymbolIds(nextRecent);
    try {
      window.localStorage.setItem(options.recentStorageKey, JSON.stringify(nextRecent));
    } catch {
      // Recency is convenience-only and must never block placement.
    }
    options.cancelCanvasDrag();
    options.clearTransientCanvasState();
    options.paintSnapGuides([]);
    setInsertDialogOpen(false);
    if (request.kind === "vdd-rail") {
      options.beginVddRailInteraction();
      options.setStatus("Place VDD Rail: click the first end · Esc cancels");
      return;
    }
    options.beginComponentPlacement(request);
    options.setStatus(
      `Place ${request.symbolName} on the canvas · R rotates · Shift+R / Ctrl+R mirrors · Esc cancels`,
    );
  };

  const cancelComponentInsert = (): void => {
    setInsertDialogOpen(false);
    options.cancelAllTransientInteraction();
    options.setStatus("Component insertion cancelled");
  };

  const closeInsertDialog = (): void => setInsertDialogOpen(false);

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
        options.placeVddRail(options.vddRailStart, {
          x: point.x,
          y: options.vddRailStart.y,
        });
      }
      return;
    }
    if (!options.pendingSymbolId || !options.pendingComponentPlacement) return;
    options.placeNewComponent(
      options.pendingSymbolId,
      point,
      options.pendingComponentPlacement,
    );
  };

  return {
    beginInsertedComponentPlacement,
    cancelComponentInsert,
    closeInsertDialog,
    insertDialogOpen,
    recentSymbolIds,
    openInsertComponentDialog,
    rotatePendingComponent,
    mirrorPendingComponent,
    commitPendingPlacementAt,
  };
}
