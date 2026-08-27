import type { PointerEvent as ReactPointerEvent } from "react";

import { transformPoint, type Point, type SchematicDocument } from "@icm/model";
import type { SymbolPin } from "@icm/symbols";

type Placement = NonNullable<
  SchematicDocument["instances"][number]["placement"]
>;

export function EditorCellSymbolLayoutOverlay({
  placement,
  body,
  pins,
  onDragStart,
}: {
  placement: Placement;
  body: { left: number; right: number; top: number; bottom: number };
  pins: readonly { terminalId: string; pin: SymbolPin }[];
  onDragStart: (
    event: ReactPointerEvent<SVGCircleElement>,
    kind: "body" | "pin",
    terminalId?: string,
  ) => void;
}) {
  const world = (point: Point) =>
    transformPoint(point, placement.position, placement);
  const bodyCorner = world({ x: body.right, y: body.bottom });
  return (
    <g
      className="cell-symbol-layout-overlay"
      data-testid="cell-symbol-layout-overlay"
    >
      <circle
        data-testid="cell-symbol-body-handle"
        className="cell-symbol-layout-handle body"
        cx={bodyCorner.x}
        cy={bodyCorner.y}
        r="5"
        onPointerDown={(event) => onDragStart(event, "body")}
      />
      {pins.map(({ terminalId, pin }) => {
        const bodyPoint =
          pin.direction === "west"
            ? { x: body.left, y: pin.at.y }
            : pin.direction === "east"
              ? { x: body.right, y: pin.at.y }
              : pin.direction === "north"
                ? { x: pin.at.x, y: body.top }
                : { x: pin.at.x, y: body.bottom };
        const pinPoint = world(bodyPoint);
        return (
          <circle
            key={terminalId}
            data-testid={`cell-symbol-pin-handle-${terminalId}`}
            className="cell-symbol-layout-handle pin"
            cx={pinPoint.x}
            cy={pinPoint.y}
            r="4.5"
            onPointerDown={(event) => onDragStart(event, "pin", terminalId)}
          />
        );
      })}
    </g>
  );
}
