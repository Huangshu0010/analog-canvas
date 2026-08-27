import {
  proposeGroupReflectionEdits,
  proposeGroupRotationEdits,
  type SchematicEdit,
} from "@icm/edit-engine";
import { resolveDraftingObjectGeometry } from "@icm/derived";
import type { SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { rotateDraftingObject } from "../drafting/drafting-manipulation";
import {
  reflectOrientation,
  type ScreenFlip,
} from "../../interaction/shortcut-orientation";
import type { VisualSelection } from "./visual-selection";

type TransactionResult = { ok: boolean };

export function createSelectionTransformController({
  document,
  resolver,
  selectedInstanceIds,
  selection,
  transact,
  setStatus,
}: {
  document: SchematicDocument;
  resolver: SymbolResolver;
  selectedInstanceIds: readonly string[];
  selection: VisualSelection;
  transact: (edits: SchematicEdit[]) => TransactionResult;
  setStatus: (status: string) => void;
}) {
  const placedInstanceIds = (): string[] =>
    selectedInstanceIds.filter((id) =>
      document.instances.some(
        (candidate) => candidate.id === id && candidate.placement,
      ),
    );

  const rotate = (deltaDegrees: 90 | -90 = 90): void => {
    const placedSelection = placedInstanceIds();
    const groupRotation =
      placedSelection.length > 1
        ? proposeGroupRotationEdits(
            document,
            resolver,
            placedSelection,
            deltaDegrees,
          )
        : null;
    const instanceEdits = groupRotation
      ? groupRotation.edits
      : selectedInstanceIds.flatMap((id): SchematicEdit[] => {
          const instance = document.instances.find(
            (candidate) => candidate.id === id,
          );
          if (!instance?.placement) return [];
          const next =
            (((instance.placement.rotation + deltaDegrees) % 360) + 360) % 360;
          return [
            {
              kind: "rotate_instance",
              instanceId: instance.id,
              rotation: next as 0 | 90 | 180 | 270,
            },
          ];
        });
    const draftingEdits = selection.draftingIds.flatMap(
      (id): SchematicEdit[] => {
        const object = document.drafting?.objects.find(
          (candidate) => candidate.id === id,
        );
        if (!object) return [];
        const next = rotateDraftingObject(
          object,
          resolveDraftingObjectGeometry(document, resolver, object),
          deltaDegrees,
          document.presentation.grid,
        );
        return next ? [{ kind: "upsert_drafting_object", object: next }] : [];
      },
    );
    const edits = [...instanceEdits, ...draftingEdits];
    if (edits.length === 0 || !transact(edits).ok) return;
    setStatus(
      groupRotation
        ? `Turned ${placedSelection.length} parts as one group`
        : "Turned the selection in place",
    );
  };

  const mirror = (direction: ScreenFlip = "left-right"): void => {
    const placedSelection = placedInstanceIds();
    if (placedSelection.length > 1) {
      const plan = proposeGroupReflectionEdits(
        document,
        resolver,
        placedSelection,
        direction,
      );
      if (plan.edits.length > 0 && transact(plan.edits).ok)
        setStatus(
          `Flipped ${placedSelection.length} parts as one group, ${direction === "left-right" ? "left to right" : "top to bottom"}`,
        );
      return;
    }
    const edits = selectedInstanceIds.flatMap((id): SchematicEdit[] => {
      const instance = document.instances.find(
        (candidate) => candidate.id === id,
      );
      if (!instance?.placement) return [];
      const orientation = reflectOrientation(instance.placement, direction);
      return [
        {
          kind: "mirror_instance",
          instanceId: instance.id,
          mirror: orientation.mirror,
        },
        ...(orientation.rotation === instance.placement.rotation
          ? []
          : [
              {
                kind: "rotate_instance" as const,
                instanceId: instance.id,
                rotation: orientation.rotation,
              },
            ]),
      ];
    });
    if (edits.length > 0 && transact(edits).ok)
      setStatus(
        `Flipped the selection ${direction === "left-right" ? "left to right" : "top to bottom"}`,
      );
  };

  const align = (): void => {
    if (selectedInstanceIds.length < 2) {
      setStatus("Select at least two instances to align");
      return;
    }
    if (
      transact([
        {
          kind: "align_instances",
          instanceIds: [...selectedInstanceIds],
          axis: "y",
        },
      ]).ok
    )
      setStatus(`Aligned ${selectedInstanceIds.length} selected instances`);
  };

  return { rotate, mirror, align };
}
