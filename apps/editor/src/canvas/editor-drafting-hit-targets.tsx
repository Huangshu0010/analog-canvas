import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import { resolveDraftingObjectGeometry } from "@icm/derived";
import type { DraftingObject, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { draftingDragOrigin } from "../features/drafting/drafting-manipulation";
import { draftingPathData } from "../features/drafting/drafting-path";
import type { EditorTool } from "../interaction/interaction-state";
import { serializePolylinePoints } from "./canvas-geometry";

export function EditorDraftingHitTargets({
  document,
  resolver,
  tool,
  selectedDraftingId,
  supplementalDraftingIds,
  onPointerDown,
  onConstructionLineEdit,
  onArrowEdit,
  onTextEdit,
}: {
  document: SchematicDocument;
  resolver: SymbolResolver;
  tool: EditorTool;
  selectedDraftingId: string | null;
  supplementalDraftingIds: readonly string[];
  onPointerDown: (
    event: ReactPointerEvent<SVGElement>,
    object: DraftingObject,
    draggable: boolean,
  ) => void;
  onConstructionLineEdit: (
    event: ReactMouseEvent<SVGElement>,
    object: Extract<DraftingObject, { kind: "construction-line" }>,
  ) => void;
  onArrowEdit: (
    event: ReactMouseEvent<SVGElement>,
    object: Extract<DraftingObject, { kind: "arrow" }>,
  ) => void;
  onTextEdit: (object: Extract<DraftingObject, { kind: "text" }>) => void;
}) {
  return (document.drafting?.objects ?? []).map((object) => {
    const geometry = resolveDraftingObjectGeometry(document, resolver, object);
    const draggable = !object.locked && Boolean(draftingDragOrigin(object));
    const selected =
      selectedDraftingId === object.id ||
      supplementalDraftingIds.includes(object.id);
    const selectedClass = selected
      ? "annotation-hit selected"
      : "annotation-hit";
    const textClass = selected
      ? "hit-target annotation-text-hit selected"
      : "hit-target annotation-text-hit";
    const common = {
      "data-testid": `drafting-hit-${object.id}`,
      "data-canvas-hit-kind": "drafting",
      "data-canvas-hit-id": object.id,
      "data-drag-object-id": object.id,
      onPointerDown: (event: ReactPointerEvent<SVGElement>) =>
        onPointerDown(event, object, draggable),
      pointerEvents: tool === "wire" ? ("none" as const) : undefined,
    };
    if (
      object.kind === "construction-line" &&
      geometry.kind === "construction-line"
    ) {
      const doubleClick = (event: ReactMouseEvent<SVGElement>) =>
        onConstructionLineEdit(event, object);
      return geometry.curveControls.some(Boolean) ? (
        <path
          key={object.id}
          {...common}
          className={selectedClass}
          fill="none"
          d={draftingPathData(geometry.points, geometry.curveControls)}
          onDoubleClick={doubleClick}
        />
      ) : (
        <polyline
          key={object.id}
          {...common}
          className={selectedClass}
          fill="none"
          points={object.points
            .map((point) => `${point.x},${point.y}`)
            .join(" ")}
          onDoubleClick={doubleClick}
        />
      );
    }
    if (object.kind === "arrow" && geometry.kind === "arrow") {
      const doubleClick = (event: ReactMouseEvent<SVGElement>) =>
        onArrowEdit(event, object);
      return geometry.curveControls.some(Boolean) ? (
        <path
          key={object.id}
          {...common}
          className={selectedClass}
          fill="none"
          d={draftingPathData(geometry.points, geometry.curveControls)}
          onDoubleClick={doubleClick}
        />
      ) : (
        <polyline
          key={object.id}
          {...common}
          className={selectedClass}
          fill="none"
          points={geometry.points
            .map((point) => `${point.x},${point.y}`)
            .join(" ")}
          onDoubleClick={doubleClick}
        />
      );
    }
    if (object.kind === "rectangle" && geometry.kind === "rectangle") {
      return (
        <polygon
          key={object.id}
          {...common}
          className={`${selectedClass} drafting-rectangle-hit`}
          points={serializePolylinePoints(geometry.corners)}
          fill="none"
        />
      );
    }
    if (object.kind === "leader" && geometry.kind === "leader") {
      return (
        <line
          key={object.id}
          {...common}
          className={selectedClass}
          x1={geometry.anchor.x}
          y1={geometry.anchor.y}
          x2={geometry.target.x}
          y2={geometry.target.y}
        />
      );
    }
    if (object.kind === "callout" && geometry.kind === "callout") {
      return (
        <g key={object.id} {...common}>
          <line
            className={selectedClass}
            x1={geometry.textPosition.x}
            y1={geometry.textPosition.y}
            x2={geometry.target.x}
            y2={geometry.target.y}
          />
          <rect className={selectedClass} {...geometry.textBounds} />
        </g>
      );
    }
    return (
      <rect
        key={object.id}
        {...common}
        className={object.kind === "text" ? textClass : selectedClass}
        {...geometry.bounds}
        onDoubleClick={(event) => {
          if (object.kind !== "text") return;
          event.stopPropagation();
          onTextEdit(object);
        }}
      />
    );
  });
}
