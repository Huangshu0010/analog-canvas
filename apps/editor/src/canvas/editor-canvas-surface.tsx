import type { ComponentProps, SVGProps } from "react";

import {
  CanvasGridOverlay,
  CanvasInputPlanes,
  NetHighlightOverlay,
} from "./editor-canvas-overlays";
import { EditorCellSymbolLayoutOverlay } from "./editor-cell-symbol-layout-overlay";
import { EditorEndpointHitTargets } from "./editor-endpoint-hit-targets";
import { EditorRouteHandles } from "./editor-route-handles";
import { EditorSelectionHitTargets } from "./editor-selection-hit-targets";
import {
  EditorDraftingHandles,
  EditorDraftingHitTargets,
} from "./editor-drafting-hit-targets";
import {
  EditorInteractionPreviews,
  EditorPlacementPreview,
} from "./editor-transient-preview-overlays";
import { EditorWiringOverlay } from "./editor-wiring-overlay";

interface SelectionHitLayer {
  selection: ComponentProps<typeof EditorSelectionHitTargets>;
  endpoints: ComponentProps<typeof EditorEndpointHitTargets>;
}

export interface EditorCanvasSurfaceProps {
  empty: boolean;
  className: string;
  viewBox: string;
  eventHandlers: SVGProps<SVGSVGElement>;
  grid: ComponentProps<typeof CanvasGridOverlay>;
  sceneInnerHtml: { __html: string };
  cellSymbolLayout: ComponentProps<typeof EditorCellSymbolLayoutOverlay> | null;
  netHighlight: ComponentProps<typeof NetHighlightOverlay>;
  copyPreviewInnerHtml: { __html: string } | null;
  inputPlanes: ComponentProps<typeof CanvasInputPlanes>;
  placementPreview: ComponentProps<typeof EditorPlacementPreview>;
  wiring: ComponentProps<typeof EditorWiringOverlay>;
  routeHandles: ComponentProps<typeof EditorRouteHandles>;
  selectionHitLayer: SelectionHitLayer;
  draftingHitTargets: ComponentProps<typeof EditorDraftingHitTargets>;
  draftingHandles: ComponentProps<typeof EditorDraftingHandles>;
  interactionPreviews: ComponentProps<typeof EditorInteractionPreviews>;
}

/** SVG scene composition; interaction semantics arrive through typed models. */
export function EditorCanvasSurface({
  empty,
  className,
  viewBox,
  eventHandlers,
  grid,
  sceneInnerHtml,
  cellSymbolLayout,
  netHighlight,
  copyPreviewInnerHtml,
  inputPlanes,
  placementPreview,
  wiring,
  routeHandles,
  selectionHitLayer,
  draftingHitTargets,
  draftingHandles,
  interactionPreviews,
}: EditorCanvasSurfaceProps) {
  return (
    <section className="canvas-panel">
      {empty ? (
        <div className="canvas-empty-state" data-testid="canvas-empty-state">
          <strong>Start a schematic</strong>
          <span>
            Press <kbd>I</kbd> to insert a component or <kbd>W</kbd> to wire.
          </span>
        </div>
      ) : null}
      <svg
        className={className}
        data-testid="schematic-canvas"
        role="img"
        aria-label="Schematic canvas"
        viewBox={viewBox}
        {...eventHandlers}
      >
        <CanvasGridOverlay {...grid} />
        <g dangerouslySetInnerHTML={sceneInnerHtml} />
        {cellSymbolLayout ? (
          <EditorCellSymbolLayoutOverlay {...cellSymbolLayout} />
        ) : null}
        <NetHighlightOverlay {...netHighlight} />
        {copyPreviewInnerHtml ? (
          <g
            data-testid="copy-placement-preview"
            className="copy-placement-preview"
            dangerouslySetInnerHTML={copyPreviewInnerHtml}
          />
        ) : null}
        <CanvasInputPlanes {...inputPlanes} />
        <g data-layer="editor-overlay">
          <EditorPlacementPreview {...placementPreview} />
          <EditorWiringOverlay {...wiring} />
          <EditorRouteHandles {...routeHandles} />
          <EditorSelectionHitTargets {...selectionHitLayer.selection}>
            <EditorEndpointHitTargets {...selectionHitLayer.endpoints} />
          </EditorSelectionHitTargets>
          <EditorDraftingHitTargets {...draftingHitTargets} />
          <EditorDraftingHandles {...draftingHandles} />
          <EditorInteractionPreviews {...interactionPreviews} />
        </g>
      </svg>
    </section>
  );
}
