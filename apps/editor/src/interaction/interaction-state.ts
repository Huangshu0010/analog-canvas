import { useReducer } from "react";
import type { SetStateAction } from "react";

import type { Point } from "@icm/model";

import type { WireSource } from "../features/wiring/wire-editing";

export type { WireSource } from "../features/wiring/wire-editing";

export type EditorTool =
  "pointer" | "wire" | "guide" | "construction-line" | "arrow" | "rectangle";

export type DrawingTool = Extract<
  EditorTool,
  "construction-line" | "arrow" | "rectangle"
>;

export interface PendingComponentPlacement {
  symbolId: string;
  properties: Record<string, string>;
  initialRotation: 0 | 90 | 180 | 270;
  showReference: boolean;
  referenceText: string | null;
}

export type InteractionState =
  | { kind: "idle" }
  | {
      kind: "placing-component";
      placement: PendingComponentPlacement;
    }
  | {
      kind: "wire";
      source: WireSource | null;
      previewPoint: Point | null;
      waypoints: Point[];
    }
  | { kind: "guide" }
  | {
      kind: "drawing";
      tool: DrawingTool;
      source: Point | null;
      hover: Point | null;
      waypoints: Point[];
      snapPoint: Point | null;
    };

export type InteractionAction =
  | { type: "activate-tool"; tool: EditorTool }
  | { type: "place-component"; placement: PendingComponentPlacement }
  | { type: "set-wire-source"; source: WireSource | null }
  | { type: "set-wire-preview"; point: Point | null }
  | { type: "set-wire-waypoints"; update: SetStateAction<Point[]> }
  | { type: "complete-wire" }
  | { type: "set-drawing-source"; point: Point | null }
  | { type: "set-drawing-hover"; point: Point | null }
  | { type: "set-drawing-waypoints"; update: SetStateAction<Point[]> }
  | { type: "set-drawing-snap"; point: Point | null }
  | { type: "clear-drawing" }
  | { type: "cancel" };

export const IDLE_INTERACTION_STATE: InteractionState = { kind: "idle" };

function drawingState(tool: DrawingTool): InteractionState {
  return {
    kind: "drawing",
    tool,
    source: null,
    hover: null,
    waypoints: [],
    snapPoint: null,
  };
}

export function activateInteractionTool(tool: EditorTool): InteractionState {
  switch (tool) {
    case "pointer":
      return IDLE_INTERACTION_STATE;
    case "wire":
      return {
        kind: "wire",
        source: null,
        previewPoint: null,
        waypoints: [],
      };
    case "guide":
      return { kind: "guide" };
    case "arrow":
    case "construction-line":
    case "rectangle":
      return drawingState(tool);
  }
}

function applyUpdate<T>(value: T, update: SetStateAction<T>): T {
  return typeof update === "function"
    ? (update as (current: T) => T)(value)
    : update;
}

export function interactionReducer(
  state: InteractionState,
  action: InteractionAction,
): InteractionState {
  switch (action.type) {
    case "activate-tool":
      return activateInteractionTool(action.tool);
    case "place-component":
      return {
        kind: "placing-component",
        placement: action.placement,
      };
    case "set-wire-source":
      return state.kind === "wire"
        ? { ...state, source: action.source }
        : state;
    case "set-wire-preview":
      return state.kind === "wire"
        ? { ...state, previewPoint: action.point }
        : state;
    case "set-wire-waypoints":
      return state.kind === "wire"
        ? { ...state, waypoints: applyUpdate(state.waypoints, action.update) }
        : state;
    case "complete-wire":
      return state.kind === "wire"
        ? {
            kind: "wire",
            source: null,
            previewPoint: null,
            waypoints: [],
          }
        : state;
    case "set-drawing-source":
      return state.kind === "drawing"
        ? { ...state, source: action.point }
        : state;
    case "set-drawing-hover":
      return state.kind === "drawing"
        ? { ...state, hover: action.point }
        : state;
    case "set-drawing-waypoints":
      return state.kind === "drawing"
        ? { ...state, waypoints: applyUpdate(state.waypoints, action.update) }
        : state;
    case "set-drawing-snap":
      return state.kind === "drawing"
        ? { ...state, snapPoint: action.point }
        : state;
    case "clear-drawing":
      return state.kind === "drawing" ? drawingState(state.tool) : state;
    case "cancel":
      return IDLE_INTERACTION_STATE;
  }
}

export function interactionTool(state: InteractionState): EditorTool {
  switch (state.kind) {
    case "idle":
    case "placing-component":
      return "pointer";
    case "wire":
      return "wire";
    case "guide":
      return "guide";
    case "drawing":
      return state.tool;
  }
}

export function useInteractionState() {
  const [state, dispatch] = useReducer(
    interactionReducer,
    IDLE_INTERACTION_STATE,
  );
  return {
    state,
    tool: interactionTool(state),
    pendingSymbolId:
      state.kind === "placing-component" ? state.placement.symbolId : null,
    pendingComponentPlacement:
      state.kind === "placing-component" ? state.placement : null,
    wireSource: state.kind === "wire" ? state.source : null,
    wirePreviewPoint: state.kind === "wire" ? state.previewPoint : null,
    wireWaypoints: state.kind === "wire" ? state.waypoints : [],
    draftingSource: state.kind === "drawing" ? state.source : null,
    draftingHover: state.kind === "drawing" ? state.hover : null,
    draftingWaypoints: state.kind === "drawing" ? state.waypoints : [],
    draftingSnapPoint: state.kind === "drawing" ? state.snapPoint : null,
    setTool: (tool: EditorTool) => dispatch({ type: "activate-tool", tool }),
    beginComponentPlacement: (placement: PendingComponentPlacement) =>
      dispatch({ type: "place-component", placement }),
    setWireSource: (source: WireSource | null) =>
      dispatch({ type: "set-wire-source", source }),
    setWirePreviewPoint: (point: Point | null) =>
      dispatch({ type: "set-wire-preview", point }),
    setWireWaypoints: (update: SetStateAction<Point[]>) =>
      dispatch({ type: "set-wire-waypoints", update }),
    completeWire: () => dispatch({ type: "complete-wire" }),
    setDraftingSource: (point: Point | null) =>
      dispatch({ type: "set-drawing-source", point }),
    setDraftingHover: (point: Point | null) =>
      dispatch({ type: "set-drawing-hover", point }),
    setDraftingWaypoints: (update: SetStateAction<Point[]>) =>
      dispatch({ type: "set-drawing-waypoints", update }),
    setDraftingSnapPoint: (point: Point | null) =>
      dispatch({ type: "set-drawing-snap", point }),
    clearDraftingCreate: () => dispatch({ type: "clear-drawing" }),
    cancelInteraction: () => dispatch({ type: "cancel" }),
  };
}
