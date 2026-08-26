import type { MouseEvent as ReactMouseEvent, Ref } from "react";

import type { Flightline } from "@icm/derived";
import type { Point } from "@icm/model";

import { serializePolylinePoints } from "./canvas-geometry";

type RouteGeometryRecord = {
  route: { id: string };
  geometry: { centerline: readonly Point[] };
};

export function EditorWiringOverlay({
  netLabelEditorOpen,
  selectedRouteId,
  selectedRouteSegmentIndex,
  routeGeometryRecords,
  netLabelDraft,
  netLabelEditorInputRef,
  onNetLabelDraftChange,
  onNetLabelSubmit,
  onNetLabelEscape,
  flightlines,
  onFlightlineClick,
  wireDraftPoints,
  bulkRoutePreview,
  snapGuideLayerRef,
}: {
  netLabelEditorOpen: boolean;
  selectedRouteId: string | null;
  selectedRouteSegmentIndex: number | null;
  routeGeometryRecords: readonly RouteGeometryRecord[];
  netLabelDraft: string;
  netLabelEditorInputRef: Ref<HTMLInputElement>;
  onNetLabelDraftChange: (value: string) => void;
  onNetLabelSubmit: () => void;
  onNetLabelEscape: () => void;
  flightlines: readonly Flightline[];
  onFlightlineClick: (
    event: ReactMouseEvent<SVGLineElement>,
    flightline: Flightline,
  ) => void;
  wireDraftPoints: readonly Point[];
  bulkRoutePreview: boolean;
  snapGuideLayerRef: Ref<SVGGElement>;
}) {
  const selectedGeometry = netLabelEditorOpen
    ? routeGeometryRecords.find(({ route }) => route.id === selectedRouteId)
        ?.geometry
    : undefined;
  const segmentIndex = selectedGeometry
    ? Math.min(
        selectedRouteSegmentIndex ?? 0,
        selectedGeometry.centerline.length - 2,
      )
    : null;
  const from =
    segmentIndex === null
      ? undefined
      : selectedGeometry?.centerline[segmentIndex];
  const to =
    segmentIndex === null
      ? undefined
      : selectedGeometry?.centerline[segmentIndex + 1];

  return (
    <>
      {from && to ? (
        <foreignObject
          data-testid="net-label-editor"
          x={Math.round((from.x + to.x) / 2 - 58)}
          y={Math.round((from.y + to.y) / 2 - 34)}
          width="116"
          height="32"
        >
          <form
            className="net-label-editor"
            onPointerDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              onNetLabelSubmit();
            }}
          >
            <input
              ref={netLabelEditorInputRef}
              aria-label="Net Label"
              value={netLabelDraft}
              onChange={(event) =>
                onNetLabelDraftChange(event.currentTarget.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onNetLabelEscape();
                }
              }}
            />
          </form>
        </foreignObject>
      ) : null}
      {flightlines.map((flightline) => (
        <g key={flightline.id}>
          <line
            data-testid="flightline-hit"
            className="flightline-hit"
            data-net-id={flightline.netId}
            x1={flightline.fromPoint.x}
            y1={flightline.fromPoint.y}
            x2={flightline.toPoint.x}
            y2={flightline.toPoint.y}
            onClick={(event) => onFlightlineClick(event, flightline)}
          />
          <line
            data-testid="flightline"
            className="flightline"
            data-net-id={flightline.netId}
            x1={flightline.fromPoint.x}
            y1={flightline.fromPoint.y}
            x2={flightline.toPoint.x}
            y2={flightline.toPoint.y}
          />
        </g>
      ))}
      {wireDraftPoints.length >= 2 ? (
        <polyline
          data-testid="wire-preview"
          className={
            bulkRoutePreview
              ? "wire-preview bulk-route-preview"
              : "wire-preview"
          }
          points={serializePolylinePoints(wireDraftPoints)}
        />
      ) : null}
      <g ref={snapGuideLayerRef} data-layer="snap-guides" />
    </>
  );
}
