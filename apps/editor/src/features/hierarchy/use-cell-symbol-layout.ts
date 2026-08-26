import { useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
  inverseTransformPoint,
  type CellSymbolSide,
  type Point,
  type SchematicDocument,
} from "@icm/model";
import type { SymbolPin, SymbolResolver } from "@icm/symbols";

import { snapCoordinate } from "../../snap/engine";

type Instance = SchematicDocument["instances"][number];

export interface CellSymbolLayoutSession {
  child: SchematicDocument;
  instance: Instance;
  body: { left: number; right: number; top: number; bottom: number };
  pins: readonly {
    terminal: NonNullable<SchematicDocument["netlist"]>["terminals"][number];
    pin: SymbolPin;
  }[];
}

type CellSymbolLayoutDrag = {
  kind: "body" | "pin";
  pointerId: number;
  terminalId?: string;
};

export type CellSymbolLayoutEdit =
  | { kind: "body"; width: number; height: number }
  | {
      kind: "pin";
      terminalId: string;
      side: CellSymbolSide;
      offset: number;
    }
  | null;

export function cellSymbolLayoutEditAtLocalPoint(
  layout: Pick<CellSymbolLayoutSession, "body">,
  drag: Pick<CellSymbolLayoutDrag, "kind" | "terminalId">,
  local: Point,
): CellSymbolLayoutEdit {
  if (drag.kind === "body") {
    return {
      kind: "body",
      width: Math.max(10, snapCoordinate(Math.abs(local.x) * 2, 10)),
      height: Math.max(10, snapCoordinate(Math.abs(local.y) * 2, 10)),
    };
  }
  if (!drag.terminalId) return null;
  const distances = [
    ["west", Math.abs(local.x - layout.body.left)],
    ["east", Math.abs(local.x - layout.body.right)],
    ["north", Math.abs(local.y - layout.body.top)],
    ["south", Math.abs(local.y - layout.body.bottom)],
  ] as const;
  const side = distances.reduce((closest, candidate) =>
    candidate[1] < closest[1] ? candidate : closest,
  )[0];
  return {
    kind: "pin",
    terminalId: drag.terminalId,
    side,
    offset: snapCoordinate(
      side === "west" || side === "east" ? local.y : local.x,
      10,
    ),
  };
}

export function useCellSymbolLayout({
  selectedInstance,
  child,
  resolver,
  selectionOpen,
  canvasPointFromEvent,
  setBodySize,
  setPortPlacement,
}: {
  selectedInstance: Instance | undefined;
  child: SchematicDocument | undefined;
  resolver: SymbolResolver;
  selectionOpen: boolean;
  canvasPointFromEvent: (event: ReactPointerEvent<SVGSVGElement>) => Point;
  setBodySize: (
    child: SchematicDocument,
    width: number,
    height: number,
  ) => void;
  setPortPlacement: (
    child: SchematicDocument,
    terminalId: string,
    side: CellSymbolSide,
    offset: number,
  ) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [targetInstanceId, setTargetInstanceId] = useState<string | null>(null);
  const [drag, setDrag] = useState<CellSymbolLayoutDrag | null>(null);
  const layout = useMemo<CellSymbolLayoutSession | null>(() => {
    if (!enabled || !selectedInstance?.placement || !child?.netlist)
      return null;
    const definition = resolver.resolve(selectedInstance.symbolId)?.definition;
    const body = definition?.primitives.find(
      (primitive) => primitive.kind === "polygon",
    );
    if (!definition || !body || body.kind !== "polygon") return null;
    const xs = body.points.map((point) => point.x);
    const ys = body.points.map((point) => point.y);
    return {
      child,
      instance: selectedInstance,
      body: {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
      },
      pins: child.netlist.terminals.flatMap((terminal) => {
        const pin = definition.pins.find(
          (candidate) => candidate.name === terminal.name,
        );
        return pin ? [{ terminal, pin }] : [];
      }),
    };
  }, [child, enabled, resolver, selectedInstance]);

  const exit = (): void => {
    setDrag(null);
    setEnabled(false);
    setTargetInstanceId(null);
  };

  useEffect(() => {
    if (!enabled) return;
    if (selectedInstance?.id !== targetInstanceId || !child?.netlist) exit();
  }, [child?.netlist, enabled, selectedInstance?.id, targetInstanceId]);

  useEffect(() => {
    if (!selectionOpen && enabled) exit();
  }, [enabled, selectionOpen]);

  const toggle = (): void => {
    if (enabled) {
      exit();
      return;
    }
    if (!child?.netlist || !selectedInstance?.placement) return;
    setTargetInstanceId(selectedInstance.id);
    setEnabled(true);
  };

  const beginDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    kind: "body" | "pin",
    terminalId?: string,
  ): void => {
    if (!layout) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      kind,
      pointerId: event.pointerId,
      ...(terminalId ? { terminalId } : {}),
    });
  };

  const completeDrag = (event: ReactPointerEvent<SVGSVGElement>): boolean => {
    if (!drag || drag.pointerId !== event.pointerId || !layout) return false;
    const point = canvasPointFromEvent(event);
    const placement = layout.instance.placement!;
    const local = inverseTransformPoint(point, placement.position, placement);
    const edit = cellSymbolLayoutEditAtLocalPoint(layout, drag, local);
    setDrag(null);
    if (edit?.kind === "body") {
      setBodySize(layout.child, edit.width, edit.height);
    } else if (edit?.kind === "pin") {
      setPortPlacement(layout.child, edit.terminalId, edit.side, edit.offset);
    }
    return true;
  };

  return {
    enabled,
    layout,
    activeDragPointerId: drag?.pointerId ?? null,
    cancelDrag: () => setDrag(null),
    exit,
    toggle,
    beginDrag,
    completeDrag,
  };
}
