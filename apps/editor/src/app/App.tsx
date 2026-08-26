import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  DragEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import "../editor.css";
import type {
  AgentHostSemanticIntentRequest,
  AgentHostSemanticIntentResult,
} from "@icm/agent-adapter";
import {
  compileWireDraft,
  createFreeWireAnchor,
  createRouteWireAnchor,
  proposeEndpointRouteAttachment,
  proposeLooseRouteTranslation,
  proposePowerRailEndpointResize,
  proposePowerRailTranslation,
  proposeWireCommitThroughContacts,
  proposeWireSegmentMove,
  planDeleteCell,
  planRemoveCellTerminalMarkers,
  planEditCellTerminalAnnotation,
  planSetMosModelTarget,
  planCellReset,
  planInstanceUnplacement,
  type SchematicEdit,
  type CellResetPlan,
  type WireSource,
  type WireRoutingMode,
  type WireCornerOrder,
} from "@icm/edit-engine";
import { analyzeDesignNetlist } from "@icm/netlist";
import type { NetlistDiagnostic, NetlistFormat } from "@icm/netlist";
import {
  buildProjectConnectivityIndex,
  buildProjectSearchIndex,
  deriveCrossings,
  deriveNetConnectivity,
  deriveInternalGroupSelection,
  diagnoseProjectSnapshot,
  diagnoseVisualQuality,
  endpointKey,
  findHierarchyPath,
  findHierarchyPaths,
  isMosBulkTerminal,
  isVisibleEndpoint,
  resolveEndpointConnection,
  resolveDraftingObjectGeometry,
  resolveElectricalContactTargets,
  displayableInstanceValue,
  resolveMosBulkConnection,
  resolveDocumentStyleProfile,
  resolveDocumentLogicalNets,
  resolveRouteAttachment,
  resolveRouteTap,
  resolveDocumentRoutingGeometry,
  summarizeProjectCells,
  traceHierarchyNet,
} from "@icm/derived";
import type {
  Diagnostic,
  Flightline,
  GlobalNetTraceHop,
  HierarchyFrame,
  HierarchyNetTraceHop,
  ObjectLocator,
  SearchResult,
} from "@icm/derived";
import {
  createEmptyProject,
  createId,
  defaultDraftTextDocument,
  foldNetName,
  flattenRichText,
  snapGridPoint,
  semanticTextDocument,
} from "@icm/model";
import type {
  Annotation,
  CircuitProject,
  DerivedPoint,
  DraftingObject,
  GridRect,
  Point,
  Rect,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import { buildSvgScene } from "@icm/render-svg";
import { importSpiceSources } from "@icm/spice";
import { renderCrashRequested, sceneCrashRequested } from "./crash-test-hooks";
import { buildSceneSafely } from "./scene-safety";
import {
  builtInSymbols,
  externalSubcircuitSymbolId,
  findUnsupportedProjectSymbolIds,
  hierarchicalSymbolId,
  resolvePdkSymbolMapping,
  resolvePdkSymbolMappingForTerminalOrder,
  reviewedSky130MosModelSuggestions,
} from "@icm/symbols";
import {
  clipboardPreviewDocument,
  copySelection,
} from "../features/clipboard/clipboard";
import type { SchematicClipboard } from "../features/clipboard/clipboard";
import { startCanvasDragSession } from "../canvas/canvas-drag-session";
import {
  fitCameraToBounds,
  normalizeCameraRect,
  zoomCameraAtAnchor,
  type CameraRectInput,
} from "../canvas/fit-view";
import type { CanvasDragSession } from "../canvas/canvas-drag-session";
import { startCanvasDragVisual } from "../canvas/canvas-drag-visual";
import {
  rankCanvasHits,
  resolveCanvasHitAtPoint,
} from "../canvas/canvas-hit-resolver";
import {
  type RouteStretchPreview,
  useWireInteraction,
} from "../features/wiring/use-wire-interaction";
import {
  closestPointOnSegment,
  normalizedRect,
} from "../canvas/canvas-geometry";
import {
  classifyCanvasGestureStart,
  type BoxPreview,
  type PanPreview,
  updateCanvasPan,
} from "../canvas/canvas-gesture-model";
import {
  canvasPointFromClient,
  logicalRadiusForCanvasPixels,
  replaceCanvasSnapGuides,
} from "../canvas/canvas-viewport";
import {
  CanvasGridOverlay,
  CanvasInputPlanes,
  NetHighlightOverlay,
} from "../canvas/editor-canvas-overlays";
import { EditorSelectionHitTargets } from "../canvas/editor-selection-hit-targets";
import { EditorEndpointHitTargets } from "../canvas/editor-endpoint-hit-targets";
import { EditorRouteHandles } from "../canvas/editor-route-handles";
import { EditorCellSymbolLayoutOverlay } from "../canvas/editor-cell-symbol-layout-overlay";
import { EditorWiringOverlay } from "../canvas/editor-wiring-overlay";
import {
  EditorDraftingHandles,
  EditorDraftingHitTargets,
} from "../canvas/editor-drafting-hit-targets";
import { draggedAnnotationAtPosition } from "../features/text-editing/annotation-drag-model";
import {
  createRasterExportArtifact,
  createSvgExportArtifact,
  planDesignNetlistExport,
  requestBrowserDownload,
} from "../features/editor-shell/editor-export-commands";
import { EditorStatusbar } from "../features/editor-shell/editor-statusbar";
import { EditorTestTelemetry } from "../features/editor-shell/editor-test-telemetry";
import { useCellSymbolLayout } from "../features/hierarchy/use-cell-symbol-layout";
import {
  AnnotationActionsSection,
  EndpointActionsSection,
  GroupDisplayToggles,
  MosBulkConnectionSection,
  RouteActionsSection,
  RoutingGuidanceSection,
} from "../features/selection/selection-context-actions";
import {
  cellInsertLaunch,
  fullInsertLaunch,
} from "../features/component-insert/insert-launch";
import { useComponentPlacement } from "../features/component-insert/use-component-placement";
import { planPlaceAllUnplacedInstances } from "../features/component-insert/placement-tray";
import { PlacementTrayPanel } from "../features/component-insert/placement-tray-panel";
import {
  CellSymbolLayoutProperties,
  FormalPortProperties,
} from "../features/properties/component-structure-properties";
import {
  ComponentIdentityProperties,
  componentTargetDescription,
} from "../features/properties/component-identity-properties";
import { ComponentElectricalProperties } from "../features/properties/component-electrical-properties";
import { ComponentPlacementProperties } from "../features/properties/component-placement-properties";
import { missingDefaultInstanceDisplayAnnotations } from "../features/instance-display/default-instance-display";
import {
  constrainedPowerRailEndpoint,
  constructVddRailEdits,
} from "../features/component-insert/vdd-rail";
import { vddPowerLabelAnnotation } from "../features/component-insert/vdd-power-label";
import {
  powerConnectionForSymbol,
  proposePlacementContact,
  proposedStandalonePowerConnection,
} from "../features/component-insert/placement-connectivity";
import {
  endpointTestId,
  instanceLabelAnnotationFor,
  maxRoutingCounter,
  previewInstanceValueSource,
} from "./editor-document-helpers";
import {
  compactLayoutMatches,
  dismissOpenCommandMenus,
  isTypingTarget,
  RenderCrashProbe,
} from "./editor-runtime-helpers";
import {
  LazyAgentPropertiesSection,
  LazyCellManagerDialog,
  LazyConnectAgentPanel,
  LazyEditorHelpDialog,
  LazyInsertComponentDialog,
  LazyInstanceTableDialog,
  LazyNetlistPreflightDialog,
  LazyProjectSearchDialog,
  LazyPublishGalleryDialog,
  LazyRecentRecoveryDialog,
  LazyReplaceGuardDialog,
  LazyVersionHistoryDialog,
} from "./lazy-editor-dialogs";
import {
  bindingForEditedModel,
  netlistReferenceMatchesPlacement,
  nextInstanceDesignator,
} from "../features/netlist-export/netlist-authoring";
import { ToolIcon } from "../features/editor-shell/tool-icon";
import { DrawingToolbar } from "../features/editor-shell/drawing-toolbar";
import { FileCommandMenu } from "../features/editor-shell/file-command-menu";
import {
  quickPlaceRequest,
  ShapesPanel,
} from "../features/editor-shell/shapes-panel";
import {
  differentialOutputSibling,
  planDifferentialOutputSwap,
} from "../features/editor-shell/differential-output-swap";
import {
  differentialInputSibling,
  planDifferentialInputSwap,
} from "../features/editor-shell/differential-input-swap";
import { ExamplesPanel } from "../features/editor-shell/examples-panel";
import { createGalleryExampleCommands } from "../features/editor-shell/gallery-example-commands";
import { convertRectangleToHierarchy } from "../features/hierarchy/rectangle-to-cell";
import { HierarchyToolbar } from "../features/hierarchy/hierarchy-toolbar";
import { createProjectStructureCommands } from "../features/hierarchy/project-structure-commands";
import { DocumentSettingsSection } from "../features/editor-shell/document-settings-section";
import type { PublishGalleryDraft } from "../features/editor-shell/publish-gallery-dialog";
import {
  publishProjectToGallery,
  updateGalleryEntry,
} from "../features/editor-shell/gallery-publish";
import { fetchSessionUser, type SessionUser } from "../components/account";
import {
  evaluateSubmissionGates,
  type SubmissionGateReport,
} from "@icm/derived";
import {
  proposeConnectedInstanceDeletion,
  proposeVisualSelectionDeletion,
} from "../features/selection/delete-selection";
import {
  createLibraryExampleProject,
  libraryProjectExamples,
} from "../examples/library-examples";
import { useDocumentController } from "../document/document-controller";
import { useProjectFileLifecycle } from "../document/use-project-file-lifecycle";
import {
  draftingDragOrigin,
  translateDraftingObject,
} from "../features/drafting/drafting-manipulation";
import { createDraftingCommands } from "../features/drafting/drafting-commands";
import { createDraftingCreateController } from "../features/drafting/drafting-create-controller";
import {
  createDraftingDragController,
  type DraftingHandlePreview,
} from "../features/drafting/drafting-drag-controller";
import {
  EditorInteractionPreviews,
  EditorPlacementPreview,
} from "../canvas/editor-transient-preview-overlays";
import { DraftingPropertiesPanel } from "../features/drafting/drafting-properties-panel";
import {
  proposeRectangleLabel,
  rectangleInteriorAt,
  rectangleLabelFor,
} from "../features/drafting/rectangle-label";
import {
  marqueeMode,
  marqueeSelection,
} from "../features/selection/marquee-selection";
import {
  resolveEditorShortcut,
  stepBoundedScale,
} from "../interaction/editor-shortcuts";
import { createEditorCommandRouter } from "../commands/editor-command";
import { createEditorTransactionCommands } from "./editor-transaction-commands";
import {
  RecoveryFailureBanner,
  recoveryStateLabel,
} from "../components/recovery-banners";
import { BrowserAgentHost } from "../agent/browser-agent-host";
import { BrowserAgentFileHost } from "../agent/browser-agent-file-host";
import { PUBLIC_AGENT_UI_ENABLED } from "../agent/public-agent-ui";
import { useAgentSession } from "../agent/use-agent-session";
import type { AgentFileCandidateSummary } from "@icm/agent-adapter";
import { referencedDocumentId } from "../document/editor-session";
import { useInteractionState } from "../interaction/interaction-state";
import type { EditorTool } from "../interaction/interaction-state";
import { resolveTextEditingTarget } from "../features/text-editing/text-editing";
import { planMosBulkDefaultUpdate } from "../features/component-insert/mos-bulk-defaults";
import { planCheckBulkDefaults } from "../features/netlist-export/check-and-save";
import {
  listWorkspaceShelf,
  saveToWorkspaceShelf,
  type WorkspaceSlot,
} from "../features/editor-shell/workspace-shelf";
import {
  defaultRazaviSymbolVariantId,
  materializeRazaviProjectBulkConnections,
  razaviHiddenBulkRisk,
  razaviManualBulkConnectionEdits,
  razaviMosPresentationEdits,
} from "../presentation/razavi-presentation";
import { useRecoveryCoordinator } from "../document/recovery-coordinator";
import { requestProjectDownload } from "../document/project-file-service";
import { useSelectionController } from "../features/selection/selection-controller";
import {
  deriveSelectionInspectionModel,
  type SupplementalSelection,
} from "../features/selection/selection-inspection-model";
import { usePropertiesEditor } from "../features/properties/use-properties-editor";
import { createPropertyEditPlanner } from "../features/properties/property-edit-planner";
import {
  LIBRARY_WIDTH_MAX,
  LIBRARY_WIDTH_MIN,
  useEditorPanels,
} from "../features/editor-shell/use-editor-panels";
import {
  type InstanceMovePreview,
  type ProjectedInstanceMove,
  useSelectionInteraction,
} from "../features/selection/use-selection-interaction";
import {
  NetTraceSection,
  ProjectDiagnosticsSection,
  SelectionInspectorDetails,
  summarizeVisualDiagnostics,
} from "../features/selection/selection-inspector-details";
import type { SpiceImportReport } from "../features/selection/selection-inspector-details";
import {
  hasVisualSelection,
  pruneVisualSelection,
} from "../features/selection/visual-selection";
import { createSelectionMoveController } from "../features/selection/selection-move-controller";
import { createSelectionTransformController } from "../features/selection/selection-transform-controller";
import type { VisualSelection } from "../features/selection/visual-selection";
import {
  planSelectionMove,
  type SchematicMoveIntent,
  type SelectionMovePlan,
} from "../features/selection/selection-move-plan";
import {
  annotationAnchor,
  annotationHitBox,
  attachmentAtPoint,
  defaultInstanceLabel,
  defaultInstanceValue,
  effectiveRouteAttachment,
  endpointNetId,
  instanceValueAnnotation,
  isRoutedMarker,
  looseRouteAnchorIds,
} from "../features/wiring/route-interaction-geometry";
import { resolveWireCanvasSnap as resolveWireCanvasSnapModel } from "../features/wiring/wire-canvas-snap";
import type { ScreenFlip } from "../interaction/shortcut-orientation";
import {
  buildDraftingAnchors,
  buildInstanceAnchors,
  buildSceneSnapTargets,
} from "../snap/candidates";
import {
  resolvePointSnap,
  resolveTranslationSnap,
  SNAP_PROFILES,
  snapCoordinate,
} from "../snap/engine";
import type { SnapAnchor, SnapGuideLine, SnapResult } from "../snap/engine";

const DEFAULT_VIEWBOX: GridRect = { x: 0, y: 0, width: 960, height: 640 };
const RECENT_COMPONENTS_STORAGE_KEY = "icm.recent-components.v1";
const LIBRARY_PANEL_STORAGE_KEY = "icm.library-panel-open.v1";
const LIBRARY_WIDTH_STORAGE_KEY = "icm.library-panel-width.v1";
const COMPACT_LAYOUT_MEDIA_QUERY = "(max-width: 860px)";
const DRAG_START_DISTANCE_PX = 4;
/**
 * Middle-press slop before a pan begins. A scroll wheel is stiff enough that
 * clicking it drags the hand several pixels, and the ordinary 4px threshold
 * turned those clicks into pans — so the corner cycle they were meant to
 * trigger did nothing and the middle button felt unresponsive.
 */
const PAN_START_DISTANCE_PX = 10;
const SNAP_CAPTURE_RADIUS_PX = 7;

/** Persisted Junctions are grid points, including on ±45° Route segments. */

type DragPreview = InstanceMovePreview;

interface AnnotationDragPreview {
  annotationId: string;
  originalPosition: Point;
  pointerStart: DerivedPoint;
}

// Handle drags are geometry edits rather than translations.  Keep a complete
// transient object so the formal SVG renderer can redraw both a curved shaft
// and its arrow head from the same latest control point before pointer-up.
const EMPTY_SUPPLEMENTAL_SELECTION: SupplementalSelection = {
  routeIds: [],
  junctionIds: [],
  annotationIds: [],
  draftingIds: [],
};

export interface AppProps {
  project?: CircuitProject;
  visitStats?: { pv: number; uv: number } | null;
  /** Test/staging seam; production defaults to a human-only editor. */
  publicAgentUiEnabled?: boolean;
  /** `/g/<id>` deep link: load this gallery entry after boot. */
  initialGalleryEntryId?: string | null;
}

export function App({
  project: initialProject,
  visitStats,
  publicAgentUiEnabled = PUBLIC_AGENT_UI_ENABLED,
  initialGalleryEntryId = null,
}: AppProps) {
  const [preparedInitialProject] = useState(
    () =>
      materializeRazaviProjectBulkConnections(
        initialProject ?? createEmptyProject("project-main", "New Circuit"),
      ).project,
  );
  const [status, setStatus] = useState("Ready");
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpCloseRef = useRef<HTMLButtonElement>(null);
  const libraryResizeOriginRef = useRef<{
    pointerX: number;
    width: number;
  } | null>(null);
  const {
    libraryPanelOpen,
    setLibraryPanelOpen,
    libraryWidth,
    setLibraryWidth,
    compactLayout,
    setCompactLayout,
    compactLibraryPanelOpen,
    setCompactLibraryPanelOpen,
    leftPanelMode,
    setLeftPanelMode,
    selectionOpen,
    setSelectionOpen,
    helpOpen,
    setHelpOpen,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    agentPanelOpen,
    setAgentPanelOpen,
    agentDetailsOpen,
    setAgentDetailsOpen,
    agentStatusDismissed,
    setAgentStatusDismissed,
    closeHelp,
    closeSearch,
    showLeftPanel,
    toggleExamplesPanel: toggleExamplesPanelFromShell,
    toggleLibraryPanel,
  } = useEditorPanels({
    initialCompact: compactLayoutMatches(COMPACT_LAYOUT_MEDIA_QUERY),
    compactMediaQuery: COMPACT_LAYOUT_MEDIA_QUERY,
    libraryStorageKey: LIBRARY_PANEL_STORAGE_KEY,
    libraryWidthStorageKey: LIBRARY_WIDTH_STORAGE_KEY,
    helpButtonRef,
    helpCloseRef,
  });
  const visibleLibraryPanelOpen = compactLayout
    ? compactLibraryPanelOpen
    : libraryPanelOpen;
  useEffect(() => {
    if (!visibleLibraryPanelOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/gallery?limit=60", {
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          entries?: {
            id: string;
            name: string;
            author: string;
            description: string;
          }[];
        };
        if (!cancelled && payload.entries && payload.entries.length > 0) {
          setGalleryExamples(payload.entries);
        }
      } catch {
        // Unreachable worker (offline dev): the bundled list stands in.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleLibraryPanelOpen]);

  const [recoveryFailureDismissed, setRecoveryFailureDismissed] =
    useState(false);
  const {
    state: recoveryState,
    sessions: recoverySessions,
    ready: recoveryReady,
    workingCopyId: recoveryWorkingCopyId,
    stage: stageRecovery,
    cancelPending: cancelRecovery,
    flushNow: flushRecovery,
    beginWorkingCopy: beginRecoveryWorkingCopy,
    noteFormalFileHint: noteRecoveryFormalFileHint,
    discover: discoverRecovery,
    readSessionProject: readRecoveryProject,
    deleteSession: deleteRecoverySession,
  } = useRecoveryCoordinator(setStatus);
  const {
    project,
    document,
    resolver,
    canUndo,
    canRedo,
    openDocument,
    replaceProject,
    commitProjectStructure,
    dispatchProjectTransaction,
    transact: transactDocument,
    controller: editorDocumentController,
    projectSessionId,
    synchronizeExternalCommit,
  } = useDocumentController(preparedInitialProject, stageRecovery);
  const agentSemanticIntentRef = useRef<
    (request: AgentHostSemanticIntentRequest) => AgentHostSemanticIntentResult
  >(() => ({
    ok: false,
    code: "SEMANTIC_CONTROL_UNAVAILABLE",
    message: "The editor is still initializing semantic controls",
  }));
  const browserAgentHost = useMemo(
    () =>
      new BrowserAgentHost(
        editorDocumentController,
        synchronizeExternalCommit,
        (request) => agentSemanticIntentRef.current(request),
      ),
    [editorDocumentController, projectSessionId],
  );
  const [documentStack, setDocumentStack] = useState<HierarchyFrame[]>([]);
  const {
    selection: visualSelection,
    replace: replaceSelection,
    replaceKind: replaceSelectionKind,
    selectOnly,
    selectInstance: updateInstanceSelection,
    clearKinds: clearSelectionKinds,
    reset: resetSelection,
  } = useSelectionController();
  const uniqueSuffixCounter = useRef(0);
  const [viewBox, setRawViewBox] = useState<GridRect>(DEFAULT_VIEWBOX);
  const [gridDotsVisible, setGridDotsVisible] = useState(true);
  const setViewBox = (
    next: GridRect | CameraRectInput | ((current: GridRect) => CameraRectInput),
    grid = document.presentation.grid,
  ): void => {
    setRawViewBox((current) =>
      normalizeCameraRect(
        typeof next === "function" ? next(current) : next,
        grid,
      ),
    );
  };
  const [importReport, setImportReport] = useState<SpiceImportReport | null>(
    null,
  );
  const [importReviewOpen, setImportReviewOpen] = useState(false);
  const [cellManagerOpen, setCellManagerOpen] = useState(false);
  const [pendingCellReset, setPendingCellReset] = useState<{
    plan: CellResetPlan;
    command: string;
  } | null>(null);
  const [netlistPreflightOpen, setNetlistPreflightOpen] = useState(false);
  const [documentSettingsOpen, setDocumentSettingsOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState<string | null>(null);
  const [publishGalleryOpen, setPublishGalleryOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [publishSession, setPublishSession] = useState<SessionUser | null>(
    null,
  );
  const [galleryEntryContext, setGalleryEntryContext] = useState<{
    id: string;
    name: string;
    /** The opened Project's id: the context is only valid while that
     * exact Project is still the active one. */
    projectId: string;
    ownerUserId: string | null;
    author: string;
    description: string;
    tags: readonly string[];
  } | null>(null);
  // The moment any OTHER Project replaces the opened gallery entry (new
  // circuit, bundled example, import, …), the update offer must vanish —
  // otherwise a later publish silently overwrites the stale entry.
  const activeProjectId = project.id;
  useEffect(() => {
    setGalleryEntryContext((previous) =>
      previous && previous.projectId !== activeProjectId ? null : previous,
    );
  }, [activeProjectId]);
  // The Examples panel reads the same community gallery as the landing
  // feed; null means unreachable, so the bundled list stands in.
  const [galleryExamples, setGalleryExamples] = useState<
    | readonly {
        id: string;
        name: string;
        author: string;
        description: string;
      }[]
    | null
  >(null);
  const [publishGates, setPublishGates] = useState<SubmissionGateReport | null>(
    null,
  );
  // Check and Save needs to know who is signed in before anyone opens the
  // publish dialog, and the shelf it writes to is worth listing on arrival.
  useEffect(() => {
    let cancelled = false;
    void fetchSessionUser().then(async (user) => {
      if (cancelled) return;
      setPublishSession(user);
      if (!user) return;
      const slots = await listWorkspaceShelf();
      if (!cancelled) setWorkspaceSlots(slots);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!publishGalleryOpen) return;
    let cancelled = false;
    void fetchSessionUser().then((user) => {
      if (!cancelled) setPublishSession(user);
    });
    // The same evaluator the worker enforces, run live on the open Project.
    setPublishGates(evaluateSubmissionGates(project, resolver));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evaluated once per dialog open
  }, [publishGalleryOpen]);
  const [instanceTableOpen, setInstanceTableOpen] = useState(false);
  const [agentFileCandidate, setAgentFileCandidate] =
    useState<AgentFileCandidateSummary | null>(null);
  const browserAgentFileHost = useMemo(
    () =>
      new BrowserAgentFileHost({
        getProjectSessionId: () => editorDocumentController.projectSessionId,
        getProject: () => editorDocumentController.project,
        getDocument: (documentId) =>
          editorDocumentController.project.documents.find(
            (candidate) => candidate.id === documentId,
          ) ?? null,
        getResolver: () => editorDocumentController.resolver,
        onApprovalRequested: setAgentFileCandidate,
      }),
    [editorDocumentController, projectSessionId],
  );
  const {
    fileState,
    formalProjectBaseline,
    previousProject,
    replaceGuard,
    recoveryDialogOpen,
    setRecoveryDialogOpen,
    isDirtyWork,
    replaceActiveProject,
    saveProjectFile,
    reportExport,
    guardDirtyReplacement,
    cancelReplaceGuard,
    confirmReplaceGuard,
    downloadCurrentProjectFromGuard,
    createNewProject,
    restorePreviousProject,
    revertToFormalProjectBaseline,
    openRecoveryDialog,
    restoreRecoverySession,
    downloadRecoveryBackup,
    deleteRecoverySessionFromDialog,
    refreshApp,
    openProjectFile,
    openShelvedCircuit,
  } = useProjectFileLifecycle({
    project,
    projectSessionId,
    viewBox,
    defaultViewBox: DEFAULT_VIEWBOX,
    setStatus,
    recovery: {
      ready: recoveryReady,
      sessions: recoverySessions,
      workingCopyId: recoveryWorkingCopyId,
      stage: stageRecovery,
      cancelPending: cancelRecovery,
      flushNow: flushRecovery,
      beginWorkingCopy: beginRecoveryWorkingCopy,
      noteFormalFileHint: noteRecoveryFormalFileHint,
      discover: discoverRecovery,
      readSessionProject: readRecoveryProject,
      deleteSession: deleteRecoverySession,
    },
    installProject: (nextProject, nextViewBox) => {
      browserAgentFileHost.clear();
      setAgentFileCandidate(null);
      setImportReport(null);
      setImportReviewOpen(false);
      setGalleryEntryContext(null);
      const nextDocument = replaceProject(nextProject);
      documentViewBoxes.current = new Map();
      setDocumentStack([]);
      setViewBox(nextViewBox, nextDocument.presentation.grid);
      resetInteractionState();
      return nextDocument;
    },
  });
  const agentSession = useAgentSession({
    enabled: publicAgentUiEnabled,
    project,
    projectSessionId,
    host: browserAgentHost,
    fileHost: browserAgentFileHost,
  });
  useEffect(() => {
    if (!publicAgentUiEnabled) return;
    setAgentStatusDismissed(false);
  }, [agentSession.status, publicAgentUiEnabled]);
  const [boxPreview, setBoxPreview] = useState<BoxPreview | null>(null);
  const [panPreview, setPanPreview] = useState<PanPreview | null>(null);
  const [wireOptionsOpen, setWireOptionsOpen] = useState(false);
  const [routingGuidanceView, setRoutingGuidanceView] = useState<
    "focused" | "all" | "hidden"
  >("focused");
  const [routeStretchPreview, setRouteStretchPreview] =
    useState<RouteStretchPreview | null>(null);
  const [draftingHandlePreview, setDraftingHandlePreview] =
    useState<DraftingHandlePreview | null>(null);
  const snapGuideLayerRef = useRef<SVGGElement | null>(null);
  const {
    getCurrentState: getCurrentInteractionState,
    tool,
    pendingSymbolId,
    pendingComponentPlacement,
    wireSource,
    wireSourceRevision,
    wirePreviewPoint,
    wireWaypoints,
    wireDraftSteps,
    wireRoutingMode,
    wireCornerOrder,
    draftingSource,
    draftingHover,
    draftingWaypoints,
    draftingSnapPoint,
    componentPlacementRotation,
    componentPlacementMirror,
    componentPreviewPoint,
    vddRailMode,
    vddRailNetName,
    vddRailStart,
    copyPlacement,
    setTool,
    beginComponentPlacement,
    setComponentPreviewPoint,
    rotateComponentPlacement,
    mirrorComponentPlacement,
    beginVddRailPlacement: beginVddRailInteraction,
    setVddRailStart,
    setVddRailPreviewPoint,
    completeVddRailPlacement,
    beginCopyPlacement: beginCopyPlacementInteraction,
    setCopyPreviewPoint,
    rotateCopyPlacement,
    mirrorCopyPlacement,
    setWireSource,
    setWirePreviewPoint,
    setWireDraftSteps,
    setWireRoutingMode,
    setWireCornerOrder,
    completeWire,
    setDraftingSource,
    setDraftingHover,
    setDraftingWaypoints,
    setDraftingSnapPoint,
    clearDraftingCreate,
    beginSelectionMove: beginSelectionMoveInteraction,
    cancelInteraction,
  } = useInteractionState<SchematicClipboard>();
  const { commitStructure, transact, transactConnectivity } =
    createEditorTransactionCommands({
      project,
      document,
      dispatchProjectTransaction,
      transactDocument,
      getCurrentInteractionKind: () => getCurrentInteractionState().kind,
      cancelAllTransientInteraction,
      setStatus,
    });
  const {
    createCell,
    renameCell,
    updateCellPinDirection,
    renameCellTerminal,
    moveCellTerminal,
    setCellFormalParameters,
    setExternalSubcircuitDefinition,
    setCellSymbolBodySize,
    setCellSymbolPortPlacement,
    renameProject,
  } = createProjectStructureCommands({
    project,
    activeDocument: document,
    commitStructure,
    setStatus,
    onCellCreated: () => setDocumentStack([]),
  });
  const { openGalleryEntryById, openLibraryExample, insertGalleryEntryById } =
    createGalleryExampleCommands({
      defaultViewBox: DEFAULT_VIEWBOX,
      replaceActiveProject,
      guardDirtyReplacement,
      beginCopyPlacement: beginCopyPlacementInteraction,
      cancelAllTransientInteraction,
      setGalleryEntryContext,
      setStatus,
    });
  const [draftingInspectorSegment, setDraftingInspectorSegment] = useState<{
    objectId: string;
    index: number;
  } | null>(null);
  const [draftingTangentInput, setDraftingTangentInput] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const [draftingBearingInput, setDraftingBearingInput] = useState<{
    objectId: string;
    value: string;
  } | null>(null);
  const [selectedRouteSegmentIndex, setSelectedRouteSegmentIndex] = useState<
    number | null
  >(null);
  /** Survives the dialog closing, so a mistaken dismissal loses nothing. */
  const [publishDraft, setPublishDraft] = useState<PublishGalleryDraft | null>(
    null,
  );
  /** The signed-in account's last few checked circuits, newest first. */
  const [workspaceSlots, setWorkspaceSlots] = useState<
    readonly WorkspaceSlot[]
  >([]);
  /**
   * The corner shape is a standing authoring preference, not per-wire state:
   * picking the wire tool again reset it, so a chosen diagonal had to be
   * re-selected for every single wire.
   */
  const lastWireShapeRef = useRef<{
    routingMode: WireRoutingMode;
    cornerOrder: WireCornerOrder;
  }>({ routingMode: "orthogonal", cornerOrder: "auto" });
  const [selectedEndpoint, setSelectedEndpoint] = useState<WireSource | null>(
    null,
  );
  const [bulkDrawInstanceId, setBulkDrawInstanceId] = useState<string | null>(
    null,
  );
  const [highlightedNetOrigin, setHighlightedNetOrigin] = useState<{
    documentId: string;
    netId: string;
    hierarchyPath: readonly HierarchyFrame[];
    endpoint?: RouteEndpoint;
  } | null>(null);
  const routeCounter = useRef(0);
  const canvasDragSessionRef = useRef<CanvasDragSession | null>(null);
  /**
   * Last pointer position seen on the canvas, in document coordinates. A
   * placement that starts from the keyboard has no pointer event of its own,
   * so it seeds its preview from here instead of waiting for the next move.
   */
  const lastCanvasPointRef = useRef<Point | null>(null);

  /** Show a placement ghost under the cursor without waiting for a move. */
  function seedComponentPreviewFromPointer(): void {
    const point = lastCanvasPointRef.current;
    if (point) setComponentPreviewPoint(point);
  }

  function seedCopyPreviewFromPointer(): void {
    const point = lastCanvasPointRef.current;
    if (!point) return;
    setCopyPreviewPoint({
      x: snapCoordinate(point.x, document.presentation.grid),
      y: snapCoordinate(point.y, document.presentation.grid),
    });
  }
  const suppressInstanceClick = useRef(false);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const selectionShelfRef = useRef<HTMLButtonElement>(null);
  const instanceValueInputRef = useRef<HTMLInputElement>(null);
  const netLabelPropertyInputRef = useRef<HTMLInputElement>(null);
  const netLabelEditorInputRef = useRef<HTMLInputElement>(null);
  const documentViewBoxes = useRef(new Map<string, GridRect>());
  const [projectedMovePreviewDocument, setProjectedMovePreviewDocument] =
    useState<SchematicDocument | null>(null);
  const renderedDocument = useMemo(() => {
    if (projectedMovePreviewDocument) return projectedMovePreviewDocument;
    if (!draftingHandlePreview || !document.drafting) return document;
    return {
      ...document,
      drafting: {
        ...document.drafting,
        objects: document.drafting.objects.map((object) =>
          object.id === draftingHandlePreview.objectId
            ? draftingHandlePreview.object
            : object,
        ),
      },
    };
  }, [document, draftingHandlePreview, projectedMovePreviewDocument]);
  const lastGoodSceneRef = useRef<ReturnType<typeof buildSvgScene> | null>(
    null,
  );
  const sceneState = useMemo(() => {
    const outcome = buildSceneSafely(() => {
      if (sceneCrashRequested()) {
        throw new Error("scene build crashed (test hook)");
      }
      return buildSvgScene(renderedDocument, resolver, { bounds: viewBox });
    }, lastGoodSceneRef.current);
    if (!outcome.degraded) lastGoodSceneRef.current = outcome.scene;
    return outcome;
  }, [renderedDocument, resolver, viewBox]);
  const scene = sceneState.scene;
  useEffect(() => {
    if (sceneState.degraded) {
      setStatus(
        `Scene rendering failed; showing the last good view — ${sceneState.message}`,
      );
    }
  }, [sceneState.degraded, sceneState.message]);
  // React compares dangerouslySetInnerHTML by prop identity, and an inline
  // `{ __html }` literal would force an innerHTML replacement on every App
  // re-render — destroying live drag previews (and pointer capture) whenever
  // unrelated state such as recovery status changes. Memoize the prop object
  // so re-renders with unchanged scene content leave the DOM subtree alone.
  const sceneInnerHtml = useMemo(() => ({ __html: scene.formalBody }), [scene]);
  const copyPreviewState = useMemo(() => {
    if (!copyPlacement || !copyPlacement.previewPoint) {
      return { scene: null, error: null };
    }
    const offset = {
      x: copyPlacement.previewPoint.x - copyPlacement.anchor.x,
      y: copyPlacement.previewPoint.y - copyPlacement.anchor.y,
    };
    try {
      return {
        scene: buildSvgScene(
          clipboardPreviewDocument(
            document,
            copyPlacement.clipboard,
            offset,
            copyPlacement.orientationOperations,
            resolver,
          ),
          resolver,
          { bounds: viewBox },
        ),
        error: null,
      };
    } catch (error) {
      return {
        scene: null,
        error:
          error instanceof Error
            ? error.message
            : "Copy preview could not be rendered",
      };
    }
  }, [copyPlacement, document, resolver, viewBox]);
  useEffect(() => {
    if (copyPreviewState.error) {
      setStatus(`Copy preview unavailable — ${copyPreviewState.error}`);
    }
  }, [copyPreviewState.error]);
  const copyPreviewInnerHtml = useMemo(
    () =>
      copyPreviewState.scene === null
        ? null
        : { __html: copyPreviewState.scene.formalBody },
    [copyPreviewState.scene],
  );
  const unplaced = document.instances.filter(
    (instance) => instance.placement === null,
  );
  const returnablePlacedInstances = document.instances.filter(
    (instance) => instance.placement !== null,
  );
  const {
    selectedIds,
    supplementalSelection,
    selectedRouteId,
    selectedAnnotationId,
    selectedDraftingId,
    selectedInstance,
    selectedInstanceHasDifferentialInputs,
    selectedHierarchyCell,
    selectedDevice,
    selectedCapacitorPlateRows,
    selectedExternalSubcircuit,
    selectedExternalMosMapping,
    selectedPropertyDevice,
    selectedRoute,
    selectedRouteNetLabels,
    selectedRouteNetLabel,
    selectedAnnotation,
    selectedNetLabelBinding,
    selectedDrafting,
    hasHierarchyEnterSelection,
    hasRotatableSelection,
    hasMirrorableSelection,
    hasInspectableSelection,
    selectionShelfSummary,
    selectedNoConnect,
    selectedEndpointNetId,
    selectedHighlightNetId,
    selectedHighlightEndpoint,
  } = deriveSelectionInspectionModel({
    project,
    document,
    resolver,
    selection: visualSelection,
    selectedEndpoint,
  });
  const projectConnectivityIndex = useMemo(
    () => buildProjectConnectivityIndex(project, resolver),
    [project, resolver],
  );
  const routeGeometryRecords = useMemo(
    () =>
      document.routes.flatMap((route) => {
        const geometry = projectConnectivityIndex.documents
          .get(document.id)
          ?.routingGeometry.routes.get(route.id);
        if (!geometry) return [];
        return [{ route, geometry }];
      }),
    [document, projectConnectivityIndex],
  );
  const netlistAnalysis = useMemo(
    () => analyzeDesignNetlist(project),
    [project],
  );
  const highlightedTrace = useMemo(
    () =>
      highlightedNetOrigin
        ? traceHierarchyNet(
            projectConnectivityIndex,
            highlightedNetOrigin.documentId,
            highlightedNetOrigin.netId,
            highlightedNetOrigin.endpoint,
            highlightedNetOrigin.hierarchyPath,
          )
        : undefined,
    [highlightedNetOrigin, projectConnectivityIndex],
  );
  const highlightedNet = useMemo(
    () =>
      highlightedTrace?.highlights.find(
        (highlight) =>
          highlight.documentId === document.id &&
          highlight.hierarchyPath.length === documentStack.length &&
          highlight.hierarchyPath.every(
            (frame, index) =>
              frame.parentDocumentId ===
                documentStack[index]?.parentDocumentId &&
              frame.instanceId === documentStack[index]?.instanceId &&
              frame.childDocumentId === documentStack[index]?.childDocumentId,
          ),
      ),
    [document.id, documentStack, highlightedTrace],
  );
  const highlightedNetId = highlightedNet?.netId ?? null;
  const liveDiagnosticSnapshot = useMemo(
    () => diagnoseProjectSnapshot(project, resolver, projectConnectivityIndex),
    [project, projectConnectivityIndex, resolver],
  );
  const electricalDiagnostics = useMemo(
    () =>
      liveDiagnosticSnapshot.diagnostics.filter(
        (diagnostic) => diagnostic.domain === "erc",
      ),
    [liveDiagnosticSnapshot],
  );
  const searchResults = useMemo(
    () =>
      buildProjectSearchIndex(project, {
        connectivityIndex: projectConnectivityIndex,
      }).search(searchQuery),
    [project, projectConnectivityIndex, searchQuery],
  );
  const {
    enabled: cellSymbolLayoutEnabled,
    layout: selectedCellSymbolLayout,
    activeDragPointerId: cellSymbolLayoutDragPointerId,
    cancelDrag: cancelCellSymbolLayoutDrag,
    exit: exitCellSymbolLayout,
    toggle: toggleCellSymbolLayout,
    beginDrag: beginCellSymbolLayoutDrag,
    completeDrag: completeCellSymbolLayoutDrag,
  } = useCellSymbolLayout({
    selectedInstance,
    child: selectedHierarchyCell,
    resolver,
    selectionOpen,
    canvasPointFromEvent: (event) =>
      pointFromClient(event.clientX, event.clientY, event.currentTarget),
    setBodySize: setCellSymbolBodySize,
    setPortPlacement: setCellSymbolPortPlacement,
  });
  const {
    netLabelForRoute,
    netLabelEditsForRoute,
    netNameEditsForAnnotation,
    propertyParametersForInstance,
    instancePropertyEdits,
  } = createPropertyEditPlanner({
    project,
    document,
    resolver,
    routeGeometryRecords,
    setStatus,
  });
  const {
    addAdditionalParameter,
    additionalParameterDraft,
    additionalParameterDraftChanges,
    applyAdditionalParameters,
    applyNetLabel,
    beginAnnotationTextEditing,
    beginDraftingTextEditing,
    beginNetLabelEditing,
    commitInstancePropertyDraft,
    commitElectricalMarkerName,
    commitNetLabelEditing,
    commitPendingNetLabelDraft,
    commitTextEditing,
    clearTextEditing,
    cancelAdditionalParameters,
    deleteSelectedRouteNetLabel,
    deleteTextEditing,
    discardInstancePropertyDraft,
    hasInstancePropertyDraftChanges,
    instancePropertyDraft,
    netLabelDraft,
    netLabelEditorOpen,
    removeAdditionalParameter,
    setNetLabelEditorOpen,
    setReferenceLabelsVisible,
    setValueLabelsVisible,
    showSelectedInstanceValue,
    textEditing,
    updateInstancePropertyDraft,
    updateAdditionalParameter,
    updateTextEditing,
    updateNetLabelDraft,
  } = usePropertiesEditor({
    document,
    selectedRoute,
    selectedRouteNetLabel: selectedRouteNetLabel ?? null,
    selectedRouteNetLabels,
    selectedInstance,
    componentParametersForInstance: propertyParametersForInstance,
    wireSourceActive: wireSource !== null,
    netLabelEditorInputRef,
    transact,
    setStatus,
    replaceSelectionKind: (kind, ids) => replaceSelectionKind(kind, ids),
    selectOnly: (kind, ids) => selectOnly(kind, ids),
    selectDraftingObject,
    clearSelectionKinds,
    netLabelForRoute,
    netLabelEditsForRoute,
    netNameEditsForAnnotation,
    instancePropertyEdits,
    referenceLabelVisibilityEdits,
    valueVisibilityEdits,
    isCellPinAnnotation: (annotation) => {
      const anchor = annotation.anchor;
      if (anchor.kind !== "object") return false;
      const interfaceInstanceId = anchor.objectId;
      return (
        document.netlist?.terminals.some((terminal) =>
          terminal.interfaceInstanceIds.includes(interfaceInstanceId),
        ) === true
      );
    },
    commitCellPinAnnotation: (annotation, name) => {
      if (annotation.anchor.kind !== "object") return false;
      const interfaceInstanceId = annotation.anchor.objectId;
      const terminal = document.netlist?.terminals.find((candidate) =>
        candidate.interfaceInstanceIds.includes(interfaceInstanceId),
      );
      if (!terminal) return false;
      try {
        const {
          content,
          formatOverride,
          binding: _binding,
          ...annotationPresentation
        } = annotation;
        const editedContent = formatOverride ?? content;
        const semanticContent = semanticTextDocument(name, "formal-port");
        const normalizedAnnotation: Annotation = {
          ...annotationPresentation,
          binding: {
            kind: "cell-terminal-name",
            terminalId: terminal.id,
          },
          ...(editedContent &&
          JSON.stringify(editedContent) !== JSON.stringify(semanticContent)
            ? { formatOverride: editedContent }
            : {}),
        };
        const renamed = terminal.name !== name;
        const edits = planEditCellTerminalAnnotation(
          project,
          document.id,
          terminal.id,
          normalizedAnnotation,
          name,
        );
        if (edits.length === 0) {
          setStatus(`Cell Pin ${terminal.name} is already current`);
          return true;
        }
        const committed = commitStructure("edit-cell-pin-label", edits);
        if (committed) {
          setStatus(
            renamed
              ? `Renamed Cell Pin to ${name}`
              : `Formatted Cell Pin ${name}`,
          );
        }
        return committed;
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Could not rename port",
        );
        return false;
      }
    },
  });
  const selectedInstanceLabel = selectedInstance
    ? instanceLabelAnnotationFor(document, selectedInstance.id)
    : undefined;
  const selectedInstanceValue = selectedInstance
    ? instanceValueAnnotation(document, selectedInstance.id)
    : null;
  // Availability follows the live property draft, not only committed state:
  // typing a value must enable the Value toggle immediately. Geometry edits
  // in the draft are irrelevant to the projection.
  const selectedInstanceValueAvailable = selectedInstance
    ? displayableInstanceValue(
        previewInstanceValueSource(selectedInstance, instancePropertyDraft),
      ).kind === "displayable"
    : false;
  const selectedGroupLabelsAllVisible =
    selectedIds.length > 1 &&
    selectedIds.every((id) => {
      const label = instanceLabelAnnotationFor(document, id);
      return label !== undefined && label.visible !== false;
    });
  const selectedGroupValuesAllVisible =
    selectedIds.length > 1 &&
    selectedIds.every((id) => {
      const value = instanceValueAnnotation(document, id);
      return value !== null && value.visible !== false;
    });
  const selectedGroupValueAvailable = selectedIds.some((id) => {
    const instance = document.instances.find((item) => item.id === id);
    return instance
      ? displayableInstanceValue(instance).kind === "displayable"
      : false;
  });
  const styleProfile = resolveDocumentStyleProfile(document.presentation);
  const selectedHighlightIsActive = Boolean(
    selectedHighlightNetId &&
    highlightedNetOrigin?.documentId === document.id &&
    highlightedNetOrigin.hierarchyPath.length === documentStack.length &&
    highlightedNetOrigin.hierarchyPath.every(
      (frame, index) =>
        frame.parentDocumentId === documentStack[index]?.parentDocumentId &&
        frame.instanceId === documentStack[index]?.instanceId &&
        frame.childDocumentId === documentStack[index]?.childDocumentId,
    ) &&
    highlightedNetOrigin.netId === selectedHighlightNetId &&
    (!highlightedNetOrigin.endpoint ||
      (selectedHighlightEndpoint &&
        endpointKey(highlightedNetOrigin.endpoint) ===
          endpointKey(selectedHighlightEndpoint))),
  );
  const flightlines = useMemo(
    () => [
      ...new Map(
        [
          ...(projectConnectivityIndex.documents
            .get(document.id)
            ?.logicalNets.values() ?? []),
        ]
          .flatMap((net) => net.routingGuidance)
          .map((line) => [line.id, line] as const),
      ).values(),
    ],
    [document.id, document.nets, projectConnectivityIndex],
  );
  const displayedFlightlines = useMemo(() => {
    // Routing guidance is derived exclusively from imported Net intent. It is
    // not Document UI state: labelling, moving, or deleting a Route must never
    // dismiss another imported Net's unresolved topology. A highlighted Net
    // already has the stronger conductor overlay, so omit only that Net's
    // guides rather than suppressing the complete imported document.
    if (routingGuidanceView === "hidden") return [];
    const focusedNetIds = new Set(
      [wireSource?.netId, selectedHighlightNetId, highlightedNetId].filter(
        (netId): netId is string => netId !== null && netId !== undefined,
      ),
    );
    const scoped =
      routingGuidanceView === "focused" && focusedNetIds.size > 0
        ? flightlines.filter((flightline) =>
            [flightline.netId, flightline.fromNetId, flightline.toNetId].some(
              (netId) => focusedNetIds.has(netId),
            ),
          )
        : flightlines;
    return highlightedNetId
      ? scoped.filter(
          (flightline) =>
            ![
              flightline.netId,
              flightline.fromNetId,
              flightline.toNetId,
            ].includes(highlightedNetId),
        )
      : scoped;
  }, [
    flightlines,
    highlightedNetId,
    routingGuidanceView,
    selectedHighlightNetId,
    wireSource?.netId,
  ]);
  const crossings = useMemo(
    () =>
      deriveCrossings(
        document,
        resolver,
        projectConnectivityIndex.documents.get(document.id)?.routingGeometry,
      ),
    [document, projectConnectivityIndex, resolver],
  );
  const visualDiagnostics = useMemo(
    () => diagnoseVisualQuality(document, resolver),
    [document, resolver],
  );
  const visualDiagnosticSummary = useMemo(
    () => summarizeVisualDiagnostics(visualDiagnostics),
    [visualDiagnostics],
  );
  const visibleEndpoints: WireSource[] = useMemo(
    () => [
      ...document.instances.flatMap((instance) => {
        if (!instance.placement) return [];
        const resolved = resolver.resolve(
          instance.symbolId,
          instance.symbolVariantId,
        );
        if (!resolved) return [];
        return resolved.definition.pins
          .filter((pin) =>
            isVisibleEndpoint(document, resolver, {
              kind: "terminal",
              instanceId: instance.id,
              pinName: pin.name,
            }),
          )
          .flatMap((pin): WireSource[] => {
            const endpoint: RouteEndpoint = {
              kind: "terminal",
              instanceId: instance.id,
              pinName: pin.name,
            };
            const connection = resolveEndpointConnection(
              document,
              resolver,
              endpoint,
            );
            return connection
              ? [
                  {
                    endpoint,
                    connection,
                    netId: endpointNetId(document, endpoint),
                    preludeEdits: [],
                    ...(isMosBulkTerminal(document, endpoint)
                      ? { routePresentation: "bulk-dashed" as const }
                      : {}),
                  },
                ]
              : [];
          });
      }),
      ...document.junctions
        .filter((junction) => {
          const role = junction.role ?? "branch";
          return role === "branch" || role === "route-anchor";
        })
        .flatMap((junction): WireSource[] => {
          const endpoint: RouteEndpoint = {
            kind: "junction",
            junctionId: junction.id,
          };
          const connection = resolveEndpointConnection(
            document,
            resolver,
            endpoint,
          );
          return connection
            ? [
                {
                  endpoint,
                  connection,
                  netId: junction.netId,
                  preludeEdits: [],
                },
              ]
            : [];
        }),
    ],
    [document, resolver],
  );
  const visibleBulkEndpoints: WireSource[] = useMemo(
    () =>
      document.instances.flatMap((instance): WireSource[] => {
        if (!instance.placement || bulkDrawInstanceId !== instance.id) {
          return [];
        }
        const endpoint: RouteEndpoint = {
          kind: "terminal",
          instanceId: instance.id,
          pinName: "B",
        };
        const connection = resolveEndpointConnection(
          document,
          resolver,
          endpoint,
        );
        return connection
          ? [
              {
                endpoint,
                connection,
                netId: endpointNetId(document, endpoint),
                preludeEdits: [],
                routePresentation: "bulk-dashed",
              },
            ]
          : [];
      }),
    [bulkDrawInstanceId, document, resolver],
  );
  const wiringEndpoints = useMemo(() => {
    const byKey = new Map<string, WireSource>();
    for (const endpoint of [...visibleEndpoints, ...visibleBulkEndpoints]) {
      byKey.set(endpointKey(endpoint.endpoint), endpoint);
    }
    return [...byKey.values()];
  }, [visibleBulkEndpoints, visibleEndpoints]);
  const contactComponents = useMemo(
    () =>
      [
        ...(projectConnectivityIndex.documents
          .get(document.id)
          ?.logicalNets.values() ?? []),
      ].flatMap((net) => net.routedComponents),
    [document.id, projectConnectivityIndex],
  );
  const {
    beginRouteStretch,
    drawSelectedMosBulk,
    deleteSelectedRouteConnection,
    fixWirePoint,
    finishWireAtPoint,
    handleFlightline,
    handleWireRoutePointerDown,
    handleWireEndpoint,
    commitWire,
    selectRoute,
  } = useWireInteraction({
    document,
    resolver,
    selectedInstance,
    selectedRouteId,
    selectedRouteSegmentIndex,
    visibleEndpoints,
    routeGeometryRecords,
    wireSource,
    wireSourceRevision,
    wireWaypoints,
    wireDraftSteps,
    wireRoutingMode,
    wireCornerOrder,
    nextRoutingSuffix,
    transact,
    setStatus,
    setTool,
    setWireSource,
    setWirePreviewPoint,
    setWireDraftSteps,
    completeWire,
    clearTransientCanvasState,
    cancelInteraction,
    setBulkDrawInstanceId,
    replaceRouteSelection: (routeIds) =>
      replaceSelectionKind("route", routeIds),
    selectOnly,
    setSelectedRouteSegmentIndex,
    setSelectedEndpoint,
    canvasDragSessionRef,
    setRouteStretchPreview,
    pointFromClient,
    logicalRadiusForPixels,
    contactComponents,
    createRouteAnchor: routeAnchor,
  });
  const cellInsertCandidates = useMemo(
    () =>
      project.documents.flatMap((candidate) => {
        if (candidate.id === document.id || !candidate.netlist) return [];
        const definition = resolver.resolve(
          hierarchicalSymbolId(candidate.netlist.name),
        )?.definition;
        return definition
          ? [
              {
                childDocumentId: candidate.id,
                cellName: candidate.netlist.name,
                symbol: definition,
              },
            ]
          : [];
      }),
    [document.id, project.documents, resolver],
  );
  const externalSubcircuitInsertCandidates = useMemo(
    () =>
      project.externalSubcircuitDefinitions.flatMap((definition) => {
        const mapping = definition.presentation
          ? undefined
          : resolvePdkSymbolMappingForTerminalOrder(
              definition.name,
              definition.terminals.map((terminal) => terminal.name),
            );
        const symbol = resolver.resolve(
          mapping?.symbolId ?? externalSubcircuitSymbolId(definition.id),
        )?.definition;
        return symbol
          ? [
              {
                definitionId: definition.id,
                masterName: definition.name,
                symbol,
              },
            ]
          : [];
      }),
    [project.externalSubcircuitDefinitions, resolver],
  );
  const pendingPlacementSymbol = pendingSymbolId
    ? resolver.resolve(pendingSymbolId)?.definition
    : undefined;
  const {
    beginRetainedInstancePlacement: beginRetainedInstancePlacementFromHook,
    cancelComponentInsert: cancelComponentInsertFromHook,
    commitPendingPlacementAt: commitPendingPlacementAtFromHook,
    closeInsertDialog: closeInsertDialogFromHook,
    insertDialogOpen,
    insertInitialSelectionId,
    insertScope,
    recentSymbolIds,
    rotatePendingComponent: rotatePendingComponentFromHook,
    mirrorPendingComponent: mirrorPendingComponentFromHook,
    startInsert: startInsertFromHook,
  } = useComponentPlacement({
    recentStorageKey: RECENT_COMPONENTS_STORAGE_KEY,
    document,
    project,
    resolver,
    styleProfile,
    visibleEndpoints,
    transact,
    transactConnectivity,
    transactProject: (transactionId, edits) =>
      commitStructure(transactionId, edits),
    selectOnly,
    cancelAllTransientInteraction,
    cancelCanvasDrag: () => canvasDragSessionRef.current?.cancel(),
    clearTransientCanvasState,
    paintSnapGuides,
    beginVddRailInteraction,
    beginComponentPlacement: (request) => {
      beginComponentPlacement(request);
      seedComponentPreviewFromPointer();
    },
    rotateComponentPlacement,
    mirrorComponentPlacement,
    componentPlacementRotation,
    componentPlacementMirror,
    completeVddRailPlacement,
    setComponentPreviewPoint,
    setStatus,
    vddRailMode,
    vddRailNetName,
    vddRailStart,
    pendingSymbolId,
    pendingComponentPlacement,
    setVddRailStart,
    setVddRailPreviewPoint,
  });
  const {
    completeVisualSelectionMove,
    visualMoveOrigin: commandMoveVisualOrigin,
    resolveInstanceMove: instanceMoveAt,
    completeInstanceMove,
  } = createSelectionMoveController({
    document,
    resolver,
    visibleEndpoints,
    routeGeometryRecords,
    contactComponents,
    transactConnectivity,
    setStatus,
    nextRoutingSuffix,
  });
  const {
    rotate: rotateSelected,
    mirror: mirrorSelected,
    align: alignSelectedInstances,
  } = createSelectionTransformController({
    document,
    resolver,
    selectedInstanceIds: selectedIds,
    selection: visualSelection,
    transact,
    setStatus,
  });
  const {
    beginCopyPlacement: beginCopyPlacementFromSelection,
    beginKeyboardSelectionMove: beginKeyboardSelectionMoveFromSelection,
    beginMove: beginMoveFromSelection,
    beginVisualSelectionMove: beginVisualSelectionMoveFromSelection,
    commitCopyPlacement: commitCopyPlacementFromSelection,
    commitCommandMove: commitCommandMoveFromSelection,
    clearCommandMoveSession: clearCommandMoveSessionFromSelection,
    deleteSelectedJunction: deleteSelectedJunctionFromSelection,
    deleteSelection: deleteSelectionFromSelection,
    canBeginKeyboardSelectionMove,
    canTransformCommandMove,
    mirrorCommandMove: mirrorCommandMoveFromSelection,
    rotateCommandMove: rotateCommandMoveFromSelection,
    selectInstance: selectInstanceFromSelection,
    toggleSelectedNoConnect: toggleSelectedNoConnectFromSelection,
    updateCommandMovePreview: updateCommandMovePreviewFromSelection,
  } = useSelectionInteraction({
    document,
    resolver,
    visualSelection,
    selectedIds,
    selectedRouteId,
    selectedAnnotationId,
    selectedDraftingId,
    selectedEndpoint,
    selectedNoConnect,
    selectedEndpointNetId,
    getInteractionState: getCurrentInteractionState,
    transact,
    transactProjectDocument: (transactionId, edits) => {
      const committed = commitStructure(transactionId, [
        {
          kind: "transact_document",
          documentId: document.id,
          expectedRevision: document.revision,
          edits: [...edits],
        },
      ]);
      return {
        ok: committed,
        revision: committed ? document.revision + 1 : document.revision,
      };
    },
    setStatus,
    setSelectedEndpoint,
    resetSelection,
    replaceSelectionKind,
    selectOnly,
    deleteSelectedRouteConnection,
    deleteSelectedAnnotation,
    clearTransientCanvasState,
    cancelAllTransientInteraction,
    cancelInteraction,
    cancelCanvasDrag: () => canvasDragSessionRef.current?.cancel(),
    paintSnapGuides,
    beginCopyPlacementInteraction: (clipboard, anchor) => {
      beginCopyPlacementInteraction(clipboard, anchor);
      seedCopyPreviewFromPointer();
    },
    setCopyPreviewPoint,
    nextUniqueSuffix: () => {
      uniqueSuffixCounter.current += 1;
      return uniqueSuffixCounter.current;
    },
    nextNoConnectId,
    endpointTestId,
    tool,
    canvasDragSessionRef,
    pointFromClient,
    completeVisualSelectionMove,
    snapCoordinate,
    updateInstanceSelection,
    suppressInstanceClickRef: suppressInstanceClick,
    resolveInstanceMove: instanceMoveAt,
    completeInstanceMove,
    logicalRadiusForPixels,
    snapGuides: paintSnapGuides,
    setProjectedMovePreview: setProjectedMovePreviewDocument,
    beginSelectionMoveInteraction,
    visualMoveOrigin: commandMoveVisualOrigin,
  });

  const textEditingTarget = textEditing
    ? resolveTextEditingTarget(document, textEditing)
    : null;
  const editingAnnotation =
    textEditingTarget?.owner === "annotation"
      ? textEditingTarget.object
      : undefined;
  const selectedHiddenBulkNet = selectedInstance
    ? razaviHiddenBulkRisk(document, selectedInstance.id)
    : undefined;
  const selectedBulkResolution = selectedInstance
    ? resolveMosBulkConnection(document, selectedInstance)
    : undefined;
  const editingDrafting =
    textEditingTarget?.owner === "drafting"
      ? textEditingTarget.object
      : undefined;
  const textEditingBounds = editingAnnotation
    ? annotationHitBox(
        document,
        editingAnnotation,
        annotationAnchor(
          document,
          resolver,
          editingAnnotation,
          routeGeometryRecords,
          styleProfile,
        ),
        routeGeometryRecords,
        styleProfile,
      )
    : editingDrafting?.kind === "text"
      ? resolveDraftingObjectGeometry(document, resolver, editingDrafting)
          .bounds
      : null;
  const textEditingLocked = Boolean(textEditingTarget?.object.locked);

  const internalSelection = deriveInternalGroupSelection(document, selectedIds);
  const selectedInternalRouteIds = new Set(internalSelection.routeIds);
  const selectedInternalJunctionIds = new Set(internalSelection.junctionIds);
  const selectedInternalObjectIds = new Set([
    ...internalSelection.netIds,
    ...internalSelection.routeIds,
    ...internalSelection.junctionIds,
  ]);
  const wireFixedPoints = wireSource
    ? compileWireDraft(wireSource, wireSource, wireDraftSteps).points
    : [];
  const wireDraftPoints =
    wireSource && wirePreviewPoint
      ? compileWireDraft(
          wireSource,
          {
            connection: {
              contactPoint: wirePreviewPoint,
              gridLanding: wirePreviewPoint,
              escapePath: [],
              outward: null,
            },
          },
          wireDraftSteps,
          wireRoutingMode,
          wireCornerOrder,
        ).points
      : wireFixedPoints;
  const projectInstanceCount = project.documents.reduce(
    (count, candidate) => count + candidate.instances.length,
    0,
  );
  const contentScene = useMemo(() => {
    try {
      return buildSvgScene(document, resolver);
    } catch {
      // Fit view falls back to the default framing when the bounds scene
      // cannot be built; the canvas itself renders through the guarded
      // formal-scene pipeline above.
      return null;
    }
  }, [document, resolver]);
  const zoomPercent = Math.round((DEFAULT_VIEWBOX.width / viewBox.width) * 100);
  const canvasIsEmpty =
    document.instances.every((instance) => instance.placement === null) &&
    document.routes.length === 0 &&
    document.annotations.length === 0 &&
    (document.drafting?.objects.length ?? 0) === 0;
  const {
    insertConstructionVertex,
    insertArrowWaypoint,
    deleteConstructionVertex,
    setDraftingStyle,
    setDraftingTangentAngle,
    setDraftingBearing,
    toggleDraftingLock,
    addPlainText,
    addCurrentArrow,
    reverseSelectedDrafting,
  } = createDraftingCommands({
    document,
    resolver,
    viewBox,
    selection: visualSelection,
    selectedDrafting,
    inspectorSegment: draftingInspectorSegment,
    selectedRoute,
    selectedRouteSegmentIndex,
    routeGeometryRecords,
    transact,
    setStatus,
    nextId: (prefix) => {
      uniqueSuffixCounter.current += 1;
      return `${prefix}-${uniqueSuffixCounter.current}`;
    },
    beginTextEditing: beginDraftingTextEditing,
    selectAnnotation: (id) => selectOnly("annotation", [id]),
  });
  const {
    snapPoint: snapDraftingPoint,
    handleCanvasClick: handleDraftingCanvasClick,
    finish: finishDraftingCreate,
  } = createDraftingCreateController({
    document,
    resolver,
    visibleEndpoints,
    routeGeometryRecords,
    tool,
    source: draftingSource,
    hover: draftingHover,
    waypoints: draftingWaypoints,
    setSource: setDraftingSource,
    setHover: setDraftingHover,
    setWaypoints: setDraftingWaypoints,
    setSnapPoint: setDraftingSnapPoint,
    clear: clearDraftingCreate,
    setTool,
    transact,
    setStatus,
    nextId: (prefix) => {
      uniqueSuffixCounter.current += 1;
      return `${prefix}-${uniqueSuffixCounter.current}`;
    },
  });
  const {
    beginDrag: beginDraftingDrag,
    beginHandleDrag: beginDraftingHandleDrag,
  } = createDraftingDragController({
    document,
    resolver,
    visibleEndpoints,
    dragSessionRef: canvasDragSessionRef,
    dragThresholdPx: DRAG_START_DISTANCE_PX,
    snapCaptureRadiusPx: SNAP_CAPTURE_RADIUS_PX,
    pointFromClient: (clientX, clientY, svg, snapToGrid) =>
      snapToGrid
        ? pointFromClient(clientX, clientY, svg)
        : pointFromClient(clientX, clientY, svg, false),
    logicalRadiusForPixels,
    paintSnapGuides,
    snapDraftingPoint,
    onCompositeMove: (event, hitTarget) => {
      if (getCurrentInteractionState().kind !== "moving-selection")
        return false;
      const primaryInstanceId = selectedIds.at(-1);
      if (primaryInstanceId) {
        beginMoveFromSelection(event, primaryInstanceId, hitTarget);
      } else {
        beginVisualSelectionMoveFromSelection(
          event,
          visualSelection,
          hitTarget,
        );
      }
      return true;
    },
    selectDraftingObject,
    setInspectorSegment: setDraftingInspectorSegment,
    clearTangentInput: () => setDraftingTangentInput(null),
    setHandlePreview: setDraftingHandlePreview,
    transact,
    setStatus,
  });

  function compositeSelectionOwnsHit(
    kind: "instance" | "instance-label" | "annotation" | "route" | "junction",
    id: string,
  ): boolean {
    // Any multi-object selection is composite, counted across every kind. The
    // previous rule also required at least one Instance, so a marquee holding
    // only Routes, Junctions, or Annotations was never treated as a group and
    // dragging it moved just the grabbed object.
    const hasCompositeSelection =
      selectedIds.length +
        visualSelection.routeIds.length +
        visualSelection.junctionIds.length +
        visualSelection.annotationIds.length +
        visualSelection.draftingIds.length >
      1;
    if (!hasCompositeSelection) return false;
    if (kind === "instance" || kind === "instance-label") {
      return selectedIds.includes(id);
    }
    if (kind === "route") {
      return (
        visualSelection.routeIds.includes(id) ||
        selectedInternalRouteIds.has(id)
      );
    }
    if (kind === "junction") {
      return (
        visualSelection.junctionIds.includes(id) ||
        selectedInternalJunctionIds.has(id)
      );
    }
    const annotation = document.annotations.find(
      (candidate) => candidate.id === id,
    );
    return Boolean(
      visualSelection.annotationIds.includes(id) ||
      (annotation?.anchor.kind === "object" &&
        (selectedIds.includes(annotation.anchor.objectId) ||
          selectedInternalObjectIds.has(annotation.anchor.objectId))),
    );
  }

  useEffect(() => {
    if (!selectedRouteId) setSelectedRouteSegmentIndex(null);
  }, [selectedRouteId]);

  useEffect(() => {
    const pruned = pruneVisualSelection(visualSelection, document);
    if (pruned !== visualSelection) replaceSelection(pruned);
  }, [document, visualSelection]);

  function openProperties(): void {
    setImportReviewOpen(false);
    setSelectionOpen(true);
    // Focus the header, not the first field: Q stays a pure toggle and
    // editing starts only when the user clicks an input.
    requestAnimationFrame(() => {
      selectionShelfRef.current?.focus();
    });
  }

  function closeProperties(): void {
    exitCellSymbolLayout();
    setSelectionOpen(false);
    setImportReviewOpen(false);
  }

  function selectAllObjects(): void {
    replaceSelection({
      instanceIds: document.instances
        .filter((instance) => instance.placement)
        .map((instance) => instance.id),
      routeIds: document.routes.map((route) => route.id),
      junctionIds: document.junctions.map((junction) => junction.id),
      annotationIds: document.annotations.map((annotation) => annotation.id),
      draftingIds: (document.drafting?.objects ?? []).map(
        (object) => object.id,
      ),
    });
    setSelectedEndpoint(null);
  }

  function clearEditorSelection(): void {
    resetSelection();
    setSelectedEndpoint(null);
    setSelectedRouteSegmentIndex(null);
    setStatus("Selection cleared");
  }

  function inspectInstance(instanceId: string): void {
    setSelectedEndpoint(null);
    updateInstanceSelection(instanceId, false);
    setImportReviewOpen(false);
    setSelectionOpen(true);
    setStatus(`Properties for ${instanceId}`);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => instanceValueInputRef.current?.focus());
    });
  }

  function showLibraryPanel(): void {
    showLeftPanel("library");
  }

  function showExamplesPanel(): void {
    showLeftPanel("examples");
  }

  function toggleExamplesPanel(): void {
    toggleExamplesPanelFromShell();
  }

  // boot Project only; ordinary sessions never re-run these.
  const bootTargetHandled = useRef(false);
  useEffect(() => {
    if (bootTargetHandled.current) return;
    bootTargetHandled.current = true;
    const exampleId = new URLSearchParams(window.location.search).get(
      "example",
    );
    if (initialGalleryEntryId) {
      void openGalleryEntryById(initialGalleryEntryId, false);
      return;
    }
    if (exampleId) {
      const exampleProject = createLibraryExampleProject(exampleId);
      const example = libraryProjectExamples.find(
        (candidate) => candidate.id === exampleId,
      );
      if (exampleProject && example) {
        replaceActiveProject(exampleProject, DEFAULT_VIEWBOX, {
          rememberPrevious: false,
        });
        setStatus(`Opened example: ${example.name}`);
      }
    }
  }, [initialGalleryEntryId]);

  function resetInteractionState(): void {
    exitCellSymbolLayout();
    cancelAllTransientInteraction();
    resetSelection();
    setSelectedRouteSegmentIndex(null);
    clearTextEditing();
    setSelectedEndpoint(null);
  }

  function cancelAllTransientInteraction(): void {
    closeInsertDialogFromHook();
    clearCommandMoveSessionFromSelection();
    canvasDragSessionRef.current?.cancel();
    clearTransientCanvasState();
    paintSnapGuides([]);
    cancelInteraction();
    setBulkDrawInstanceId(null);
    setBoxPreview(null);
  }

  function selectEndpoint(candidate: WireSource): void {
    setSelectedEndpoint(candidate);
    if (candidate.endpoint.kind === "junction") {
      selectOnly("junction", [candidate.endpoint.junctionId]);
    } else {
      resetSelection();
    }
  }

  function switchDocument(nextDocumentId: string): void {
    if (nextDocumentId === document.id) return;
    documentViewBoxes.current.set(document.id, viewBox);
    const nextDocument = openDocument(nextDocumentId);
    if (!nextDocument) {
      setStatus(`Document not found: ${nextDocumentId}`);
      return;
    }
    setViewBox(
      documentViewBoxes.current.get(nextDocument.id) ?? DEFAULT_VIEWBOX,
      nextDocument.presentation.grid,
    );
    resetInteractionState();
    setStatus(`Opened Cell ${nextDocument.name}`);
  }

  function selectDocumentFromHierarchy(nextDocumentId: string): void {
    const paths = findHierarchyPaths(
      projectConnectivityIndex,
      project.topDocumentId,
      nextDocumentId,
    );
    setDocumentStack(paths?.length === 1 ? [...paths[0]!] : []);
    switchDocument(nextDocumentId);
    if (paths && paths.length > 1) {
      setStatus(
        `Opened shared Cell without caller context (${paths.length} instance paths)`,
      );
    }
  }

  function openInstanceFromTable(documentId: string, instanceId: string): void {
    const paths = findHierarchyPaths(
      projectConnectivityIndex,
      project.topDocumentId,
      documentId,
    );
    // A reused definition remains a single table row. Navigation still needs
    // one concrete caller context, so use the deterministic first valid path.
    setDocumentStack(paths?.[0] ? [...paths[0]] : []);
    switchDocument(documentId);
    selectOnly("instance", [instanceId]);
    setInstanceTableOpen(false);
    setStatus(
      paths && paths.length > 1
        ? `Opened ${documentId}.${instanceId} via one of ${paths.length} caller paths`
        : `Opened ${documentId}.${instanceId}`,
    );
  }

  function jumpToCaller(parentDocumentId: string, instanceId: string): void {
    const path = findHierarchyPath(
      projectConnectivityIndex,
      project.topDocumentId,
      parentDocumentId,
    );
    if (!path) {
      setStatus("Caller path could not be resolved");
      return;
    }
    setDocumentStack([...path]);
    switchDocument(parentDocumentId);
    selectOnly("instance", [instanceId]);
    setCellManagerOpen(false);
    setStatus(`Opened caller ${parentDocumentId}.${instanceId}`);
  }

  const cellManagerEntries = useMemo(
    () => summarizeProjectCells(project),
    [project],
  );

  function placeCellInstance(): void {
    if (cellInsertCandidates.length === 0) {
      setStatus("Create another Cell before placing a hierarchical Instance");
      return;
    }
    editorCommands.execute({
      id: "insert.start",
      launch: cellInsertLaunch(),
    });
    setStatus("Choose a Cell, then place it on the canvas");
  }

  const selectedFormalTerminal = selectedInstance
    ? document.netlist?.terminals.find((terminal) =>
        terminal.interfaceInstanceIds.includes(selectedInstance.id),
      )
    : undefined;
  // A design routinely carries VDDH and VDDL, or VDD1 and VDD2, at once, so a
  // supply marker keeps its explicit Global-Net name.
  const selectedSupplyMarker =
    selectedInstance?.symbolId === "vdd-port" ? selectedInstance : undefined;
  const selectedPortNet =
    selectedInstance && selectedInstance.symbolId === "vdd-port"
      ? document.nets.find((net) =>
          net.terminals.some(
            (terminal) => terminal.instanceId === selectedInstance.id,
          ),
        )
      : undefined;
  const selectedPortLogicalName = selectedPortNet
    ? resolveDocumentLogicalNets(document).byBaseNetId.get(selectedPortNet.id)
        ?.name
    : undefined;

  function commitProjectName(): void {
    setProjectNameDraft(null);
    renameProject(projectNameDraft);
  }

  function renameSelectedFormalPort(name: string): void {
    if (!selectedFormalTerminal) return;
    name = name.trim();
    if (!name || name === selectedFormalTerminal.name) return;
    renameCellTerminal(
      selectedFormalTerminal.id,
      name,
      document.id,
      "rename-cell-pin",
    );
  }

  function deleteSelectedFormalPort(): void {
    if (!selectedFormalTerminal || !selectedInstance) return;
    try {
      const edits = planRemoveCellTerminalMarkers(
        project,
        document.id,
        [selectedInstance.id],
        proposeConnectedInstanceDeletion(
          document,
          resolver,
          [selectedInstance.id],
          ++uniqueSuffixCounter.current,
        ),
      );
      if (commitStructure("delete-cell-pin", edits)) {
        resetSelection();
        setStatus(`Deleted Cell Pin ${selectedFormalTerminal.name}`);
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not delete port",
      );
    }
  }

  function deleteCurrentSelection(): void {
    const formalTerminals = (document.netlist?.terminals ?? []).filter(
      (terminal) =>
        terminal.interfaceInstanceIds.some((instanceId) =>
          visualSelection.instanceIds.includes(instanceId),
        ),
    );
    if (formalTerminals.length === 0) {
      deleteSelectionFromSelection();
      return;
    }
    const selectedFormalMarkerIds = formalTerminals.flatMap((terminal) =>
      terminal.interfaceInstanceIds.filter((instanceId) =>
        visualSelection.instanceIds.includes(instanceId),
      ),
    );
    try {
      const deletionEdits = proposeVisualSelectionDeletion(
        document,
        resolver,
        visualSelection,
        ++uniqueSuffixCounter.current,
      );
      if (selectedFormalMarkerIds.length > 0) {
        if (
          commitStructure(
            "delete-cell-pin-selection",
            planRemoveCellTerminalMarkers(
              project,
              document.id,
              selectedFormalMarkerIds,
              deletionEdits,
            ),
          )
        ) {
          resetSelection();
          setStatus("Deleted selected schematic objects");
        }
        return;
      }
      if (deletionEdits.length > 0 && transact(deletionEdits).ok) {
        resetSelection();
        setStatus("Deleted selected schematic objects");
        return;
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function navigateToLocator(
    locator: ObjectLocator,
    statusMessage: string,
  ): void {
    const targetDocument = project.documents.find(
      (candidate) => candidate.id === locator.documentId,
    );
    if (!targetDocument) {
      setStatus(`Document not found: ${locator.documentId}`);
      return;
    }
    const derivedPath = findHierarchyPath(
      projectConnectivityIndex,
      project.topDocumentId,
      locator.documentId,
    );
    const hierarchyPath =
      locator.hierarchyPath.length > 0
        ? locator.hierarchyPath
        : (derivedPath ?? []);
    documentViewBoxes.current.set(document.id, viewBox);
    const opened = openDocument(locator.documentId);
    if (!opened) {
      setStatus(`Document not found: ${locator.documentId}`);
      return;
    }
    setDocumentStack([...hierarchyPath]);
    setViewBox(
      documentViewBoxes.current.get(opened.id) ?? DEFAULT_VIEWBOX,
      opened.presentation.grid,
    );
    resetInteractionState();

    const focusPoint = (point: Point) =>
      setViewBox(
        {
          x: point.x - 80,
          y: point.y - 60,
          width: 160,
          height: 120,
        },
        opened.presentation.grid,
      );
    const endpoint =
      locator.kind === "terminal"
        ? locator.endpoint
        : locator.kind === "no-connect"
          ? opened.noConnects.find(
              (noConnect) => noConnect.id === locator.objectId,
            )?.endpoint
          : undefined;
    if (endpoint) {
      const connection = resolveEndpointConnection(opened, resolver, endpoint);
      if (connection) {
        setSelectedEndpoint({
          endpoint,
          netId: endpointNetId(opened, endpoint),
          connection,
          preludeEdits: [],
        });
        focusPoint(connection.contactPoint);
      }
    } else if (locator.kind === "instance") {
      const instance = opened.instances.find(
        (item) => item.id === locator.objectId,
      );
      selectOnly("instance", [locator.objectId]);
      if (instance?.placement) focusPoint(instance.placement.position);
    } else if (locator.kind === "route") {
      const route = opened.routes.find((item) => item.id === locator.objectId);
      selectOnly("route", [locator.objectId]);
      const centerline = route
        ? projectConnectivityIndex.documents
            .get(opened.id)
            ?.routingGeometry.routes.get(route.id)?.centerline
        : undefined;
      if (centerline?.[0]) focusPoint(centerline[0]);
    } else if (locator.kind === "junction") {
      const junction = opened.junctions.find(
        (item) => item.id === locator.objectId,
      );
      selectOnly("junction", [locator.objectId]);
      if (junction) focusPoint(junction.position);
    } else if (locator.kind === "annotation") {
      const annotation = opened.annotations.find(
        (item) => item.id === locator.objectId,
      );
      selectOnly("annotation", [locator.objectId]);
      const position =
        annotation?.anchor.kind === "free"
          ? annotation.anchor.position
          : annotation?.anchor.fallbackPosition;
      if (position) focusPoint(position);
    } else if (locator.kind === "net") {
      setHighlightedNetOrigin({
        documentId: opened.id,
        netId: locator.objectId,
        hierarchyPath: locator.hierarchyPath,
      });
      const route = opened.routes.find(
        (item) => item.netId === locator.objectId,
      );
      const centerline = route
        ? projectConnectivityIndex.documents
            .get(opened.id)
            ?.routingGeometry.routes.get(route.id)?.centerline
        : undefined;
      if (centerline?.[0]) focusPoint(centerline[0]);
    }
    setSelectionOpen(true);
    setStatus(statusMessage);
  }

  function navigateToNetlistDiagnostic(diagnostic: NetlistDiagnostic): void {
    navigateToLocator(diagnostic.primary, `Preflight: ${diagnostic.message}`);
    if (diagnostic.primary.kind !== "document") return;
    const target = project.documents.find(
      (candidate) => candidate.id === diagnostic.primary.documentId,
    );
    if (!target) return;
    setViewBox(
      fitCameraToBounds(
        buildSvgScene(target, resolver).viewBox,
        target.presentation.grid,
      ),
      target.presentation.grid,
    );
  }

  function applyAgentSemanticIntent(
    request: AgentHostSemanticIntentRequest,
  ): AgentHostSemanticIntentResult {
    const intent = request.intent;
    const targetDocument = project.documents.find(
      (candidate) => candidate.id === request.documentId,
    );
    if (!targetDocument) {
      return {
        ok: false,
        code: "DOCUMENT_NOT_FOUND",
        message: `Document ${request.documentId} is not present in this Project`,
      };
    }
    const activateDocument = (message: string) => {
      const hierarchyPath =
        findHierarchyPath(
          projectConnectivityIndex,
          project.topDocumentId,
          targetDocument.id,
        ) ?? [];
      navigateToLocator(
        {
          documentId: targetDocument.id,
          hierarchyPath,
          kind: "document",
          objectId: targetDocument.id,
        },
        message,
      );
    };
    const fail = (
      code: string,
      message: string,
    ): AgentHostSemanticIntentResult => ({
      ok: false,
      code,
      message,
    });

    switch (intent.kind) {
      case "activate-document":
        activateDocument(`Agent activated Cell ${targetDocument.name}`);
        return {
          ok: true,
          kind: intent.kind,
          documentId: targetDocument.id,
          objectIds: [],
        };
      case "fit-document": {
        activateDocument(`Agent fit Cell ${targetDocument.name}`);
        setViewBox(
          fitCameraToBounds(
            buildSvgScene(targetDocument, resolver).viewBox,
            targetDocument.presentation.grid,
          ),
          targetDocument.presentation.grid,
        );
        return {
          ok: true,
          kind: intent.kind,
          documentId: targetDocument.id,
          objectIds: [],
        };
      }
      case "clear-focus":
        resetInteractionState();
        setHighlightedNetOrigin(null);
        setSelectionOpen(false);
        setStatus("Agent cleared semantic focus");
        return {
          ok: true,
          kind: intent.kind,
          documentId: targetDocument.id,
          objectIds: [],
        };
      case "highlight-net": {
        const net = targetDocument.nets.find(
          (candidate) => candidate.id === intent.netId,
        );
        if (!net) {
          return fail(
            "OBJECT_NOT_FOUND",
            `Net ${intent.netId} is not present in Document ${targetDocument.id}`,
          );
        }
        activateDocument(
          `Agent highlighted Net ${resolveDocumentLogicalNets(targetDocument).byBaseNetId.get(net.id)?.name ?? net.id}`,
        );
        highlightNet(net.id, targetDocument.id, intent.endpoint);
        return {
          ok: true,
          kind: intent.kind,
          documentId: targetDocument.id,
          objectIds: [net.id],
          netId: net.id,
        };
      }
      case "select": {
        const { locator } = intent;
        if (locator.documentId !== targetDocument.id) {
          return fail(
            "DOCUMENT_MISMATCH",
            "A semantic locator must address the transaction Document",
          );
        }
        const expectedHierarchyPath = findHierarchyPath(
          projectConnectivityIndex,
          project.topDocumentId,
          targetDocument.id,
        );
        if (
          !expectedHierarchyPath ||
          expectedHierarchyPath.length !== locator.hierarchyPath.length ||
          expectedHierarchyPath.some(
            (frame, index) =>
              frame.parentDocumentId !==
                locator.hierarchyPath[index]?.parentDocumentId ||
              frame.instanceId !== locator.hierarchyPath[index]?.instanceId ||
              frame.childDocumentId !==
                locator.hierarchyPath[index]?.childDocumentId,
          )
        ) {
          return fail(
            "LOCATOR_MISMATCH",
            "The locator hierarchy path is not reachable from this Project top Cell",
          );
        }
        const exists = (() => {
          switch (locator.kind) {
            case "instance":
              return targetDocument.instances.some(
                (item) => item.id === locator.objectId,
              );
            case "net":
              return targetDocument.nets.some(
                (item) => item.id === locator.objectId,
              );
            case "route":
              return targetDocument.routes.some(
                (item) => item.id === locator.objectId,
              );
            case "junction":
              return targetDocument.junctions.some(
                (item) => item.id === locator.objectId,
              );
            case "annotation":
              return targetDocument.annotations.some(
                (item) => item.id === locator.objectId,
              );
            case "no-connect":
              return targetDocument.noConnects.some(
                (item) => item.id === locator.objectId,
              );
            case "terminal": {
              const endpoint = locator.endpoint;
              if (endpoint?.kind !== "terminal") return false;
              const instance = targetDocument.instances.find(
                (item) => item.id === endpoint.instanceId,
              );
              const resolved = instance
                ? resolver.resolve(instance.symbolId, instance.symbolVariantId)
                : null;
              return (
                resolved?.definition.pins.some(
                  (pin) => pin.name === endpoint.pinName,
                ) ?? false
              );
            }
          }
        })();
        if (!exists) {
          return fail(
            "OBJECT_NOT_FOUND",
            `Locator ${locator.kind} ${locator.objectId} is not present in Document ${targetDocument.id}`,
          );
        }
        const objectLocator: ObjectLocator = {
          documentId: locator.documentId,
          hierarchyPath: locator.hierarchyPath,
          kind: locator.kind,
          objectId: locator.objectId,
          ...(locator.endpoint ? { endpoint: locator.endpoint } : {}),
        };
        navigateToLocator(
          objectLocator,
          `Agent selected ${locator.kind} ${locator.objectId}`,
        );
        return {
          ok: true,
          kind: intent.kind,
          documentId: targetDocument.id,
          objectIds: [locator.objectId],
          ...(locator.kind === "net" ? { netId: locator.objectId } : {}),
        };
      }
    }
  }

  agentSemanticIntentRef.current = applyAgentSemanticIntent;

  function enterHierarchy(instanceId: string): void {
    const instance = document.instances.find(
      (candidate) => candidate.id === instanceId,
    );
    const targetId = instance ? referencedDocumentId(project, instance) : null;
    if (!targetId) {
      setStatus(`${instanceId} has no child Cell`);
      return;
    }
    setDocumentStack((current) => [
      ...current,
      {
        parentDocumentId: document.id,
        instanceId,
        childDocumentId: targetId,
      },
    ]);
    switchDocument(targetId);
  }

  function enterSelectedHierarchy(): void {
    if (
      selectedInstance &&
      referencedDocumentId(project, selectedInstance) !== null
    ) {
      enterHierarchy(selectedInstance.id);
      return;
    }
    if (selectedDrafting?.kind !== "rectangle") {
      setStatus(
        "Select a rectangle or hierarchical block before entering a Cell",
      );
      return;
    }
    try {
      const converted = convertRectangleToHierarchy(
        project,
        document.id,
        selectedDrafting.id,
      );
      commitProjectStructure(converted.project, document.id);
      setDocumentStack((current) => [
        ...current,
        {
          parentDocumentId: converted.parentDocumentId,
          instanceId: converted.instanceId,
          childDocumentId: converted.childDocumentId,
        },
      ]);
      switchDocument(converted.childDocumentId);
      setStatus(`Created and entered Cell ${converted.cellName}`);
    } catch (error) {
      setStatus(
        `Could not create Cell: ${
          error instanceof Error ? error.message : "unexpected failure"
        }`,
      );
    }
  }

  function returnToParentDocument(): void {
    const frame = documentStack.at(-1);
    if (!frame) return;
    setDocumentStack((current) => current.slice(0, -1));
    switchDocument(frame.parentDocumentId);
  }

  function returnToTopDocument(): void {
    setDocumentStack([]);
    switchDocument(project.topDocumentId);
  }

  function approveAgentFileCandidate(): void {
    if (!agentFileCandidate) return;
    const meta = agentFileCandidate;
    void guardDirtyReplacement(`Accept Agent ${meta.kind} candidate`, () => {
      const candidate = browserAgentFileHost.consumeApproved(meta.candidateId);
      setAgentFileCandidate(null);
      if (!candidate) {
        setStatus(
          "Agent file candidate expired; ask the Agent to stage it again",
        );
        return;
      }
      replaceActiveProject(candidate, DEFAULT_VIEWBOX, {
        source: "opened-file",
      });
      setStatus(`Accepted Agent ${meta.kind} candidate: ${candidate.name}`);
    });
  }

  function rejectAgentFileCandidate(): void {
    if (!agentFileCandidate) return;
    browserAgentFileHost.discard(agentFileCandidate.candidateId);
    setAgentFileCandidate(null);
    setStatus("Rejected Agent file candidate");
  }

  function jumpToProjectDiagnostic(diagnostic: Diagnostic): void {
    navigateToLocator(
      diagnostic.primary,
      `${diagnostic.domain.toUpperCase()} ${diagnostic.code}: ${diagnostic.message}`,
    );
  }

  const clearDrawingPlan = planCellReset(project, document.id, "clear-drawing");
  const resetPlacementPlan = planCellReset(
    project,
    document.id,
    "reset-placement",
  );
  const resetBodyPlan = planCellReset(project, document.id, "reset-body");

  function commitCellReset(plan: CellResetPlan, command: string): void {
    if (plan.edits.length === 0) {
      setStatus(command + " has nothing to change in Cell " + document.name);
      return;
    }
    setPendingCellReset({ plan, command });
  }

  function confirmClearCanvas(): void {
    if (!pendingCellReset) return;
    const { plan, command } = pendingCellReset;
    const result = transact([...plan.edits]);
    if (!result.ok) return;
    setPendingCellReset(null);
    resetInteractionState();
    setStatus(
      command + " completed in Cell " + document.name + " · Undo restores it",
    );
  }

  function cancelClearCanvas(): void {
    const command = pendingCellReset?.command ?? "Cell reset";
    setPendingCellReset(null);
    setStatus(command + " cancelled");
  }

  function updateMosBulkDefault(
    kind: "nmos" | "pmos",
    netId: string | null,
  ): void {
    const result = transact([
      ...planMosBulkDefaultUpdate(document, kind, netId),
    ]);
    if (!result.ok) return;
    setStatus(
      `${kind === "nmos" ? "NMOS" : "PMOS"} bulk default ${
        netId ? "updated" : "cleared"
      }`,
    );
  }

  function nextRoutingSuffix(): number {
    routeCounter.current =
      Math.max(routeCounter.current, maxRoutingCounter(document)) + 1;
    return routeCounter.current;
  }

  function activateTool(nextTool: EditorTool): void {
    const currentInteraction = getCurrentInteractionState();
    const alreadyActive =
      (nextTool === "wire" && currentInteraction.kind === "wire") ||
      (currentInteraction.kind === "drawing" &&
        currentInteraction.tool === nextTool) ||
      (nextTool === "pointer" && currentInteraction.kind === "idle");
    if (alreadyActive) return;
    exitCellSymbolLayout();
    if (currentInteraction.kind === "moving-selection") {
      clearCommandMoveSessionFromSelection();
    }
    canvasDragSessionRef.current?.cancel();
    clearTransientCanvasState();
    paintSnapGuides([]);
    setTool(nextTool);
    if (nextTool !== "pointer") {
      resetSelection();
      setSelectedEndpoint(null);
      setSelectedRouteSegmentIndex(null);
    }
    setStatus(
      nextTool === "wire"
        ? "Wire: choose a pin, junction, route segment, or blank grid point"
        : nextTool === "rectangle"
          ? "Rectangle: click the first corner"
          : nextTool === "arrow"
            ? "Arrow: click the start point"
            : nextTool === "construction-line"
              ? "Construction line: click the start point"
              : "Pointer ready",
    );
  }

  function rotatePendingCopy(delta: 90 | -90): void {
    if (!copyPlacement) return;
    rotateCopyPlacement(delta);
    setStatus("Place rotated copy · R rotates · Esc cancels");
  }

  function mirrorPendingCopy(direction: ScreenFlip): void {
    if (!copyPlacement) return;
    mirrorCopyPlacement(direction);
    setStatus(
      `Place copy mirrored ${direction === "left-right" ? "left/right" : "top/bottom"} · R rotates · Esc cancels`,
    );
  }

  function routeAnchor(
    routeId: string,
    point: Point,
    segmentIndex: number,
  ): WireSource {
    const route = document.routes.find(
      (candidate) => candidate.id === routeId,
    )!;
    const suffix = nextRoutingSuffix();
    // Route taps are persisted geometry. Snap the projected screen hit back to
    // the document grid before splitRoute validates it, avoiding sub-pixel SVG
    // transform residue at an otherwise exact corner.
    return createRouteWireAnchor(
      document,
      route,
      point,
      segmentIndex,
      document.presentation.grid,
      suffix,
    );
  }

  function handleRoutePointerDown(
    event: ReactPointerEvent<SVGElement>,
    routeId: string,
    hitTarget: SVGElement = event.currentTarget,
  ): void {
    if (vddRailMode || (pendingSymbolId && pendingComponentPlacement)) return;
    if (
      getCurrentInteractionState().kind === "moving-selection" &&
      selectedIds.length > 0
    ) {
      const primaryInstanceId = selectedIds.at(-1);
      if (primaryInstanceId)
        beginMoveFromSelection(event, primaryInstanceId, hitTarget);
      return;
    }
    if (tool !== "pointer") {
      handleWireRoutePointerDown(event, routeId, hitTarget);
      return;
    }
    event.stopPropagation();
    if (event.altKey) {
      setStatus("Snap suppressed while Alt is held");
      return;
    }
    const routeRecord = routeGeometryRecords.find(
      (candidate) => candidate.route.id === routeId,
    );
    if (!routeRecord) return;
    const svg = (hitTarget.ownerSVGElement ?? hitTarget) as SVGSVGElement;
    const pointer = pointFromClient(event.clientX, event.clientY, svg, false);
    const tap = resolveRouteTap(
      routeRecord.geometry,
      pointer,
      logicalRadiusForPixels(svg, 7),
    );
    const segmentIndex = tap?.address.segmentIndex ?? 0;
    if (getCurrentInteractionState().kind === "moving-selection") {
      const movePlan = planSelectionMove(document, visualSelection);
      if (movePlan.previewObjectIds.length > 0) {
        beginVisualSelectionMoveFromSelection(
          event,
          visualSelection,
          hitTarget,
        );
        return;
      }
      cancelInteraction();
    }
    selectRoute(routeId, segmentIndex);
    beginRouteStretch(
      event,
      routeId,
      segmentIndex,
      routeRecord.route.presentation === "power-rail"
        ? "move-power-rail"
        : looseRouteAnchorIds(document, routeRecord.route) !== null
          ? "move-loose-route"
          : "stretch-segment",
      hitTarget,
    );
  }

  function beginAnnotationDrag(
    event: ReactPointerEvent<SVGElement>,
    annotation: Annotation,
    hitTarget: SVGElement = event.currentTarget,
  ): void {
    if (event.button !== 0) return;
    if (getCurrentInteractionState().kind === "moving-selection") {
      const primaryInstanceId = selectedIds.at(-1);
      if (primaryInstanceId)
        beginMoveFromSelection(event, primaryInstanceId, hitTarget);
      else
        beginVisualSelectionMoveFromSelection(
          event,
          visualSelection,
          hitTarget,
        );
      return;
    }
    event.stopPropagation();
    selectOnly("annotation", [annotation.id]);
    setSelectedEndpoint(null);
    if (annotation.locked) {
      setStatus("Selected locked annotation");
      return;
    }
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      setStatus(`Selected annotation ${annotation.id}`);
      return;
    }
    canvasDragSessionRef.current?.cancel();
    const svg = hitTarget.ownerSVGElement!;
    const pointerStart = pointFromClient(
      event.clientX,
      event.clientY,
      svg,
      false,
    );
    const currentAttachment = effectiveRouteAttachment(annotation);
    const record = currentAttachment
      ? routeGeometryRecords.find(
          ({ route }) => route.id === currentAttachment.routeId,
        )
      : undefined;
    const markerPlacement =
      record && currentAttachment
        ? resolveRouteAttachment(record.geometry, currentAttachment)
        : null;
    const preview: AnnotationDragPreview = {
      annotationId: annotation.id,
      originalPosition: {
        ...(isRoutedMarker(annotation) && markerPlacement
          ? markerPlacement.labelPoint
          : annotation.anchor.kind === "free"
            ? annotation.anchor.position
            : annotation.anchor.fallbackPosition),
      },
      pointerStart,
    };
    let visual: ReturnType<typeof startCanvasDragVisual> | null = null;
    const dragVisual = () =>
      (visual ??= startCanvasDragVisual(svg, [annotation.id]));
    const positionAt = (clientX: number, clientY: number): DerivedPoint => {
      const pointer = pointFromClient(clientX, clientY, svg, false);
      return {
        x: preview.originalPosition.x + pointer.x - preview.pointerStart.x,
        y: preview.originalPosition.y + pointer.y - preview.pointerStart.y,
      };
    };
    canvasDragSessionRef.current = startCanvasDragSession({
      target: hitTarget,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: DRAG_START_DISTANCE_PX,
      onPreview: (client) => {
        const position = positionAt(client.x, client.y);
        // Route-attached current markers used to preview by replacing their
        // annotation in `renderedDocument`. That invalidated and rebuilt the
        // whole formal SVG scene once per pointer frame. A marker is one
        // indivisible visual object, so a lightweight temporary translation is
        // sufficient during the gesture; the exact route attachment is still
        // resolved and persisted once on pointer release below.
        dragVisual().translate({
          x: position.x - preview.originalPosition.x,
          y: position.y - preview.originalPosition.y,
        });
      },
      onFinish: ({ client, dragged }) => {
        canvasDragSessionRef.current = null;
        visual?.restore();
        if (dragged) {
          completeAnnotationDrag(preview, positionAt(client.x, client.y));
        }
      },
      onCancel: () => {
        canvasDragSessionRef.current = null;
        visual?.restore();
      },
    });
  }

  function completeAnnotationDrag(
    preview: AnnotationDragPreview,
    position: DerivedPoint,
  ): void {
    const annotation = document.annotations.find(
      (candidate) => candidate.id === preview.annotationId,
    );
    if (!annotation) return;
    transact([
      {
        kind: "upsert_schematic_annotation",
        annotation: draggedAnnotationAtPosition(
          { document, resolver, routeGeometryRecords },
          annotation,
          snapGridPoint(position, document.presentation.grid),
        ),
      },
    ]);
  }

  function pointFromClient(
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
    snapToGrid?: true,
  ): Point;
  function pointFromClient(
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
    snapToGrid: false,
  ): DerivedPoint;
  function pointFromClient(
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
    snapToGrid = true,
  ): DerivedPoint {
    return canvasPointFromClient(
      clientX,
      clientY,
      svg,
      viewBox,
      document.presentation.grid,
      snapToGrid,
    );
  }

  function logicalRadiusForPixels(svg: SVGSVGElement, pixels: number): number {
    return logicalRadiusForCanvasPixels(svg, pixels);
  }

  function paintSnapGuides(guides: readonly SnapGuideLine[]): void {
    replaceCanvasSnapGuides(snapGuideLayerRef.current, guides);
  }

  /**
   * Editor-only visual state must never outlive the interaction that produced
   * it. In particular, Smart Snap guides are imperative SVG children so React
   * does not remove them when a document or tool state changes underneath a
   * pointer session.
   */
  function clearTransientCanvasState(): void {
    canvasDragSessionRef.current?.cancel();
    canvasDragSessionRef.current = null;
    paintSnapGuides([]);
  }

  useEffect(() => {
    const cancelWhenHidden = () => {
      if (globalThis.document.visibilityState === "hidden") {
        clearTransientCanvasState();
      }
    };
    const cancelOnPageHide = () => clearTransientCanvasState();
    globalThis.document.addEventListener("visibilitychange", cancelWhenHidden);
    globalThis.window.addEventListener("pagehide", cancelOnPageHide);
    return () => {
      globalThis.document.removeEventListener(
        "visibilitychange",
        cancelWhenHidden,
      );
      globalThis.window.removeEventListener("pagehide", cancelOnPageHide);
      clearTransientCanvasState();
    };
  }, []);

  function resolveWireCanvasSnap(
    point: Point,
    svg: SVGSVGElement,
    suppressSnap: boolean,
  ) {
    return resolveWireCanvasSnapModel(
      {
        document,
        resolver,
        wiringEndpoints,
        routeGeometryRecords,
        contactComponents,
        wireSource,
        wireWaypoints,
        captureTolerance: logicalRadiusForPixels(svg, SNAP_CAPTURE_RADIUS_PX),
      },
      point,
      suppressSnap,
    );
  }

  /**
   * One middle-click steps the corner through the shapes a wire actually
   * turns with: horizontal-first, vertical-first, then the 45° diagonal. The
   * click used to reach only the diagonal, so the two orthogonal elbows were
   * unreachable without the Corner menu.
   */
  // Re-arm the remembered corner shape on a fresh wire. Activating the wire
  // tool builds a clean state, which dropped the choice; this restores it
  // without touching a wire already in progress.
  useEffect(() => {
    if (tool !== "wire" || wireSource !== null || wireDraftSteps.length > 0)
      return;
    const remembered = lastWireShapeRef.current;
    if (remembered.routingMode !== wireRoutingMode)
      setWireRoutingMode(remembered.routingMode);
    if (remembered.cornerOrder !== wireCornerOrder)
      setWireCornerOrder(remembered.cornerOrder);
  }, [
    tool,
    wireSource,
    wireDraftSteps.length,
    wireRoutingMode,
    wireCornerOrder,
    setWireRoutingMode,
    setWireCornerOrder,
  ]);

  function cycleWireCornerShape(): void {
    // "auto" is where every wire starts, so it has to be a named stop on the
    // cycle: leaving it out made findIndex return -1 and the first press land
    // on entry 0. That press was also invisible, because a first leg drawn by
    // "auto" already runs horizontal — hence vertical first comes next, so
    // every press visibly redraws the preview.
    const shapes = [
      {
        routingMode: "orthogonal" as const,
        cornerOrder: "auto" as const,
        label: "auto",
      },
      {
        routingMode: "orthogonal" as const,
        cornerOrder: "vertical-first" as const,
        label: "vertical first",
      },
      {
        routingMode: "orthogonal" as const,
        cornerOrder: "horizontal-first" as const,
        label: "horizontal first",
      },
      {
        routingMode: "octilinear" as const,
        cornerOrder: "diagonal-first" as const,
        label: "45° diagonal",
      },
      {
        routingMode: "free" as const,
        cornerOrder: "auto" as const,
        label: "any angle",
      },
    ];
    const index = shapes.findIndex(
      (shape) =>
        shape.routingMode === wireRoutingMode &&
        shape.cornerOrder === wireCornerOrder,
    );
    const next = shapes[(index + 1) % shapes.length]!;
    lastWireShapeRef.current = next;
    if (next.routingMode !== wireRoutingMode)
      setWireRoutingMode(next.routingMode);
    setWireCornerOrder(next.cornerOrder);
    setStatus(`Wire corner: ${next.label}`);
  }

  function applyWireCanvasPoint(
    rawPoint: Point,
    svg: SVGSVGElement,
    suppressSnap: boolean,
    finish: boolean,
  ): void {
    const resolved = resolveWireCanvasSnap(rawPoint, svg, suppressSnap);
    paintSnapGuides([]);
    // A double-click ends the wire and never begins one. Landing on an
    // endpoint or an existing Route already commits on the first click, so
    // without this the finishing gesture started a fresh wire at that point
    // and drawing appeared to continue.
    if (finish && !wireSource) return;
    if (resolved.ambiguous) {
      setStatus(
        "Ambiguous connection: choose one endpoint or conductor away from the overlap",
      );
      return;
    }
    if (resolved.endpoint) {
      if (!wireSource) {
        setWireSource(resolved.endpoint, document.revision);
        setWirePreviewPoint(resolved.endpoint.connection.contactPoint);
        setWireDraftSteps([]);
      } else if (
        endpointKey(wireSource.endpoint) !==
        endpointKey(resolved.endpoint.endpoint)
      ) {
        commitWire(resolved.endpoint);
      } else {
        setStatus("Choose a different endpoint");
      }
      return;
    }
    if (resolved.route) {
      const anchor = routeAnchor(
        resolved.route.routeId,
        resolved.route.point,
        resolved.route.segmentIndex,
      );
      if (!wireSource) {
        setWireSource(anchor, document.revision);
        setWirePreviewPoint(anchor.connection.contactPoint);
        setWireDraftSteps([]);
      } else {
        commitWire(anchor);
      }
      return;
    }
    if (finish) finishWireAtPoint(resolved.point);
    else fixWirePoint(resolved.point);
  }

  function handleCanvasHitPointerDown(
    event: ReactPointerEvent<SVGSVGElement>,
  ): void {
    if (
      (pendingSymbolId && pendingComponentPlacement) ||
      vddRailMode ||
      copyPlacement !== null
    ) {
      return;
    }
    if (getCurrentInteractionState().kind === "moving-selection") {
      const primaryInstanceId = selectedIds.at(-1);
      if (primaryInstanceId) {
        beginMoveFromSelection(event, primaryInstanceId, event.currentTarget);
      } else {
        beginVisualSelectionMoveFromSelection(
          event,
          visualSelection,
          event.currentTarget,
        );
      }
      return;
    }
    if (tool !== "pointer" || event.button !== 0) return;
    if (
      cellSymbolLayoutEnabled &&
      (event.target as Element).closest(
        '[data-testid="cell-symbol-layout-overlay"]',
      )
    ) {
      // The canvas capture layer ranks the underlying scene through
      // elementsFromPoint(). Layout grips intentionally outrank that scene so
      // a selected hierarchy instance cannot start an ordinary move first.
      return;
    }
    // Handles outrank the scene they sit on, the same way layout grips do.
    // Testing only event.target missed a handle drawn under another hit
    // surface — a Power Rail end handle sits beneath its Junction's endpoint
    // circle — so this capture layer claimed the press and the rail moved
    // instead of resizing. Rank the whole stack at the point instead.
    const handleAtPoint = event.currentTarget.ownerDocument
      .elementsFromPoint(event.clientX, event.clientY)
      .some((element) => element.closest(".draft-handle, .route-handle"));
    if (handleAtPoint) return;
    const hit = resolveCanvasHitAtPoint(
      event.currentTarget.ownerDocument,
      { x: event.clientX, y: event.clientY },
      event.altKey ? 1 : 0,
    );
    if (!hit || hit.kind === "handle") return;
    const hitTarget = hit.element as SVGElement;
    event.preventDefault();
    event.stopPropagation();

    if (
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (hit.kind === "instance" ||
        hit.kind === "instance-label" ||
        hit.kind === "annotation" ||
        hit.kind === "route" ||
        hit.kind === "junction") &&
      compositeSelectionOwnsHit(hit.kind, hit.id)
    ) {
      const primaryInstanceId = selectedIds.at(-1);
      if (primaryInstanceId) {
        beginMoveFromSelection(event, primaryInstanceId, hitTarget);
        return;
      }
      // A marquee can hold only Routes, Junctions, and Annotations. Without an
      // Instance to anchor the move, the press used to fall through to the
      // single-object branches below and drag just the grabbed object out of
      // its own selection.
      const movePlan = planSelectionMove(document, visualSelection);
      if (movePlan.previewObjectIds.length > 0) {
        beginVisualSelectionMoveFromSelection(
          event,
          visualSelection,
          hitTarget,
        );
        return;
      }
    }

    if (hit.kind === "instance") {
      beginMoveFromSelection(event, hit.id, hitTarget);
      return;
    }
    if (hit.kind === "annotation") {
      const annotation = document.annotations.find(
        (candidate) => candidate.id === hit.id,
      );
      if (annotation) beginAnnotationDrag(event, annotation, hitTarget);
      return;
    }
    if (hit.kind === "route") {
      handleRoutePointerDown(event, hit.id, hitTarget);
      return;
    }
    if (hit.kind === "drafting") {
      const object = document.drafting?.objects.find(
        (candidate) => candidate.id === hit.id,
      );
      if (object) beginDraftingDrag(event, object, hitTarget);
      return;
    }
    const endpoint = visibleEndpoints.find(
      (candidate) =>
        candidate.endpoint.kind === "junction" &&
        candidate.endpoint.junctionId === hit.id,
    );
    if (endpoint) {
      selectEndpoint(endpoint);
      setStatus(`Selected ${endpointTestId(endpoint.endpoint)}`);
    }
  }

  function handleDrop(event: DragEvent<SVGSVGElement>): void {
    event.preventDefault();
    const instanceId = event.dataTransfer.getData("application/x-icm-instance");
    if (!instanceId) {
      return;
    }
    const placement = {
      position: pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget,
      ),
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
      {
        kind: "place_instance",
        instanceId,
        placement,
      },
      ...displayAnnotations.map((annotation) => ({
        kind: "upsert_schematic_annotation" as const,
        annotation,
      })),
    ]);
    selectOnly("instance", [instanceId]);
  }

  function placeAllFromTray(): void {
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
  }

  function returnInstancesToTray(instanceIds: readonly string[]): void {
    if (instanceIds.length === 0) {
      setStatus("There are no returnable placed Instances");
      return;
    }
    try {
      const edits = planInstanceUnplacement(
        document,
        resolver,
        instanceIds,
        ++uniqueSuffixCounter.current,
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
  }

  const editorCommands = createEditorCommandRouter({
    getContext: () => ({
      interactionMode: getCurrentInteractionState().kind,
      activeTool: tool,
      hasDeletableSelection:
        hasVisualSelection(visualSelection) || selectedEndpoint !== null,
      hasMoveSelection: canBeginKeyboardSelectionMove(),
      hasRotatableSelection,
      hasMirrorableSelection,
      canTransformMove: canTransformCommandMove(),
      hasInspectableSelection,
      propertiesOpen: selectionOpen,
      canUndo,
      canRedo,
      helpOpen,
      canvasDragActive: canvasDragSessionRef.current !== null,
      hasClearableDraftingSelection:
        selectedDrafting?.kind === "arrow" ||
        selectedDrafting?.kind === "construction-line" ||
        selectedDrafting?.kind === "rectangle",
    }),
    operations: {
      closeHelp,
      cancelCanvasDrag: () => {
        canvasDragSessionRef.current?.cancel();
        setStatus("Cancelled canvas drag");
      },
      cancelInteraction: (interactionMode) => {
        cancelAllTransientInteraction();
        setStatus(
          interactionMode === "copy-placement"
            ? "Copy placement cancelled"
            : interactionMode === "placing-vdd-rail"
              ? "Power Rail cancelled"
              : interactionMode === "placing-component"
                ? "Component placement cancelled"
                : interactionMode === "drawing"
                  ? "Drawing cancelled"
                  : "Cancelled active tool",
        );
      },
      clearDraftingSelection: () => {
        replaceSelectionKind("drafting", []);
        setStatus("Cleared drawing selection");
      },
      cancelPassive: () => {
        setBoxPreview(null);
        paintSnapGuides([]);
        setStatus("Cancelled");
      },
      undo: () => {
        transact([{ kind: "undo" }]);
      },
      redo: () => {
        transact([{ kind: "redo" }]);
      },
      selectAll: selectAllObjects,
      clearSelection: clearEditorSelection,
      deleteSelection: deleteCurrentSelection,
      beginCopy: beginCopyPlacementFromSelection,
      beginMove: beginKeyboardSelectionMoveFromSelection,
      rotatePlacement: rotatePendingComponentFromHook,
      rotateCopy: rotatePendingCopy,
      rotateMove: rotateCommandMoveFromSelection,
      rotateSelection: rotateSelected,
      mirrorPlacement: mirrorPendingComponentFromHook,
      mirrorCopy: mirrorPendingCopy,
      mirrorMove: mirrorCommandMoveFromSelection,
      mirrorSelection: mirrorSelected,
      startInsert: startInsertFromHook,
      openInsert: () => startInsertFromHook(fullInsertLaunch()),
      placeCellPin: () => {
        const request = quickPlaceRequest(
          document.presentation.styleProfileId,
          "port",
        );
        if (request) startInsertFromHook({ kind: "quick", request });
      },
      activateTool,
      addText: addPlainText,
      openProperties,
      closeProperties,
      fitView,
      report: setStatus,
    },
  });

  // Single entry point for selecting a drafting object. Editing is opened
  // separately (double-click/Enter) so selection and text caret ownership do
  // not fight drag gestures.
  function selectDraftingObject(id: string): void {
    selectOnly("drafting", [id]);
    setDraftingInspectorSegment(null);
    setDraftingTangentInput(null);
    setDraftingBearingInput(null);
  }

  function referenceLabelVisibilityEdits(
    instanceIds: readonly string[],
    visible: boolean,
  ): SchematicEdit[] {
    const edits: SchematicEdit[] = [];
    for (const instanceId of instanceIds) {
      const instance = document.instances.find(
        (item) => item.id === instanceId,
      );
      if (!instance) continue;
      const label = instanceLabelAnnotationFor(document, instanceId);
      if (label) {
        const { visible: _currentVisibility, ...rest } = label;
        edits.push({
          kind: "upsert_schematic_annotation",
          annotation: visible ? rest : { ...rest, visible: false },
        });
      } else if (visible) {
        const created = defaultInstanceLabel(
          document,
          instance,
          resolver,
          styleProfile,
        );
        if (created) {
          edits.push({
            kind: "upsert_schematic_annotation",
            annotation: created,
          });
        }
      }
    }
    return edits;
  }

  function valueVisibilityEdits(
    source: SchematicDocument,
    instanceIds: readonly string[],
    visible: boolean,
  ): SchematicEdit[] {
    const edits: SchematicEdit[] = [];
    for (const instanceId of instanceIds) {
      const instance = source.instances.find((item) => item.id === instanceId);
      if (!instance) continue;
      const value = instanceValueAnnotation(source, instanceId);
      if (value) {
        const { visible: _currentVisibility, ...rest } = value;
        if (visible) {
          edits.push({
            kind: "upsert_schematic_annotation",
            annotation: rest,
          });
        } else {
          edits.push({
            kind: "upsert_schematic_annotation",
            annotation: { ...rest, visible: false },
          });
        }
      } else if (visible) {
        const created = defaultInstanceValue(
          source,
          instance,
          resolver,
          styleProfile,
        );
        if (created) {
          edits.push({
            kind: "upsert_schematic_annotation",
            annotation: created,
          });
        }
      }
    }
    return edits;
  }

  function updateSelectedModelTarget(value: string): void {
    if (!selectedInstance?.netlist) return;
    if (
      selectedPropertyDevice?.symbolId === "nmos" ||
      selectedPropertyDevice?.symbolId === "pmos"
    ) {
      try {
        const edits = planSetMosModelTarget(
          project,
          document.id,
          selectedInstance.id,
          value,
        );
        if (edits.length === 0) return;
        if (commitStructure("set-mos-model-target", edits)) {
          const target = value.trim();
          const mapping = target
            ? resolvePdkSymbolMapping(target, 4)
            : undefined;
          setStatus(
            mapping
              ? `Set external X target ${target}`
              : target
                ? `Set model target ${target}`
                : `Cleared model target for ${selectedInstance.id}`,
          );
        }
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : "Could not set MOS model target",
        );
      }
      return;
    }
    const binding = bindingForEditedModel(selectedInstance.symbolId, value);
    const nextBinding = binding ?? null;
    const currentBinding = selectedInstance.netlist.binding ?? null;
    if (JSON.stringify(nextBinding) === JSON.stringify(currentBinding)) return;
    if (
      transact([
        {
          kind: "set_instance_binding",
          instanceId: selectedInstance.id,
          binding: nextBinding,
        },
      ]).ok
    ) {
      setStatus(
        nextBinding?.kind === "model"
          ? `Set model target ${nextBinding.name}`
          : `Cleared model target for ${selectedInstance.id}`,
      );
    }
  }

  function updateSelectedSchematicName(value: string): void {
    if (!selectedInstance) return;
    const content = defaultDraftTextDocument(value.trim());
    if (
      JSON.stringify(selectedInstance.schematicName ?? null) ===
      JSON.stringify(content)
    ) {
      return;
    }
    if (
      transact([
        {
          kind: "set_instance_schematic_name",
          instanceId: selectedInstance.id,
          content,
        },
      ]).ok
    ) {
      setStatus(`Renamed schematic label to ${value.trim()}`);
    }
  }

  function updateSelectedReference(value: string): void {
    if (!selectedInstance?.netlist) return;
    const reference = value.trim();
    if (!reference) {
      setStatus("Netlist reference cannot be empty");
      return;
    }
    if (reference === selectedInstance.netlist.reference) return;
    if (
      transact([
        {
          kind: "set_instance_reference",
          instanceId: selectedInstance.id,
          reference,
        },
      ]).ok
    ) {
      setStatus(`Set netlist reference to ${reference}`);
    }
  }

  /*
   * Text sessions use one persistence proposal for both annotation and
   * drafting owners. The tagged target keeps their typed edit differences at
   * the boundary rather than branching through the floating editor lifecycle.
   */
  function deleteSelectedAnnotation(): void {
    if (!selectedAnnotation) return;
    const result = transact([
      {
        kind: "remove_schematic_annotation",
        annotationId: selectedAnnotation.id,
      },
    ]);
    if (result.ok) replaceSelectionKind("annotation", []);
  }

  function reverseSelectedCurrentArrow(): void {
    if (!selectedAnnotation || !isRoutedMarker(selectedAnnotation)) {
      return;
    }
    const attachment = effectiveRouteAttachment(selectedAnnotation);
    if (!attachment) return;
    const direction: "forward" | "reverse" =
      attachment.direction === "forward" ? "reverse" : "forward";
    // A route-marker stores direction on its route VisualAnchor.
    const anchor =
      selectedAnnotation.kind === "route-marker" &&
      selectedAnnotation.anchor.kind === "route"
        ? { ...selectedAnnotation.anchor, direction }
        : selectedAnnotation.anchor;
    const result = transact([
      {
        kind: "upsert_schematic_annotation",
        annotation: {
          ...selectedAnnotation,
          anchor,
        },
      },
    ]);
    if (result.ok) setStatus(`Current arrow points ${direction}`);
  }

  function exportSvg(): void {
    const artifact = createSvgExportArtifact(document, resolver, project.name);
    requestBrowserDownload(artifact, project.name);
    void reportExport(artifact.report);
  }

  /**
   * Settle the loose ends and shelve the circuit.
   *
   * This deliberately does not run the design-netlist analysis. That analysis
   * answers "can this be emitted as SPICE?", which is a question about an
   * export, not about a drawing — a schematic is allowed to be abbreviated
   * and idealised. An ideal switch, an amplifier drawn as a triangle, a
   * resistor with no value yet: none of those is a mistake, and calling them
   * blocking issues on the way to saving would be the tool telling the author
   * their drawing is wrong when it is not. The Check Report is still one
   * click away under Netlist, and export still gates on it, which is where
   * that question belongs.
   *
   * What it does settle is MOS bodies, because an unstated body is a loose
   * end rather than a legitimate abbreviation, and the author asked for it.
   */
  async function checkAndSave(): Promise<void> {
    const bulkPlan = planCheckBulkDefaults(document);
    const settledBodies = bulkPlan.edits.length > 0;
    if (settledBodies) transact([...bulkPlan.edits]);
    const ambiguousSides = [
      bulkPlan.ambiguous.nmos ? "NMOS" : null,
      bulkPlan.ambiguous.pmos ? "PMOS" : null,
    ].filter((side): side is string => side !== null);

    const notes = [
      settledBodies ? "bound the unwired MOS bodies" : null,
      ambiguousSides.length > 0
        ? `${ambiguousSides.join(" and ")} bodies need a supply chosen`
        : null,
    ].filter((note): note is string => note !== null);
    const prefix = notes.length > 0 ? `${notes.join("; ")} — ` : "";

    if (!publishSession) {
      setStatus(`${prefix}sign in to keep a copy on your shelf`);
      return;
    }
    const outcome = await saveToWorkspaceShelf(
      editorDocumentController.project,
    );
    if (outcome.status === "saved") {
      setWorkspaceSlots(outcome.slots);
      setStatus(
        `${prefix}saved "${editorDocumentController.project.name}" to your shelf`,
      );
      return;
    }
    setStatus(
      outcome.status === "signed-out"
        ? `${prefix}sign in again to keep a copy on your shelf`
        : outcome.status === "too-large"
          ? `${prefix}the circuit is too large for the shelf`
          : `${prefix}the shelf could not be reached (${outcome.message})`,
    );
  }

  function exportDesignNetlist(
    format: NetlistFormat,
    warningsReviewed = false,
  ): void {
    const plan = planDesignNetlistExport({
      format,
      ir: netlistAnalysis.ir,
      warningsPresent:
        netlistAnalysis.diagnostics.length > 0 ||
        electricalDiagnostics.length > 0,
      warningsReviewed,
      projectName: project.name,
    });
    if (plan.status === "blocked") {
      setNetlistPreflightOpen(true);
      setStatus(plan.message);
      return;
    }
    requestBrowserDownload(plan.artifact, project.name);
    void reportExport(plan.artifact.report);
  }

  async function exportRaster(format: "png" | "pdf"): Promise<void> {
    setStatus(`Preparing ${format.toUpperCase()} export`);
    try {
      const artifact = await createRasterExportArtifact(
        format,
        document,
        resolver,
        project.name,
      );
      requestBrowserDownload(artifact, project.name);
      await reportExport(artifact.report);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    }
  }

  async function importSpiceFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) {
      return;
    }
    const selectedFiles = [...files];
    const sourceInputs = await Promise.all(
      selectedFiles.map(async (file) => ({
        path: file.webkitRelativePath || file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );
    const conventionalEntries = sourceInputs.filter((input) =>
      /\.(?:cir|sp|spi)$/iu.test(input.path),
    );
    const namedCircuitEntries = conventionalEntries.filter(
      (input) => input.path.split("/").at(-1)?.toLowerCase() === "circuit.spi",
    );
    const entryCandidates =
      namedCircuitEntries.length === 1
        ? namedCircuitEntries
        : conventionalEntries;
    if (entryCandidates.length !== 1) {
      setStatus(
        `Select one unambiguous .cir, .sp, or .spi entry and its local include files; found ${entryCandidates.length}`,
      );
      return;
    }
    setStatus("Importing SPICE sources");
    try {
      const result = await importSpiceSources(
        sourceInputs,
        entryCandidates[0]!.path,
      );
      const nextImportReport: SpiceImportReport = {
        entryPath: entryCandidates[0]!.path,
        diagnostics: result.diagnostics,
      };
      if (!result.project || !result.successful) {
        setImportReport(nextImportReport);
        setImportReviewOpen(true);
        setSelectionOpen(true);
        const firstError = result.diagnostics.find(
          (item) => item.severity === "error",
        );
        setStatus(firstError?.message ?? "SPICE import failed");
        return;
      }
      const instanceCount = result.project.documents.reduce(
        (count, candidate) => count + candidate.instances.length,
        0,
      );
      await guardDirtyReplacement("Import SPICE sources", () => {
        replaceActiveProject(result.project!, DEFAULT_VIEWBOX, {
          source: "spice-import",
        });
        setImportReport(nextImportReport);
        setImportReviewOpen(true);
        setSelectionOpen(true);
        setStatus(
          `Imported ${result.project!.documents.length} Documents and ${instanceCount} structural instances`,
        );
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "SPICE import failed");
    }
  }

  function fitView(): void {
    setViewBox(
      fitCameraToBounds(
        contentScene?.viewBox ?? DEFAULT_VIEWBOX,
        document.presentation.grid,
      ),
    );
    setStatus("Fit Document");
  }

  function zoomViewAtCenter(factor: number): void {
    setViewBox((current) =>
      zoomCameraAtAnchor(current, factor, { x: 0.5, y: 0.5 }),
    );
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>): void {
    // Ctrl/Command+wheel is a browser-reserved page-zoom gesture. The canvas
    // owns an unmodified wheel gesture only while the pointer is over it, so
    // schematic navigation stays useful without fighting the host browser.
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const anchor = {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
    const factor = event.deltaY < 0 ? 0.88 : 1.14;
    setViewBox((current) => zoomCameraAtAnchor(current, factor, anchor));
  }

  function beginCanvasGesture(event: ReactPointerEvent<SVGSVGElement>): void {
    const gesture = classifyCanvasGestureStart({
      button: event.button,
      altKey: event.altKey,
      interactionKind: getCurrentInteractionState().kind,
      targetIsCanvas:
        event.target === event.currentTarget ||
        (event.target as Element).tagName === "rect",
      placementPending: Boolean(pendingSymbolId && pendingComponentPlacement),
      vddRailMode,
      copyPlacementPending: copyPlacement !== null,
      tool,
    });
    if (gesture === "pan") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanPreview({
        clientStart: { x: event.clientX, y: event.clientY },
        viewBoxStart: viewBox,
        pointerId: event.pointerId,
        dragged: false,
      });
      return;
    }
    if (gesture === "zoom") {
      const zoomStart = pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget,
      );
      event.currentTarget.setPointerCapture(event.pointerId);
      setBoxPreview({
        start: zoomStart,
        end: zoomStart,
        pointerId: event.pointerId,
        intent: "zoom",
      });
      return;
    }
    if (gesture !== "select") return;
    const point = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
    event.currentTarget.setPointerCapture(event.pointerId);
    setBoxPreview({
      start: point,
      end: point,
      pointerId: event.pointerId,
      intent: "select",
    });
  }

  function continueCanvasGesture(
    event: ReactPointerEvent<SVGSVGElement>,
  ): void {
    const currentInteraction = getCurrentInteractionState();
    if (currentInteraction.kind === "moving-selection") {
      updateCommandMovePreviewFromSelection(
        pointFromClient(event.clientX, event.clientY, event.currentTarget),
        { x: event.clientX, y: event.clientY },
        event.currentTarget,
        event.altKey,
      );
      return;
    }
    if (panPreview?.pointerId === event.pointerId) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const update = updateCanvasPan(
        panPreview,
        { x: event.clientX, y: event.clientY },
        bounds,
        PAN_START_DISTANCE_PX,
      );
      if (!update) return;
      if (update.preview !== panPreview) setPanPreview(update.preview);
      setViewBox(update.viewBox);
      return;
    }
    const point = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
    lastCanvasPointRef.current = point;
    if (vddRailMode) {
      const snapped = {
        x: snapCoordinate(point.x, document.presentation.grid),
        y: snapCoordinate(point.y, document.presentation.grid),
      };
      setVddRailPreviewPoint(
        vddRailStart
          ? constrainedPowerRailEndpoint(vddRailStart, snapped)
          : snapped,
      );
      return;
    }
    if (pendingSymbolId) {
      setComponentPreviewPoint(point);
      return;
    }
    if (currentInteraction.kind === "copy-placement") {
      setCopyPreviewPoint({
        x: snapCoordinate(point.x, document.presentation.grid),
        y: snapCoordinate(point.y, document.presentation.grid),
      });
      return;
    }
    if (boxPreview?.pointerId === event.pointerId) {
      setBoxPreview({ ...boxPreview, end: point });
    }
    // Two-phase drafting: keep the preview anchored to the snap-aware hover point.
    if (
      (tool === "arrow" ||
        tool === "construction-line" ||
        tool === "rectangle") &&
      draftingSource !== null
    ) {
      const snapped = snapDraftingPoint(
        point,
        event.altKey,
        event.shiftKey,
        draftingSource ?? undefined,
        logicalRadiusForPixels(event.currentTarget, SNAP_CAPTURE_RADIUS_PX),
      );
      setDraftingHover(snapped.point);
      setDraftingSnapPoint(snapped.snap);
      paintSnapGuides(snapped.guides);
    }
    if (tool === "wire" && wireSource) {
      const rawPoint = pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget,
        false,
      );
      const resolved = resolveWireCanvasSnap(
        rawPoint,
        event.currentTarget,
        event.altKey,
      );
      setWirePreviewPoint(resolved.point);
      paintSnapGuides(resolved.guides);
    }
  }

  function finishCanvasGesture(event: ReactPointerEvent<SVGSVGElement>): void {
    if (
      event.type === "pointercancel" &&
      cellSymbolLayoutDragPointerId === event.pointerId
    ) {
      cancelCellSymbolLayoutDrag();
      return;
    }
    if (completeCellSymbolLayoutDrag(event)) return;
    if (panPreview?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (!panPreview.dragged && getCurrentInteractionState().kind === "wire") {
        cycleWireCornerShape();
      }
      setPanPreview(null);
      return;
    }
    if (boxPreview?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (boxPreview.intent === "zoom") {
      const rect = normalizedRect(boxPreview.start, boxPreview.end);
      setBoxPreview(null);
      // A right press barely moved is an ordinary right click, not a frame.
      if (
        rect.width > document.presentation.grid &&
        rect.height > document.presentation.grid
      ) {
        setViewBox(fitCameraToBounds(rect, document.presentation.grid));
        setStatus("Zoomed to framed region");
      }
      return;
    }
    const rect = normalizedRect(boxPreview.start, boxPreview.end);
    const clicked =
      rect.width <= document.presentation.grid &&
      rect.height <= document.presentation.grid;
    // Classic directional marquee: a left-to-right drag is a window (full
    // containment required), a right-to-left drag is a crossing (any overlap
    // selects). Geometry alone decides membership.
    const selection = clicked
      ? { instanceIds: [], ...EMPTY_SUPPLEMENTAL_SELECTION }
      : marqueeSelection(
          document,
          resolver,
          routeGeometryRecords,
          styleProfile,
          rect,
          marqueeMode(boxPreview.start, boxPreview.end),
        );
    replaceSelection(selection);
    setSelectedEndpoint(null);
    setBoxPreview(null);
    const count =
      selection.instanceIds.length +
      selection.routeIds.length +
      selection.junctionIds.length +
      selection.annotationIds.length +
      selection.draftingIds.length;
    setStatus(count > 0 ? `Selected ${count} objects` : "Selection cleared");
  }

  // Drafting uses the shared Snap Engine. It may align visually to electrical
  // geometry, but this profile never creates a Net or junction.
  // closest point on any route segment, or any existing drafting vertex — within
  // DRAFTING_SNAP_RADIUS — wins; grid snap is the fallback. Shift locks the
  // resulting segment from the origin to horizontal/vertical/45°. Purely visual
  // — never creates a Net, junction, or short.
  function disconnectSelectedEndpoint(removeRoutes: boolean): void {
    if (!selectedEndpoint || selectedEndpoint.endpoint.kind === "junction") {
      return;
    }
    const routeEdits = removeRoutes
      ? document.routes
          .filter(
            (route) =>
              endpointKey(route.from) ===
                endpointKey(selectedEndpoint.endpoint) ||
              endpointKey(route.to) === endpointKey(selectedEndpoint.endpoint),
          )
          .map((route): SchematicEdit => ({
            kind: "remove_route_geometry",
            routeId: route.id,
          }))
      : [];
    const result = transactConnectivity(
      "disconnect_endpoint",
      [
        ...routeEdits,
        { kind: "disconnect_endpoint", endpoint: selectedEndpoint.endpoint },
      ],
      { removeRoutes },
    );
    if (result?.ok) {
      setSelectedEndpoint(null);
      setStatus(
        removeRoutes ? "Deleted endpoint connection" : "Disconnected endpoint",
      );
    }
  }

  function nextNoConnectId(): string {
    const occupied = new Set([
      ...document.instances.map((instance) => instance.id),
      ...document.nets.map((net) => net.id),
      ...document.routes.map((route) => route.id),
      ...document.junctions.map((junction) => junction.id),
      ...document.noConnects.map((noConnect) => noConnect.id),
      ...document.annotations.map((annotation) => annotation.id),
      ...document.layoutGroups.map((group) => group.id),
      ...document.constraints.map((constraint) => constraint.id),
      ...(document.drafting?.objects ?? []).map((object) => object.id),
    ]);
    let id: string;
    do {
      uniqueSuffixCounter.current += 1;
      id = `no-connect-ui-${uniqueSuffixCounter.current}`;
    } while (occupied.has(id));
    return id;
  }

  useEffect(() => {
    function dismissOnOutsidePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const targetElement =
        target instanceof Element ? target : target.parentElement;
      if (
        textEditing &&
        !targetElement?.closest('[data-testid="canvas-text-editor"]')
      ) {
        // Leaving the canvas text editor commits the session; emptying the
        // text still deletes the annotation, matching the Apply button.
        commitTextEditing();
      }
      const openMenus = Array.from(
        globalThis.document.querySelectorAll<HTMLDetailsElement>(
          ".command-menu[open]",
        ),
      );
      if (
        openMenus.length > 0 &&
        !openMenus.some((menu) => menu.contains(target))
      ) {
        dismissOpenCommandMenus();
      }
    }
    globalThis.document.addEventListener(
      "pointerdown",
      dismissOnOutsidePointerDown,
      true,
    );
    return () =>
      globalThis.document.removeEventListener(
        "pointerdown",
        dismissOnOutsidePointerDown,
        true,
      );
  }, [textEditing]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "f" &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (event.key === "Escape" && searchOpen) {
        event.preventDefault();
        closeSearch();
        return;
      }
      if (event.key === "Escape" && insertDialogOpen) {
        // The dialog focuses its search field a frame after it opens, so an
        // Escape pressed in that gap never reaches its own handler. Cancel it
        // from the window instead of leaving the dialog stuck open.
        event.preventDefault();
        cancelComponentInsertFromHook();
        return;
      }
      if (event.key === "Escape" && dismissOpenCommandMenus()) {
        event.preventDefault();
        return;
      }
      if (event.key === "Escape" && textEditing) {
        event.preventDefault();
        // Escape commits the session; emptying the text still deletes the
        // annotation, matching the Apply button.
        commitTextEditing();
        return;
      }
      if (
        event.key === "Escape" &&
        isTypingTarget(event.target) &&
        event.target instanceof Element &&
        event.target.closest(".selection-dock") !== null
      ) {
        // Escape inside Properties commits pending drafts instead of losing
        // them; a second Escape resumes normal canvas cancel behavior.
        event.preventDefault();
        commitInstancePropertyDraft();
        commitPendingNetLabelDraft();
        if (event.target instanceof HTMLElement) event.target.blur();
        return;
      }
      const currentInteraction = getCurrentInteractionState();
      const shortcut = resolveEditorShortcut(event, {
        isTyping: isTypingTarget(event.target),
        interactionMode: currentInteraction.kind,
        hasRoutedMarkerSelection: Boolean(
          selectedAnnotation && isRoutedMarker(selectedAnnotation),
        ),
        canRotate: editorCommands.state({ id: "transform.rotate" }).enabled,
        canMirror: editorCommands.state({
          id: "transform.mirror",
          direction: "left-right",
        }).enabled,
        hasDraftingSelection: Boolean(selectedDrafting),
        hasInspectableSelection,
        hasRouteSelection: Boolean(selectedRoute),
        hasHighlightableNet: selectedHighlightNetId !== null,
        wireReadyToFinish: Boolean(wireSource && wirePreviewPoint),
        draftingReadyToFinish:
          (tool === "arrow" ||
            tool === "construction-line" ||
            tool === "rectangle") &&
          draftingSource !== null,
        hasRemovableWireWaypoint: Boolean(
          wireSource && wireDraftSteps.length > 0,
        ),
        propertiesOpen: selectionOpen,
        hasHierarchyEnterSelection,
        canReturnToParent: documentStack.length > 0,
      });
      if (!shortcut) return;

      const escapeIntent =
        shortcut.kind === "run-command" &&
        shortcut.command.id === "editor.cancel";
      if (!escapeIntent) event.preventDefault();

      switch (shortcut.kind) {
        case "run-command":
          editorCommands.execute(shortcut.command);
          return;
        case "block-browser-refresh":
          setStatus("Refresh blocked to protect the current circuit");
          return;
        case "block-browser-bookmark":
          setStatus("Browser bookmark shortcut blocked while editing");
          return;
        case "save":
          void saveProjectFile();
          return;
        case "open":
          projectInputRef.current?.click();
          return;
        case "reverse-current-marker":
          reverseSelectedCurrentArrow();
          return;
        case "edit-net-label":
          beginNetLabelEditing();
          return;
        case "net-label-selection-required":
          setStatus("Select a wire segment before adding a Net Label");
          return;
        case "toggle-net-highlight":
          toggleHighlightedNet();
          return;
        case "enter-hierarchy":
          enterSelectedHierarchy();
          return;
        case "return-to-parent":
          returnToParentDocument();
          return;
        case "hierarchy-selection-required":
          setStatus(
            "Select a rectangle or hierarchical block before entering a Cell",
          );
          return;
        case "step-drafting-style": {
          if (!selectedDrafting) return;
          if (shortcut.target === "arrow-head") {
            const scale = selectedDrafting.styleOverride?.arrowHeadScale ?? 1;
            setDraftingStyle({
              arrowHeadScale: stepBoundedScale(
                scale,
                [0.75, 1, 1.25, 1.5] as const,
                shortcut.increase,
              ),
            });
          } else {
            const scale = selectedDrafting.styleOverride?.strokeScale ?? 1;
            setDraftingStyle({
              strokeScale: stepBoundedScale(
                scale,
                [0.75, 1, 1.5, 2] as const,
                shortcut.increase,
              ),
            });
          }
          return;
        }
        case "finish-wire":
          if (wirePreviewPoint) finishWireAtPoint(wirePreviewPoint);
          return;
        case "toggle-wire-options":
          setWireOptionsOpen((open) => !open);
          return;
        case "finish-drafting":
          finishDraftingCreate();
          return;
        case "remove-wire-waypoint":
          setWireDraftSteps(wireDraftSteps.slice(0, -1));
          setStatus("Removed last authored wire step");
          return;
        case "blocked-interaction-command":
          setStatus(
            `${shortcut.command} is unavailable while an active tool owns the canvas · Esc cancels`,
          );
          return;
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  function selectSearchResult(result: SearchResult): void {
    navigateToLocator(
      result.locator,
      `Selected ${result.locator.kind} ${result.locator.objectId}`,
    );
    closeSearch();
  }

  function highlightNet(
    netId: string,
    documentId = document.id,
    endpoint?: RouteEndpoint,
    hierarchyPath: readonly HierarchyFrame[] = documentId === document.id
      ? documentStack
      : (findHierarchyPath(
          projectConnectivityIndex,
          project.topDocumentId,
          documentId,
        ) ?? []),
  ): void {
    setHighlightedNetOrigin({
      documentId,
      netId,
      hierarchyPath,
      ...(endpoint ? { endpoint } : {}),
    });
    setStatus(`Highlighted Net ${netId}`);
  }

  function toggleHighlightedNet(): void {
    const netId = selectedHighlightNetId;
    if (!netId) {
      setStatus(
        "Select a wire, connected pin, or Net Label before highlighting a Net",
      );
      return;
    }
    if (selectedHighlightIsActive) {
      setHighlightedNetOrigin(null);
      setStatus(`Cleared Net highlight ${netId}`);
      return;
    }
    highlightNet(netId, document.id, selectedHighlightEndpoint);
  }

  function navigateTraceHop(
    hop: HierarchyNetTraceHop | GlobalNetTraceHop,
  ): void {
    navigateToLocator(
      {
        documentId: hop.to.documentId,
        hierarchyPath: hop.to.hierarchyPath,
        kind: "net",
        objectId: hop.to.netId,
      },
      hop.direction === "global"
        ? `Traced global Net ${hop.foldedName} to ${hop.to.netId}`
        : `Traced Net ${hop.to.netId} via ${hop.frame.instanceId}.${hop.frame.parentPinName}`,
    );
  }

  return (
    <main className="app-shell">
      {renderCrashRequested() ? <RenderCrashProbe /> : null}
      <header className="app-chrome">
        <div className="app-chrome-main">
          <div className="app-brand">
            <a
              className="gallery-home-link"
              href="/"
              aria-label="Back to the gallery"
              title="Back to the gallery"
            >
              <span className="app-brand-mark" aria-hidden="true" />
              <h1 title="Analog Canvas">Analog Canvas</h1>
            </a>
            <div className="app-brand-copy">
              <p title={`${project.name} / ${document.name}`}>
                {/* The circuit's name is what a published entry and a saved
                    file are called, so it is edited where it is read. */}
                <input
                  className="app-project-name"
                  aria-label="Circuit name"
                  data-testid="project-name-input"
                  value={projectNameDraft ?? project.name}
                  size={Math.max((projectNameDraft ?? project.name).length, 6)}
                  onChange={(event) =>
                    setProjectNameDraft(event.currentTarget.value)
                  }
                  onBlur={() => commitProjectName()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setProjectNameDraft(null);
                  }}
                />{" "}
                /{" "}
                <span data-testid="active-document-name">{document.name}</span>
              </p>
            </div>
          </div>
          <nav
            className="app-command-surface"
            aria-label="Editor commands"
            onClick={(event) => {
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest(".command-popover button")
              ) {
                dismissOpenCommandMenus();
              }
            }}
          >
            <div className="menubar-row">
              <FileCommandMenu
                workspaceSlots={workspaceSlots}
                previousProjectName={previousProject?.project.name ?? null}
                canRevert={formalProjectBaseline !== null && isDirtyWork()}
                hasRecoverySessions={recoverySessions.length > 0}
                projectInputRef={projectInputRef}
                onNewProject={createNewProject}
                onSaveProject={(pickLocation) =>
                  void saveProjectFile({ pickLocation })
                }
                onOpenShelfSlot={(slot) => void openShelvedCircuit(slot)}
                onRefresh={refreshApp}
                onOpenProject={(file) => void openProjectFile(file)}
                onImportSpice={(files) => void importSpiceFiles(files)}
                onExportSvg={exportSvg}
                onExportRaster={(format) => void exportRaster(format)}
                onExportNetlist={exportDesignNetlist}
                onRestorePrevious={restorePreviousProject}
                onRevert={revertToFormalProjectBaseline}
                onOpenRecovery={openRecoveryDialog}
              />
              <details className="command-menu" name="editor-command-menu">
                <summary>Edit</summary>
                <div className="command-popover">
                  <button
                    type="button"
                    data-testid="edit-manage-cells"
                    onClick={() => setCellManagerOpen(true)}
                  >
                    Manage Cells…
                  </button>
                  <button
                    type="button"
                    data-testid="project-search-button"
                    aria-haspopup="dialog"
                    aria-expanded={searchOpen}
                    onClick={() => setSearchOpen(true)}
                  >
                    Search…
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      editorCommands.execute({ id: "history.undo" })
                    }
                    disabled={
                      !editorCommands.state({ id: "history.undo" }).enabled
                    }
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      editorCommands.execute({ id: "history.redo" })
                    }
                    disabled={
                      !editorCommands.state({ id: "history.redo" }).enabled
                    }
                  >
                    Redo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      editorCommands.execute({ id: "selection.delete" })
                    }
                    disabled={
                      !hasVisualSelection(visualSelection) && !selectedEndpoint
                    }
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitCellReset(clearDrawingPlan, "Clear Drawing")
                    }
                    disabled={clearDrawingPlan.edits.length === 0}
                  >
                    Clear Drawing
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitCellReset(
                        resetPlacementPlan,
                        "Reset Cell Placement",
                      )
                    }
                    disabled={resetPlacementPlan.edits.length === 0}
                  >
                    Reset Cell Placement
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitCellReset(resetBodyPlan, "Reset Cell Body")
                    }
                    disabled={resetBodyPlan.edits.length === 0}
                  >
                    Reset Cell Body
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      editorCommands.execute({ id: "transform.rotate" })
                    }
                    disabled={
                      !editorCommands.state({ id: "transform.rotate" }).enabled
                    }
                  >
                    <ToolIcon name="rotate" />
                    Rotate
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      editorCommands.execute({
                        id: "transform.mirror",
                        direction: "left-right",
                      })
                    }
                    disabled={
                      !editorCommands.state({
                        id: "transform.mirror",
                        direction: "left-right",
                      }).enabled
                    }
                  >
                    Mirror left/right (Shift+R)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      editorCommands.execute({
                        id: "transform.mirror",
                        direction: "top-bottom",
                      })
                    }
                    disabled={
                      !editorCommands.state({
                        id: "transform.mirror",
                        direction: "top-bottom",
                      }).enabled
                    }
                  >
                    Mirror top/bottom (Ctrl+R)
                  </button>
                  {selectedIds.length > 1 ? (
                    <button type="button" onClick={alignSelectedInstances}>
                      Align
                    </button>
                  ) : null}
                </div>
              </details>
              <details className="command-menu" name="editor-command-menu">
                <summary>Netlist</summary>
                <div className="command-popover">
                  <span className="command-group-label">Authoring</span>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={instanceTableOpen}
                    onClick={() => setInstanceTableOpen(true)}
                  >
                    Instance Table…
                  </button>
                  <span className="command-group-label">Check</span>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={netlistPreflightOpen}
                    onClick={() => setNetlistPreflightOpen(true)}
                  >
                    Check Report…
                  </button>
                </div>
              </details>
              {publicAgentUiEnabled ? (
                <details className="command-menu" name="editor-command-menu">
                  <summary>Agent</summary>
                  <div className="command-popover">
                    <button
                      type="button"
                      onClick={() => {
                        if (agentSession.status === "idle") {
                          setAgentPanelOpen(true);
                          return;
                        }
                        setSelectionOpen(true);
                        setAgentDetailsOpen(true);
                      }}
                    >
                      {agentSession.status === "idle"
                        ? "Connect Agent"
                        : "Manage Agent"}
                    </button>
                  </div>
                </details>
              ) : null}
              <button
                type="button"
                className="toolbar-check-save"
                data-testid="check-and-save-button"
                title="Check the circuit and save it to your shelf"
                onClick={() => void checkAndSave()}
              >
                <span className="toolbar-check-glyph" aria-hidden="true" />
                Check and Save
              </button>
              <button
                type="button"
                data-testid="publish-gallery-button"
                aria-haspopup="dialog"
                aria-expanded={publishGalleryOpen}
                title="Publish to Gallery"
                onClick={() => setPublishGalleryOpen(true)}
              >
                Publish to Gallery
              </button>
            </div>
          </nav>
          <div className="app-chrome-actions">
            <a
              className="analytics-link"
              href="/analytics"
              aria-label="Open visitor analytics"
            >
              {visitStats ? (
                <>
                  <span>{visitStats.uv.toLocaleString()} visitors</span>
                  <span aria-hidden="true">·</span>
                  <span>{visitStats.pv.toLocaleString()} views</span>
                </>
              ) : (
                "Analytics"
              )}
            </a>
            <button
              type="button"
              className="menubar-help"
              ref={helpButtonRef}
              aria-haspopup="dialog"
              aria-expanded={helpOpen}
              aria-controls="editor-help-dialog"
              onClick={() => setHelpOpen(true)}
            >
              Help
            </button>
          </div>
        </div>
        <DrawingToolbar
          leftPanelMode={leftPanelMode}
          libraryPanelOpen={visibleLibraryPanelOpen}
          tool={tool}
          documentSettingsOpen={documentSettingsOpen}
          onToggleExamples={toggleExamplesPanel}
          onToggleLibrary={toggleLibraryPanel}
          onInsert={() =>
            editorCommands.execute({
              id: "insert.start",
              launch: fullInsertLaunch(),
            })
          }
          onActivateTool={(nextTool) =>
            editorCommands.execute({ id: "tool.activate", tool: nextTool })
          }
          onAddText={() => editorCommands.execute({ id: "drafting.add-text" })}
          onOpenDocumentSettings={() => {
            setDocumentSettingsOpen((open) => !open);
            setSelectionOpen(true);
          }}
        />
        <HierarchyToolbar
          documents={project.documents}
          activeDocumentId={document.id}
          topDocumentId={project.topDocumentId}
          navigationDepth={documentStack.length}
          canEnter={hasHierarchyEnterSelection}
          onUp={returnToParentDocument}
          onTop={returnToTopDocument}
          onSelectDocument={selectDocumentFromHierarchy}
          onEnter={enterSelectedHierarchy}
          onManageCells={() => setCellManagerOpen(true)}
          onPlaceCell={placeCellInstance}
        />
        <EditorTestTelemetry
          snapshot={{
            selectedInternalRouteCount: internalSelection.routeIds.length,
            revision: document.revision,
            sourceStatus: document.sourceStatus,
            documentCount: project.documents.length,
            activeDocumentId: document.id,
            activeInstanceCount: document.instances.length,
            instanceCount: projectInstanceCount,
            netCount: document.nets.length,
            activeTool: tool,
            flightlineCount: flightlines.length,
            displayedFlightlineCount: displayedFlightlines.length,
            crossingCount: crossings.length,
            annotationCount: document.annotations.length,
            structuralDiagnosticCount:
              visualDiagnosticSummary.structural.length,
            visualDiagnosticCount: visualDiagnosticSummary.observations.length,
            blockingDiagnosticCount: visualDiagnosticSummary.blockingCount,
          }}
        />
      </header>
      <Suspense fallback={null}>
        {helpOpen ? (
          <LazyEditorHelpDialog
            closeButtonRef={helpCloseRef}
            onClose={closeHelp}
          />
        ) : null}
        {(recoveryState === "quota-exceeded" ||
          recoveryState === "unavailable" ||
          recoveryState === "failed") &&
        !recoveryFailureDismissed ? (
          <RecoveryFailureBanner
            state={recoveryState}
            onDownload={() => {
              const outcome = requestProjectDownload(project);
              setStatus(
                outcome.status === "download-requested"
                  ? `Download requested: ${outcome.fileName}`
                  : `Download failed: ${outcome.message}`,
              );
            }}
            onDismiss={() => setRecoveryFailureDismissed(true)}
          />
        ) : null}
        {recoveryDialogOpen && recoverySessions.length > 0 ? (
          <LazyRecentRecoveryDialog
            sessions={recoverySessions}
            onRestore={restoreRecoverySession}
            onDownloadBackup={downloadRecoveryBackup}
            onDeleteSession={deleteRecoverySessionFromDialog}
            onClose={() => setRecoveryDialogOpen(false)}
          />
        ) : null}
        {replaceGuard !== null ? (
          <LazyReplaceGuardDialog
            intent={replaceGuard.intent}
            onCancel={cancelReplaceGuard}
            onConfirm={confirmReplaceGuard}
            onDownload={downloadCurrentProjectFromGuard}
          />
        ) : null}
        {searchOpen ? (
          <LazyProjectSearchDialog
            open={searchOpen}
            query={searchQuery}
            results={searchResults}
            onQueryChange={setSearchQuery}
            onSelect={selectSearchResult}
            onClose={closeSearch}
          />
        ) : null}
        {instanceTableOpen ? (
          <LazyInstanceTableDialog
            open={instanceTableOpen}
            project={project}
            connectivityIndex={projectConnectivityIndex}
            activeDocumentId={document.id}
            onClose={() => setInstanceTableOpen(false)}
            onOpenInstance={openInstanceFromTable}
            onApply={(transactionId, edits) => {
              const committed = commitStructure(transactionId, edits);
              if (committed) {
                setStatus(
                  `Updated ${edits.length} Cell${edits.length === 1 ? "" : "s"}`,
                );
              }
              return committed;
            }}
          />
        ) : null}
        {insertDialogOpen ? (
          <LazyInsertComponentDialog
            open={insertDialogOpen}
            styleProfileId={document.presentation.styleProfileId}
            recentSymbolIds={recentSymbolIds}
            cells={cellInsertCandidates}
            externalDefinitions={externalSubcircuitInsertCandidates}
            scope={insertScope}
            initialSelectionId={insertInitialSelectionId}
            onApply={(request) =>
              editorCommands.execute({
                id: "insert.start",
                launch: { kind: "quick", request },
              })
            }
            onCancel={cancelComponentInsertFromHook}
          />
        ) : null}
        {pendingCellReset ? (
          <div
            className="insert-dialog-backdrop"
            onPointerDown={(event) =>
              event.target === event.currentTarget && cancelClearCanvas()
            }
          >
            <section
              className="editor-action-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-canvas-dialog-title"
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelClearCanvas();
              }}
            >
              <header className="editor-action-dialog-header">
                <p>Cell contents</p>
                <h2 id="clear-canvas-dialog-title">
                  {pendingCellReset.command} in {document.name}?
                </h2>
              </header>
              <div className="editor-action-dialog-body">
                <p>
                  {pendingCellReset.plan.summary}. Affected objects:{" "}
                  {pendingCellReset.plan.affectedObjectIds.length}. You can
                  restore them with Undo.
                </p>
              </div>
              <footer className="editor-action-dialog-actions">
                <button type="button" autoFocus onClick={cancelClearCanvas}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={confirmClearCanvas}
                >
                  {pendingCellReset.command}
                </button>
              </footer>
            </section>
          </div>
        ) : null}
        {cellManagerOpen ? (
          <LazyCellManagerDialog
            open={cellManagerOpen}
            cells={cellManagerEntries}
            documents={project.documents}
            activeDocumentId={document.id}
            onClose={() => setCellManagerOpen(false)}
            onCreate={(name) => {
              createCell(name);
              setCellManagerOpen(false);
            }}
            onOpen={(documentId) => {
              setCellManagerOpen(false);
              switchDocument(documentId);
            }}
            onRename={renameCell}
            onDelete={(documentId) => {
              const target = project.documents.find(
                (candidate) => candidate.id === documentId,
              );
              if (!target) return;
              if (
                commitStructure(
                  "delete-cell",
                  planDeleteCell(project, documentId),
                  project.topDocumentId,
                )
              ) {
                setCellManagerOpen(false);
                setStatus(`Deleted Cell ${target.name}`);
              }
            }}
            onJumpToCaller={jumpToCaller}
            onRenameTerminal={(documentId, terminalId, name) =>
              renameCellTerminal(terminalId, name, documentId)
            }
            onSetTerminalDirection={(documentId, terminalId, direction) =>
              updateCellPinDirection(terminalId, direction, documentId)
            }
            onMoveTerminal={(documentId, terminalId, delta) =>
              moveCellTerminal(terminalId, delta, documentId)
            }
            onSetFormalParameters={(documentId, formalParameters) =>
              setCellFormalParameters(formalParameters, documentId)
            }
            externalDefinitions={project.externalSubcircuitDefinitions}
            onSetExternalDefinition={setExternalSubcircuitDefinition}
          />
        ) : null}
        {netlistPreflightOpen ? (
          <LazyNetlistPreflightDialog
            open={netlistPreflightOpen}
            result={netlistAnalysis}
            electricalDiagnostics={electricalDiagnostics}
            onClose={() => setNetlistPreflightOpen(false)}
            onNavigate={navigateToNetlistDiagnostic}
            onNavigateElectrical={jumpToProjectDiagnostic}
            onExport={(format) => exportDesignNetlist(format, true)}
          />
        ) : null}
        {publishGalleryOpen ? (
          <LazyPublishGalleryDialog
            draft={publishDraft}
            onDraftChange={setPublishDraft}
            defaultName={project.name}
            session={publishSession}
            gateReport={publishGates}
            updateTarget={
              galleryEntryContext &&
              publishSession &&
              (publishSession.isAdmin ||
                publishSession.role === "moderator" ||
                (galleryEntryContext.ownerUserId !== null &&
                  publishSession.id === galleryEntryContext.ownerUserId))
                ? { id: galleryEntryContext.id, name: galleryEntryContext.name }
                : null
            }
            updateDefaults={
              galleryEntryContext
                ? {
                    description: galleryEntryContext.description,
                    tags: galleryEntryContext.tags,
                  }
                : null
            }
            publish={(fields) => publishProjectToGallery(project, fields)}
            publishUpdate={
              galleryEntryContext
                ? (fields) =>
                    updateGalleryEntry(galleryEntryContext.id, project, fields)
                : undefined
            }
            onPublished={({ name, updated }) => {
              setPublishGalleryOpen(false);
              setPublishDraft(null);
              setStatus(
                updated
                  ? `Updated "${name}" in the gallery`
                  : `Published "${name}" to the gallery`,
              );
            }}
            onShowHistory={
              galleryEntryContext
                ? () => {
                    setPublishGalleryOpen(false);
                    setVersionHistoryOpen(true);
                  }
                : undefined
            }
            onClose={() => setPublishGalleryOpen(false)}
          />
        ) : null}
        {versionHistoryOpen && galleryEntryContext ? (
          <LazyVersionHistoryDialog
            entryId={galleryEntryContext.id}
            entryName={galleryEntryContext.name}
            onRestored={() => {
              setVersionHistoryOpen(false);
              setStatus("Version restored — reloading the entry");
              void openGalleryEntryById(galleryEntryContext.id);
            }}
            onClose={() => setVersionHistoryOpen(false)}
          />
        ) : null}
        {publicAgentUiEnabled && agentPanelOpen ? (
          <LazyConnectAgentPanel
            open={agentPanelOpen}
            status={agentSession.status}
            claimCode={agentSession.claimCode}
            claimExpiresAt={agentSession.claimExpiresAt}
            scopes={agentSession.scopes}
            expiresAt={agentSession.expiresAt}
            error={agentSession.error}
            now={Date.now()}
            onGrant={agentSession.grant}
            onPause={agentSession.pause}
            onResume={agentSession.resume}
            onReconnect={agentSession.reconnect}
            onNewConnection={agentSession.newConnection}
            onRevoke={agentSession.revoke}
            onClose={() => {
              setAgentPanelOpen(false);
            }}
          />
        ) : null}
      </Suspense>
      {publicAgentUiEnabled && agentFileCandidate ? (
        <div className="agent-panel" data-testid="agent-file-approval">
          <section
            className="agent-dialog"
            role="dialog"
            aria-label="Approve Agent file import"
          >
            <div className="agent-panel-header">
              <h2>Approve Agent file import</h2>
            </div>
            <p>
              The Agent staged a {agentFileCandidate.kind} candidate. It has not
              changed this Project. Replacing it will end the current Agent
              session.
            </p>
            <dl className="agent-file-candidate-summary">
              <div>
                <dt>Project</dt>
                <dd>{agentFileCandidate.projectName}</dd>
              </div>
              <div>
                <dt>Documents</dt>
                <dd>{agentFileCandidate.documentCount}</dd>
              </div>
              <div>
                <dt>Instances</dt>
                <dd>{agentFileCandidate.instanceCount}</dd>
              </div>
            </dl>
            {agentFileCandidate.diagnostics.length > 0 ? (
              <ul className="agent-panel-audit">
                {agentFileCandidate.diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.severity}-${index}`}>
                    <span>{diagnostic.severity}</span>
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="agent-panel-controls">
              <button
                type="button"
                data-testid="agent-file-reject"
                onClick={rejectAgentFileCandidate}
              >
                Reject
              </button>
              <button
                type="button"
                data-testid="agent-file-approve"
                onClick={approveAgentFileCandidate}
              >
                Replace Project
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <div
        className={
          visibleLibraryPanelOpen
            ? "app-workspace"
            : "app-workspace library-collapsed"
        }
        style={{ "--icm-shapes-width": `${libraryWidth}px` } as CSSProperties}
      >
        {leftPanelMode === "library" ? (
          <ShapesPanel
            styleProfileId={document.presentation.styleProfileId}
            open={visibleLibraryPanelOpen}
            onStartInsert={(launch) =>
              editorCommands.execute({ id: "insert.start", launch })
            }
          />
        ) : (
          <ExamplesPanel
            open={visibleLibraryPanelOpen}
            galleryExamples={galleryExamples}
            onOpenGalleryExample={(id) => void insertGalleryEntryById(id)}
            onOpenExample={openLibraryExample}
          />
        )}
        {visibleLibraryPanelOpen ? (
          <div
            className="library-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the Library panel"
            aria-valuenow={libraryWidth}
            aria-valuemin={LIBRARY_WIDTH_MIN}
            aria-valuemax={LIBRARY_WIDTH_MAX}
            tabIndex={0}
            data-testid="library-resize-handle"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              libraryResizeOriginRef.current = {
                pointerX: event.clientX,
                width: libraryWidth,
              };
            }}
            onPointerMove={(event) => {
              const origin = libraryResizeOriginRef.current;
              if (!origin) return;
              setLibraryWidth(origin.width + (event.clientX - origin.pointerX));
            }}
            onPointerUp={(event) => {
              libraryResizeOriginRef.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 32 : 8;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setLibraryWidth(libraryWidth - step);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setLibraryWidth(libraryWidth + step);
              }
            }}
          />
        ) : null}
        <aside
          className={selectionOpen ? "selection-dock open" : "selection-dock"}
          aria-label="Properties"
          role="complementary"
        >
          <section className="selection-shelf" aria-label="Selection">
            <button
              type="button"
              ref={selectionShelfRef}
              className="selection-shelf-header"
              data-testid="selection-shelf"
              aria-expanded={selectionOpen}
              onClick={() => {
                if (selectionOpen) exitCellSymbolLayout();
                // Narrow layouts have room for one side panel. Whichever the
                // user just asked for wins, rather than one of them always
                // outranking the other and appearing not to open at all.
                else if (compactLayout) setCompactLibraryPanelOpen(false);
                setSelectionOpen((current) => !current);
                if (selectionOpen) setImportReviewOpen(false);
              }}
            >
              <span className="selection-shelf-title">
                <ToolIcon name="inspect" />
                <span>Properties</span>
                {publicAgentUiEnabled &&
                agentSession.status !== "idle" &&
                !agentStatusDismissed ? (
                  <span
                    className={`agent-shelf-indicator ${
                      agentSession.status === "revoked" ||
                      agentSession.status === "expired"
                        ? "terminal"
                        : ""
                    }`}
                    title={`Agent: ${agentSession.status}`}
                    aria-label={`Agent: ${agentSession.status}`}
                  />
                ) : null}
              </span>
              <span className="selection-shelf-summary">
                {selectionShelfSummary}
                {hasInspectableSelection ? (
                  <span
                    className="selection-shelf-indicator"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
            </button>
            <div className="selection-panel" hidden={!selectionOpen}>
              {documentSettingsOpen ? (
                <DocumentSettingsSection
                  document={document}
                  onApplyStyle={(styleOverrides) => {
                    const result = transact([
                      {
                        kind: "set_presentation_style",
                        styleProfileId: document.presentation.styleProfileId,
                        styleOverrides,
                      },
                    ]);
                    if (result.ok) {
                      setStatus(
                        styleOverrides
                          ? "Updated document style"
                          : "Reset document style to profile defaults",
                      );
                    }
                  }}
                  onChangeBulkDefault={updateMosBulkDefault}
                />
              ) : null}
              <MosBulkConnectionSection
                connection={
                  selectedInstance && selectedBulkResolution
                    ? `${selectedInstance.id}.B → ${
                        selectedBulkResolution.net
                          ? (resolveDocumentLogicalNets(
                              document,
                            ).byBaseNetId.get(selectedBulkResolution.net.id)
                              ?.name ?? selectedBulkResolution.net.id)
                          : "unresolved"
                      } · ${selectedBulkResolution.status}`
                    : null
                }
                explicitRouteVisible={Boolean(selectedHiddenBulkNet)}
                onDraw={drawSelectedMosBulk}
              />
              <RoutingGuidanceSection
                total={flightlines.length}
                displayed={displayedFlightlines.length}
                view={routingGuidanceView}
                onViewChange={setRoutingGuidanceView}
              />
              {!hasInspectableSelection ? (
                <p className="inspect-empty">Select an object to inspect.</p>
              ) : null}
              <GroupDisplayToggles
                active={selectedIds.length > 1}
                referencesVisible={selectedGroupLabelsAllVisible}
                valuesVisible={selectedGroupValuesAllVisible}
                valuesAvailable={selectedGroupValueAvailable}
                onReferencesVisibleChange={(visible) =>
                  setReferenceLabelsVisible(selectedIds, visible)
                }
                onValuesVisibleChange={(visible) =>
                  setValueLabelsVisible(selectedIds, visible)
                }
              />
              {selectedInstance ? (
                <section
                  className="property-section component-properties"
                  aria-label="Component properties"
                >
                  {selectedFormalTerminal ? (
                    <FormalPortProperties
                      terminal={selectedFormalTerminal}
                      revision={document.revision}
                      onRename={renameSelectedFormalPort}
                      onDirectionChange={updateCellPinDirection}
                    />
                  ) : null}
                  {selectedHierarchyCell ? (
                    <CellSymbolLayoutProperties
                      cell={selectedHierarchyCell}
                      enabled={cellSymbolLayoutEnabled}
                      onToggle={toggleCellSymbolLayout}
                      onBodySizeChange={(width, height) =>
                        setCellSymbolBodySize(
                          selectedHierarchyCell,
                          width,
                          height,
                        )
                      }
                      onPortPlacementChange={(terminalId, side, offset) =>
                        setCellSymbolPortPlacement(
                          selectedHierarchyCell,
                          terminalId,
                          side,
                          offset,
                        )
                      }
                    />
                  ) : null}
                  <ComponentIdentityProperties
                    instance={selectedInstance}
                    revision={document.revision}
                    cellName={document.netlist?.name ?? document.name}
                    formalTerminalSelected={Boolean(selectedFormalTerminal)}
                    portNet={
                      selectedPortNet
                        ? {
                            id: selectedPortNet.id,
                            logicalName: selectedPortLogicalName ?? "",
                            supply: Boolean(selectedSupplyMarker),
                          }
                        : null
                    }
                    targetDescription={
                      selectedInstance.netlist &&
                      !(
                        selectedInstance.netlist.binding?.kind === "model" ||
                        selectedDevice?.targetPolicy === "required-model" ||
                        selectedExternalMosMapping
                      )
                        ? componentTargetDescription(
                            selectedInstance,
                            selectedHierarchyCell?.netlist?.name,
                            selectedExternalSubcircuit?.name,
                          )
                        : null
                    }
                    capacitorPlateRows={selectedCapacitorPlateRows}
                    modelTarget={
                      selectedInstance.netlist &&
                      (selectedInstance.netlist.binding?.kind === "model" ||
                        selectedDevice?.targetPolicy === "required-model" ||
                        selectedExternalMosMapping)
                        ? {
                            defaultValue:
                              selectedInstance.netlist.binding?.kind === "model"
                                ? selectedInstance.netlist.binding.name
                                : selectedExternalMosMapping
                                  ? (selectedExternalSubcircuit?.name ?? "")
                                  : "",
                            suggestions:
                              selectedPropertyDevice?.symbolId === "nmos" ||
                              selectedPropertyDevice?.symbolId === "pmos"
                                ? reviewedSky130MosModelSuggestions(
                                    selectedPropertyDevice.symbolId,
                                  )
                                : [],
                            ...(selectedPropertyDevice?.symbolId === "nmos" ||
                            selectedPropertyDevice?.symbolId === "pmos"
                              ? {
                                  listId: `mos-model-options-${selectedPropertyDevice.symbolId}`,
                                }
                              : {}),
                            externalSubcircuit: Boolean(
                              selectedExternalMosMapping,
                            ),
                          }
                        : null
                    }
                    onMarkerNameChange={(value) =>
                      commitElectricalMarkerName(selectedInstance.id, value)
                    }
                    onSchematicNameChange={updateSelectedSchematicName}
                    onReferenceChange={updateSelectedReference}
                    onModelTargetChange={updateSelectedModelTarget}
                  />
                  <ComponentElectricalProperties
                    instance={selectedInstance}
                    parameters={propertyParametersForInstance(selectedInstance)}
                    parameterValues={instancePropertyDraft.parameters}
                    firstInputRef={instanceValueInputRef}
                    referenceVisible={
                      selectedInstanceLabel !== undefined &&
                      selectedInstanceLabel.visible !== false
                    }
                    valueVisible={
                      selectedInstanceValue !== null &&
                      selectedInstanceValue.visible !== false
                    }
                    valueAvailable={selectedInstanceValueAvailable}
                    additionalParameters={additionalParameterDraft}
                    additionalParametersChanged={
                      additionalParameterDraftChanges
                    }
                    onParameterChange={(key, value) =>
                      updateInstancePropertyDraft((current) => ({
                        ...current,
                        parameters: {
                          ...current.parameters,
                          [key]: value,
                        },
                      }))
                    }
                    onReferenceVisibilityChange={(checked) =>
                      setReferenceLabelsVisible([selectedInstance.id], checked)
                    }
                    onValueVisibilityChange={(checked) => {
                      if (checked) showSelectedInstanceValue();
                      else setValueLabelsVisible([selectedInstance.id], false);
                    }}
                    onAdditionalParameterChange={updateAdditionalParameter}
                    onAdditionalParameterRemove={removeAdditionalParameter}
                    onAdditionalParameterAdd={addAdditionalParameter}
                    onAdditionalParametersApply={applyAdditionalParameters}
                    onAdditionalParametersCancel={cancelAdditionalParameters}
                  />
                  <ComponentPlacementProperties
                    instance={selectedInstance}
                    x={instancePropertyDraft.x}
                    y={instancePropertyDraft.y}
                    rotation={instancePropertyDraft.rotation}
                    draftChanged={hasInstancePropertyDraftChanges}
                    onXChange={(x) =>
                      updateInstancePropertyDraft((current) => ({
                        ...current,
                        x,
                      }))
                    }
                    onYChange={(y) =>
                      updateInstancePropertyDraft((current) => ({
                        ...current,
                        y,
                      }))
                    }
                    onRotate={() =>
                      editorCommands.execute({ id: "transform.rotate" })
                    }
                    onMirror={(direction) =>
                      editorCommands.execute({
                        id: "transform.mirror",
                        direction,
                      })
                    }
                    onReturnToTray={() =>
                      returnInstancesToTray([selectedInstance.id])
                    }
                    {...(differentialOutputSibling(selectedInstance.symbolId)
                      ? {
                          onSwapOutputs: () =>
                            transact(
                              planDifferentialOutputSwap(
                                selectedInstance.id,
                                selectedInstance.symbolId,
                              ),
                            ),
                        }
                      : {})}
                    {...(selectedInstanceHasDifferentialInputs &&
                    differentialInputSibling(selectedInstance.symbolId)
                      ? {
                          onSwapInputs: () =>
                            transact(
                              planDifferentialInputSwap(
                                selectedInstance.id,
                                selectedInstance.symbolId,
                              ),
                            ),
                        }
                      : {})}
                    onDiscard={discardInstancePropertyDraft}
                  />
                </section>
              ) : null}
              {selectedDrafting ? (
                <DraftingPropertiesPanel
                  document={document}
                  resolver={resolver}
                  object={selectedDrafting}
                  inspectorSegment={draftingInspectorSegment}
                  tangentInput={draftingTangentInput}
                  bearingInput={draftingBearingInput}
                  onInspectorSegmentChange={setDraftingInspectorSegment}
                  onTangentInputChange={setDraftingTangentInput}
                  onBearingInputChange={setDraftingBearingInput}
                  onStyleChange={setDraftingStyle}
                  onTangentAngleChange={setDraftingTangentAngle}
                  onBearingChange={setDraftingBearing}
                  onReverse={reverseSelectedDrafting}
                  onRotate={() =>
                    editorCommands.execute({ id: "transform.rotate" })
                  }
                  onToggleLock={() => toggleDraftingLock(selectedDrafting)}
                />
              ) : null}
              <PlacementTrayPanel
                document={document}
                unplaced={unplaced}
                returnablePlaced={returnablePlacedInstances}
                onPlaceAll={placeAllFromTray}
                onReturnAll={returnInstancesToTray}
                onSelect={(instance, label) => {
                  selectOnly("instance", [instance.id]);
                  setStatus(`Selected ${label}`);
                }}
                onPlace={beginRetainedInstancePlacementFromHook}
              />
              <RouteActionsSection
                active={selectedRouteId !== null}
                netLabelInputRef={netLabelPropertyInputRef}
                netLabel={netLabelDraft}
                highlightActive={selectedHighlightIsActive}
                onNetLabelChange={updateNetLabelDraft}
                onDeleteNetLabel={deleteSelectedRouteNetLabel}
                onAddCurrentArrow={addCurrentArrow}
                onToggleHighlight={toggleHighlightedNet}
                onDeleteWire={deleteSelectedRouteConnection}
              />
              <EndpointActionsSection
                kind={
                  selectedEndpoint
                    ? selectedEndpoint.endpoint.kind === "junction"
                      ? "junction"
                      : "terminal"
                    : null
                }
                noConnect={Boolean(selectedNoConnect)}
                endpointNetId={selectedEndpointNetId}
                onDisconnect={() => disconnectSelectedEndpoint(false)}
                onDeleteConnection={() => disconnectSelectedEndpoint(true)}
                onToggleNoConnect={toggleSelectedNoConnectFromSelection}
                onDeleteJunction={deleteSelectedJunctionFromSelection}
              />
              <AnnotationActionsSection
                kind={
                  selectedAnnotation && isRoutedMarker(selectedAnnotation)
                    ? "current-arrow"
                    : selectedAnnotation && selectedNetLabelBinding
                      ? "net-label"
                      : null
                }
                highlightActive={selectedHighlightIsActive}
                onReverseCurrentArrow={reverseSelectedCurrentArrow}
                onDeleteCurrentArrow={deleteSelectedAnnotation}
                onToggleHighlight={toggleHighlightedNet}
              />
              <ProjectDiagnosticsSection
                snapshot={liveDiagnosticSnapshot}
                documentLabel={(documentId) =>
                  project.documents.find(
                    (candidate) => candidate.id === documentId,
                  )?.name ?? documentId
                }
                onSelectDiagnostic={jumpToProjectDiagnostic}
              />
              {highlightedTrace && highlightedTrace.hops.length > 0 ? (
                <NetTraceSection
                  trace={highlightedTrace}
                  documentLabel={(documentId) =>
                    project.documents.find(
                      (candidate) => candidate.id === documentId,
                    )?.name ?? documentId
                  }
                  onNavigateHop={navigateTraceHop}
                />
              ) : null}
              {importReviewOpen ? (
                <section className="import-review" aria-label="Import Review">
                  <h2>Import Review</h2>
                  <SelectionInspectorDetails
                    snapshot={{
                      selected:
                        selectedIds.length > 0
                          ? selectedIds.join(", ")
                          : (selectedRouteId ?? selectedAnnotationId ?? "None"),
                      internalRouteCount: internalSelection.routeIds.length,
                      revision: document.revision,
                      sourceStatus: document.sourceStatus,
                      documentCount: project.documents.length,
                      activeDocumentId: document.id,
                      activeInstanceCount: document.instances.length,
                      projectInstanceCount,
                      netCount: document.nets.length,
                      tool,
                      flightlineCount: flightlines.length,
                      crossingCount: crossings.length,
                      annotationCount: document.annotations.length,
                      status,
                    }}
                    importReport={importReport}
                  />
                </section>
              ) : null}
              <Suspense fallback={null}>
                {publicAgentUiEnabled &&
                agentSession.status !== "idle" &&
                !agentStatusDismissed ? (
                  <LazyAgentPropertiesSection
                    status={agentSession.status}
                    claimCode={agentSession.claimCode}
                    claimExpiresAt={agentSession.claimExpiresAt}
                    scopes={agentSession.scopes}
                    expiresAt={agentSession.expiresAt}
                    error={agentSession.error}
                    onPause={agentSession.pause}
                    onResume={agentSession.resume}
                    onReconnect={agentSession.reconnect}
                    onNewConnection={agentSession.newConnection}
                    onRevoke={agentSession.revoke}
                    expanded={agentDetailsOpen}
                    onToggleDetails={() => setAgentDetailsOpen((open) => !open)}
                    onDismiss={() => {
                      setAgentDetailsOpen(false);
                      setAgentStatusDismissed(true);
                    }}
                  />
                ) : null}
              </Suspense>
            </div>
          </section>
        </aside>
        <section className="canvas-panel">
          {canvasIsEmpty ? (
            <div
              className="canvas-empty-state"
              data-testid="canvas-empty-state"
            >
              <strong>Start a schematic</strong>
              <span>
                Press <kbd>I</kbd> to insert a component or <kbd>W</kbd> to
                wire.
              </span>
            </div>
          ) : null}
          <svg
            className={[
              "schematic-canvas",
              tool === "wire" ? "wire-mode" : "",
              pendingSymbolId || vddRailMode || copyPlacement
                ? "component-mode"
                : "",
              tool === "arrow" ||
              tool === "construction-line" ||
              tool === "rectangle"
                ? "drawing-mode"
                : "",
              projectedMovePreviewDocument ? "semantic-move-preview" : "",
              panPreview ? "pan-mode" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-testid="schematic-canvas"
            role="img"
            aria-label="Schematic canvas"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            onWheel={handleWheel}
            onClickCapture={(event) => {
              const currentInteraction = getCurrentInteractionState();
              if (currentInteraction.kind === "moving-selection") {
                if (event.detail === 1) {
                  event.preventDefault();
                  event.stopPropagation();
                  commitCommandMoveFromSelection(
                    pointFromClient(
                      event.clientX,
                      event.clientY,
                      event.currentTarget,
                    ),
                    { x: event.clientX, y: event.clientY },
                    event.currentTarget,
                  );
                }
                return;
              }
              if (currentInteraction.kind === "copy-placement") {
                if (event.detail > 1) return;
                event.preventDefault();
                event.stopPropagation();
                const point = pointFromClient(
                  event.clientX,
                  event.clientY,
                  event.currentTarget,
                );
                commitCopyPlacementFromSelection({
                  x: snapCoordinate(point.x, document.presentation.grid),
                  y: snapCoordinate(point.y, document.presentation.grid),
                });
                return;
              }
              if (
                !vddRailMode &&
                (!pendingSymbolId || !pendingComponentPlacement)
              )
                return;
              if (event.detail > 1) return;
              event.stopPropagation();
              const rawPoint = pointFromClient(
                event.clientX,
                event.clientY,
                event.currentTarget,
              );
              commitPendingPlacementAtFromHook({
                x: snapCoordinate(rawPoint.x, document.presentation.grid),
                y: snapCoordinate(rawPoint.y, document.presentation.grid),
              });
            }}
            onPointerDownCapture={(event) => {
              const target = event.target as Element;
              if (target.closest('[data-testid="canvas-text-editor"]')) {
                // The SVG capture layer otherwise re-ranks the canvas below
                // this HTML editor through elementsFromPoint() before the
                // editor's own bubbling handlers can stop the event.
                return;
              }
              if (
                cellSymbolLayoutEnabled &&
                target.closest('[data-testid="cell-symbol-layout-overlay"]')
              ) {
                return;
              }
              if (cellSymbolLayoutEnabled) {
                // Layout grips are a short-lived edit mode. Any ordinary
                // canvas action leaves it first, so the next hit can use the
                // regular selection and movement rules.
                exitCellSymbolLayout();
              }
              if (getCurrentInteractionState().kind === "moving-selection") {
                event.stopPropagation();
                return;
              }
              if (
                selectedDrafting &&
                (selectedDrafting.kind === "arrow" ||
                  selectedDrafting.kind === "construction-line" ||
                  selectedDrafting.kind === "rectangle") &&
                !target.closest(
                  `[data-testid="drafting-hit-${selectedDrafting.id}"]`,
                ) &&
                !target.closest(
                  `[data-testid="drafting-handles-${selectedDrafting.id}"]`,
                )
              ) {
                replaceSelectionKind("drafting", []);
              }
              handleCanvasHitPointerDown(event);
            }}
            onPointerDown={beginCanvasGesture}
            onPointerMove={continueCanvasGesture}
            onPointerLeave={() => {
              const currentInteraction = getCurrentInteractionState();
              if (pendingSymbolId) setComponentPreviewPoint(null);
              if (vddRailMode) setVddRailPreviewPoint(null);
              if (currentInteraction.kind === "copy-placement") {
                setCopyPreviewPoint(null);
              }
            }}
            onPointerUp={finishCanvasGesture}
            onPointerCancel={finishCanvasGesture}
            onClick={(event) => {
              const target = event.target as Element;
              const onBackground =
                target === event.currentTarget || target.tagName === "rect";
              if (
                (tool === "arrow" ||
                  tool === "construction-line" ||
                  tool === "rectangle") &&
                event.detail === 1 &&
                onBackground
              ) {
                handleDraftingCanvasClick(
                  pointFromClient(
                    event.clientX,
                    event.clientY,
                    event.currentTarget,
                  ),
                  event.altKey,
                  event.shiftKey,
                  logicalRadiusForPixels(
                    event.currentTarget,
                    SNAP_CAPTURE_RADIUS_PX,
                  ),
                );
                return;
              }
              if (tool !== "wire" || event.detail !== 1) return;
              applyWireCanvasPoint(
                pointFromClient(
                  event.clientX,
                  event.clientY,
                  event.currentTarget,
                  false,
                ),
                event.currentTarget,
                event.altKey,
                false,
              );
            }}
            onDoubleClick={(event) => {
              const target = event.target as Element;
              if (tool === "pointer") {
                // Movement ranks electrical geometry before labels, but a
                // deliberate double-click is an editing request. Look through
                // the same point candidates for text instead of forcing users
                // to Alt-cycle a route-attached label before editing it.
                const pointHits = rankCanvasHits(
                  event.currentTarget.ownerDocument.elementsFromPoint(
                    event.clientX,
                    event.clientY,
                  ),
                );
                const annotationHit = pointHits.find(
                  (hit) => hit.kind === "annotation",
                );
                const annotation = annotationHit
                  ? document.annotations.find(
                      (candidate) => candidate.id === annotationHit.id,
                    )
                  : undefined;
                if (annotation) {
                  event.preventDefault();
                  event.stopPropagation();
                  canvasDragSessionRef.current?.cancel();
                  beginAnnotationTextEditing(annotation);
                  return;
                }
                // A double-click on empty space inside a drafting rectangle is
                // the same editing intent aimed at the box: open its centered
                // label, creating the anchored text on first use. Electrical
                // geometry under the pointer keeps its own double-click
                // meaning, so wires crossing a group frame never open a label.
                const electricalHit = pointHits.some(
                  (hit) =>
                    hit.kind !== "annotation" &&
                    hit.kind !== "instance-label" &&
                    hit.kind !== "drafting",
                );
                const interiorPoint = pointFromClient(
                  event.clientX,
                  event.clientY,
                  event.currentTarget,
                );
                const rectangle = electricalHit
                  ? null
                  : rectangleInteriorAt(document, resolver, interiorPoint);
                if (rectangle) {
                  event.preventDefault();
                  event.stopPropagation();
                  canvasDragSessionRef.current?.cancel();
                  const existingLabel = rectangleLabelFor(
                    document,
                    rectangle.id,
                  );
                  if (existingLabel) {
                    beginDraftingTextEditing(existingLabel);
                    return;
                  }
                  uniqueSuffixCounter.current += 1;
                  const label = proposeRectangleLabel(
                    rectangle,
                    `note-${uniqueSuffixCounter.current}`,
                  );
                  if (
                    transact([
                      { kind: "upsert_drafting_object", object: label },
                    ]).ok
                  ) {
                    beginDraftingTextEditing(label);
                    setStatus(`Editing label of ${rectangle.id}`);
                  }
                  return;
                }
              }
              if (
                tool === "arrow" ||
                tool === "construction-line" ||
                tool === "rectangle"
              ) {
                if (target !== event.currentTarget && target.tagName !== "rect")
                  return;
                finishDraftingCreate();
                return;
              }
              if (tool !== "wire") return;
              // A double-click ends the wire wherever it lands. The guard
              // below only lets background presses through, so finishing on a
              // Junction or an existing Route never reached this handler and
              // drafting appeared to continue.
              if (wireSource && wireDraftSteps.length === 0) {
                // Landing on an endpoint or Route commits on the first press;
                // the second press then opens a fresh wire at that same spot.
                // No authored step is what separates it from a real wire.
                completeWire();
                setStatus("Wire finished · Esc exits");
                return;
              }
              if (target !== event.currentTarget && target.tagName !== "rect")
                return;
              const point = pointFromClient(
                event.clientX,
                event.clientY,
                event.currentTarget,
                false,
              );
              const resolved = resolveWireCanvasSnap(
                point,
                event.currentTarget,
                event.altKey,
              );
              // Landing on an endpoint or an existing Route commits on the
              // first press of the double-click, and the second press then
              // opens a fresh wire at that same spot. Such a source has no
              // authored step yet, which is what separates it from a real
              // wire being finished here — so end the session instead of
              // drawing on from it.
              if (
                wireSource &&
                wireDraftSteps.length === 0 &&
                wireSource.connection.contactPoint.x === resolved.point.x &&
                wireSource.connection.contactPoint.y === resolved.point.y
              ) {
                completeWire();
                setStatus("Wire finished · Esc exits");
                return;
              }
              if (
                wireSource?.endpoint.kind === "junction" &&
                wireSource.preludeEdits.some(
                  (edit) => edit.kind === "add_junction" && edit.createNet,
                ) &&
                wireSource.connection.contactPoint.x === resolved.point.x &&
                wireSource.connection.contactPoint.y === resolved.point.y
              ) {
                setStatus("Wire finished · Esc exits");
                completeWire();
                return;
              }
              applyWireCanvasPoint(
                point,
                event.currentTarget,
                event.altKey,
                true,
              );
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              if (
                tool === "arrow" ||
                tool === "construction-line" ||
                tool === "rectangle"
              ) {
                if (draftingSource !== null) {
                  clearDraftingCreate();
                  setStatus("Drawing cancelled");
                }
                return;
              }
              if (tool === "wire") {
                setWireSource(null, null);
                setWirePreviewPoint(null);
                setWireDraftSteps([]);
                setTool("pointer");
                setBulkDrawInstanceId(null);
                setStatus("Wire cancelled");
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <CanvasGridOverlay visible={gridDotsVisible} viewBox={viewBox} />
            <g dangerouslySetInnerHTML={sceneInnerHtml} />
            {selectedCellSymbolLayout ? (
              <EditorCellSymbolLayoutOverlay
                placement={selectedCellSymbolLayout.instance.placement!}
                body={selectedCellSymbolLayout.body}
                pins={selectedCellSymbolLayout.pins.map(
                  ({ terminal, pin }) => ({
                    terminalId: terminal.id,
                    pin,
                  }),
                )}
                onDragStart={beginCellSymbolLayoutDrag}
              />
            ) : null}
            <NetHighlightOverlay
              highlight={highlightedNet}
              document={document}
              resolver={resolver}
              routeGeometryRecords={routeGeometryRecords}
            />
            {copyPreviewInnerHtml !== null ? (
              <g
                data-testid="copy-placement-preview"
                className="copy-placement-preview"
                dangerouslySetInnerHTML={copyPreviewInnerHtml}
              />
            ) : null}
            <CanvasInputPlanes
              tool={tool}
              viewBox={viewBox}
              componentPlacementActive={Boolean(
                pendingSymbolId || vddRailMode || copyPlacement,
              )}
              copyPlacementActive={copyPlacement !== null}
            />
            <g data-layer="editor-overlay">
              <EditorPlacementPreview
                vddRailMode={vddRailMode}
                vddRailStart={vddRailStart}
                previewPoint={componentPreviewPoint}
                powerRailStrokeWidth={styleProfile.strokes.powerRail}
                styleProfileId={document.presentation.styleProfileId}
                pendingSymbolId={pendingSymbolId}
                {...(pendingPlacementSymbol
                  ? { pendingSymbol: pendingPlacementSymbol }
                  : {})}
                rotation={componentPlacementRotation}
                mirror={componentPlacementMirror}
              />
              <EditorWiringOverlay
                netLabelEditorOpen={netLabelEditorOpen}
                selectedRouteId={selectedRouteId}
                selectedRouteSegmentIndex={selectedRouteSegmentIndex}
                routeGeometryRecords={routeGeometryRecords}
                netLabelDraft={netLabelDraft}
                netLabelEditorInputRef={netLabelEditorInputRef}
                onNetLabelDraftChange={updateNetLabelDraft}
                onNetLabelSubmit={commitNetLabelEditing}
                onNetLabelEscape={() => {
                  applyNetLabel();
                  setNetLabelEditorOpen(false);
                }}
                flightlines={displayedFlightlines}
                onFlightlineClick={handleFlightline}
                wireDraftPoints={wireDraftPoints}
                bulkRoutePreview={
                  wireSource?.routePresentation === "bulk-dashed"
                }
                snapGuideLayerRef={snapGuideLayerRef}
              />
              <EditorRouteHandles
                document={document}
                routeGeometryRecords={routeGeometryRecords}
                selectedRouteId={selectedRouteId}
                selectedRouteSegmentIndex={selectedRouteSegmentIndex}
                routeStretchPreview={routeStretchPreview}
                tool={tool}
                onHandlePointerDown={(event, routeId, segmentIndex, intent) => {
                  const primaryInstanceId = selectedIds.at(-1);
                  if (
                    primaryInstanceId &&
                    compositeSelectionOwnsHit("route", routeId)
                  ) {
                    beginMoveFromSelection(event, primaryInstanceId);
                    return;
                  }
                  beginRouteStretch(event, routeId, segmentIndex, intent);
                }}
              />
              <EditorSelectionHitTargets
                document={document}
                resolver={resolver}
                routeGeometryRecords={routeGeometryRecords}
                styleProfile={styleProfile}
                tool={tool}
                selectedInstanceIds={selectedIds}
                selectedRouteId={selectedRouteId}
                supplementalRouteIds={supplementalSelection.routeIds}
                selectedInternalRouteIds={selectedInternalRouteIds}
                selectedAnnotationId={selectedAnnotationId}
                supplementalAnnotationIds={supplementalSelection.annotationIds}
                cellSymbolLayoutInstanceId={
                  cellSymbolLayoutEnabled
                    ? (selectedInstance?.id ?? null)
                    : null
                }
                onInstanceClick={(instance, additive) => {
                  if (suppressInstanceClick.current) {
                    suppressInstanceClick.current = false;
                    return;
                  }
                  selectInstanceFromSelection(instance.id, additive);
                }}
                onInstanceOpen={(instance) => {
                  if (referencedDocumentId(project, instance))
                    enterHierarchy(instance.id);
                  else inspectInstance(instance.id);
                }}
                onInstancePointerDown={(event, instance) =>
                  beginMoveFromSelection(event, instance.id)
                }
                onRoutePointerDown={handleRoutePointerDown}
                onAnnotationPointerDown={beginAnnotationDrag}
                onAnnotationEdit={beginAnnotationTextEditing}
              >
                <EditorEndpointHitTargets
                  document={document}
                  endpoints={wiringEndpoints}
                  tool={tool}
                  selectedRoute={selectedRoute}
                  selectedRouteSegmentIndex={selectedRouteSegmentIndex}
                  selectedEndpoint={selectedEndpoint}
                  supplementalJunctionIds={supplementalSelection.junctionIds}
                  endpointLabel={endpointTestId}
                  onEndpointActions={(candidate) => {
                    selectEndpoint(candidate);
                    setStatus(
                      `Endpoint actions: ${endpointTestId(candidate.endpoint)}`,
                    );
                  }}
                  onPowerRailStretch={beginRouteStretch}
                  onJunctionSelect={(candidate) => {
                    selectEndpoint(candidate);
                    setStatus(`Selected ${endpointTestId(candidate.endpoint)}`);
                  }}
                  onWireEndpoint={handleWireEndpoint}
                />
              </EditorSelectionHitTargets>
              <EditorDraftingHitTargets
                document={document}
                resolver={resolver}
                tool={tool}
                selectedDraftingId={selectedDraftingId}
                supplementalDraftingIds={supplementalSelection.draftingIds}
                onPointerDown={(event, object, draggable) => {
                  if (draggable) beginDraftingDrag(event, object);
                  else {
                    event.stopPropagation();
                    selectDraftingObject(object.id);
                  }
                }}
                onConstructionLineEdit={(event, object) => {
                  event.stopPropagation();
                  insertConstructionVertex(
                    object,
                    pointFromClient(
                      event.clientX,
                      event.clientY,
                      event.currentTarget.ownerSVGElement!,
                    ),
                  );
                }}
                onArrowEdit={(event, object) => {
                  event.stopPropagation();
                  insertArrowWaypoint(
                    object,
                    pointFromClient(
                      event.clientX,
                      event.clientY,
                      event.currentTarget.ownerSVGElement!,
                    ),
                  );
                }}
                onTextEdit={beginDraftingTextEditing}
              />
              <EditorDraftingHandles
                document={document}
                resolver={resolver}
                selectedDraftingId={selectedDraftingId}
                onHandlePointerDown={beginDraftingHandleDrag}
                onDeleteVertex={deleteConstructionVertex}
              />
              <EditorInteractionPreviews
                boxPreview={boxPreview}
                draftingSource={draftingSource}
                draftingWaypoints={draftingWaypoints}
                draftingHover={draftingHover}
                draftingSnapPoint={draftingSnapPoint}
                tool={tool}
                styleProfile={styleProfile}
                wirePreviewPoint={wirePreviewPoint}
                textEditing={textEditing}
                textEditingBounds={textEditingBounds}
                viewBox={viewBox}
                textEditingLocked={textEditingLocked}
                onTextUpdate={updateTextEditing}
                onTextCommit={commitTextEditing}
                onTextDelete={deleteTextEditing}
                {...(editingAnnotation &&
                isRoutedMarker(editingAnnotation) &&
                effectiveRouteAttachment(editingAnnotation)
                  ? { onReverseCurrentArrow: reverseSelectedCurrentArrow }
                  : {})}
              />
            </g>
          </svg>
        </section>
      </div>
      <EditorStatusbar
        status={status}
        tool={tool}
        vddRailMode={vddRailMode}
        pendingSymbolId={pendingSymbolId}
        wireOptionsOpen={wireOptionsOpen}
        wireRoutingMode={wireRoutingMode}
        wireCornerOrder={wireCornerOrder}
        recoveryLabel={recoveryStateLabel(recoveryState)}
        gridDotsVisible={gridDotsVisible}
        zoomPercent={zoomPercent}
        onToggleWireOptions={() => setWireOptionsOpen((open) => !open)}
        onWireRoutingModeChange={setWireRoutingMode}
        onWireCornerOrderChange={setWireCornerOrder}
        onToggleGridDots={() =>
          setGridDotsVisible((visible) => {
            setStatus(
              visible ? "Background dots hidden" : "Background dots shown",
            );
            return !visible;
          })
        }
        onZoomOut={() => zoomViewAtCenter(1.2)}
        onZoomIn={() => zoomViewAtCenter(0.84)}
        onFitView={() => editorCommands.execute({ id: "view.fit" })}
      />
    </main>
  );
}
