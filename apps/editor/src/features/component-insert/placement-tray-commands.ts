import type { DragEvent } from "react";

import { planInstanceUnplacement, type SchematicEdit } from "@icm/edit-engine";
import type { GridRect, Point, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { missingDefaultInstanceDisplayAnnotations } from "../instance-display/default-instance-display";
import type { SchematicStyleProfile } from "@icm/derived";
import { planPlaceAllUnplacedInstances } from "./placement-tray";

type TransactionResult = { ok: boolean };

export function createPlacementTrayCommands({
  document,
  resolver,
  styleProfile,
  viewBox,
  pointFromDrop,
  transact,
  selectInstance,
  resetSelection,
  setStatus,
  nextSuffix,
}: {
  document: SchematicDocument;
  resolver: SymbolResolver;
  styleProfile: SchematicStyleProfile;
  viewBox: GridRect;
  pointFromDrop: (event: DragEvent<SVGSVGElement>) => Point;
  transact: (edits: SchematicEdit[]) => TransactionResult;
  selectInstance: (id: string) => void;
  resetSelection: () => void;
  setStatus: (status: string) => void;
  nextSuffix: () => number;
}) {
  const handleDrop = (event: DragEvent<SVGSVGElement>): void => {
    event.preventDefault();
    const instanceId = event.dataTransfer.getData("application/x-icm-instance");
    if (!instanceId) return;
    const placement = {
      position: pointFromDrop(event),
      rotation: 0 as const,
      mirror: "none" as const,
    };
    const instance = document.instances.find(
      (candidate) => candidate.id === instanceId,
    );
    const displayAnnotations = instance
      ? missingDefaultInstanceDisplayAnnotations(
          document,
          { ...instance, placement },
          resolver,
          styleProfile,
        )
      : [];
    transact([
      { kind: "place_instance", instanceId, placement },
      ...displayAnnotations.map((annotation) => ({
        kind: "upsert_schematic_annotation" as const,
        annotation,
      })),
    ]);
    selectInstance(instanceId);
  };

  const placeAll = (): void => {
    const edits = planPlaceAllUnplacedInstances(document, viewBox);
    if (edits.length === 0) {
      setStatus("The Placement Tray is empty");
      return;
    }
    const displayEdits = edits.flatMap((edit) => {
      if (edit.kind !== "place_instance") return [];
      const instance = document.instances.find(
        (candidate) => candidate.id === edit.instanceId,
      );
      if (!instance) return [];
      return missingDefaultInstanceDisplayAnnotations(
        document,
        { ...instance, placement: edit.placement },
        resolver,
        styleProfile,
      ).map((annotation) => ({
        kind: "upsert_schematic_annotation" as const,
        annotation,
      }));
    });
    if (transact([...edits, ...displayEdits]).ok) {
      resetSelection();
      setStatus(
        `Placed ${edits.length} retained ${edits.length === 1 ? "Instance" : "Instances"} in a deterministic canvas grid`,
      );
    }
  };

  const returnToTray = (instanceIds: readonly string[]): void => {
    if (instanceIds.length === 0) {
      setStatus("There are no returnable placed Instances");
      return;
    }
    try {
      const edits = planInstanceUnplacement(
        document,
        resolver,
        instanceIds,
        nextSuffix(),
      );
      if (edits.length === 0) {
        setStatus("Those Instances are already retained in the Placement Tray");
        return;
      }
      if (transact(edits).ok) {
        resetSelection();
        const returnedFormalPort = instanceIds.some((instanceId) =>
          document.netlist?.terminals.some((terminal) =>
            terminal.interfaceInstanceIds.includes(instanceId),
          ),
        );
        setStatus(
          `Returned ${instanceIds.length} ${instanceIds.length === 1 ? "Instance" : "Instances"} to the Placement Tray; ${returnedFormalPort ? "Cell interfaces and " : ""}electrical facts were retained`,
        );
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not return to tray",
      );
    }
  };

  return { handleDrop, placeAll, returnToTray };
}
