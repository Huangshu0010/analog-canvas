import { useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";

import { DocumentHistory } from "@icm/edit-engine";
import type { EditTransactionResult, SchematicEdit } from "@icm/edit-engine";
import {
  CircuitProjectSchema,
  parseProject,
  serializeProject,
} from "@icm/model";
import type {
  CircuitProject,
  Point,
  Rect,
  SchematicDocument,
} from "@icm/model";
import { buildSvgScene, renderDocumentSvg } from "@icm/render-svg";
import { importSpiceSources } from "@icm/spice";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";

import { createDemoProject } from "./demo-project";

const SNAPSHOT_KEY = "icm.phase1.snapshot";
const DEFAULT_VIEWBOX: Rect = { x: 0, y: 0, width: 960, height: 640 };

interface DragPreview {
  instanceId: string;
  originalPosition: Point;
  position: Point;
  pointerId: number;
}

export interface AppProps {
  project?: CircuitProject;
}

function replaceDocument(
  project: CircuitProject,
  document: SchematicDocument,
): CircuitProject {
  return CircuitProjectSchema.parse({
    ...project,
    documents: project.documents.map((candidate) =>
      candidate.id === document.id ? document : candidate,
    ),
  });
}

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function App({ project: initialProject }: AppProps) {
  const resolver = useMemo(
    () => new InMemorySymbolResolver(builtInSymbols),
    [],
  );
  const [project, setProject] = useState(() =>
    CircuitProjectSchema.parse(
      structuredClone(initialProject ?? createDemoProject()),
    ),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState<Rect>(DEFAULT_VIEWBOX);
  const [status, setStatus] = useState("Ready");
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const transactionCounter = useRef(0);
  const history = useRef(new DocumentHistory(project.documents[0]!));
  const document = project.documents.find(
    (candidate) => candidate.id === project.topDocumentId,
  )!;
  const scene = buildSvgScene(document, resolver, { bounds: viewBox });
  const unplaced = document.instances.filter(
    (instance) => instance.placement === null,
  );
  const selected = document.instances.find(
    (instance) => instance.id === selectedId,
  );
  const projectInstanceCount = project.documents.reduce(
    (count, candidate) => count + candidate.instances.length,
    0,
  );

  function applyResult(result: EditTransactionResult): void {
    if (!result.ok) {
      setStatus(`${result.error.code}: ${result.error.message}`);
      return;
    }
    if (result.applied) {
      setProject((current) => replaceDocument(current, result.document));
    }
    setStatus(
      result.applied
        ? `Committed revision ${result.revision}`
        : `Dry run for revision ${result.proposedRevision}`,
    );
  }

  function transact(edits: SchematicEdit[]): void {
    transactionCounter.current += 1;
    applyResult(
      history.current.transact({
        transactionId: `transaction-ui-${transactionCounter.current}`,
        documentId: document.id,
        expectedRevision: history.current.document.revision,
        actor: { kind: "human", id: "human-local" },
        edits,
      }),
    );
  }

  function pointFromClient(
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
  ): Point {
    const grid = document.presentation.grid;
    const matrix = svg.getScreenCTM();
    if (matrix) {
      const clientPoint = svg.createSVGPoint();
      clientPoint.x = clientX;
      clientPoint.y = clientY;
      const localPoint = clientPoint.matrixTransform(matrix.inverse());
      return {
        x: snap(localPoint.x, grid),
        y: snap(localPoint.y, grid),
      };
    }
    const bounds = svg.getBoundingClientRect();
    return {
      x: snap(
        viewBox.x + ((clientX - bounds.left) / bounds.width) * viewBox.width,
        grid,
      ),
      y: snap(
        viewBox.y + ((clientY - bounds.top) / bounds.height) * viewBox.height,
        grid,
      ),
    };
  }

  function handleDrop(event: DragEvent<SVGSVGElement>): void {
    event.preventDefault();
    const instanceId = event.dataTransfer.getData("application/x-icm-instance");
    if (!instanceId) {
      return;
    }
    transact([
      {
        kind: "place_instance",
        instanceId,
        placement: {
          position: pointFromClient(
            event.clientX,
            event.clientY,
            event.currentTarget,
          ),
          rotation: 0,
          mirror: "none",
        },
      },
    ]);
    setSelectedId(instanceId);
  }

  function beginMove(
    event: ReactPointerEvent<SVGCircleElement>,
    instanceId: string,
  ): void {
    event.stopPropagation();
    const instance = document.instances.find(
      (candidate) => candidate.id === instanceId,
    );
    if (!instance?.placement) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(instanceId);
    setDragPreview({
      instanceId,
      originalPosition: instance.placement.position,
      pointerId: event.pointerId,
      position: pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget.ownerSVGElement!,
      ),
    });
  }

  function previewMove(event: ReactPointerEvent<SVGCircleElement>): void {
    if (!dragPreview || dragPreview.pointerId !== event.pointerId) {
      return;
    }
    setDragPreview({
      ...dragPreview,
      position: pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget.ownerSVGElement!,
      ),
    });
  }

  function finishMove(event: ReactPointerEvent<SVGCircleElement>): void {
    if (!dragPreview || dragPreview.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    const position = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    if (
      position.x !== dragPreview.originalPosition.x ||
      position.y !== dragPreview.originalPosition.y
    ) {
      transact([
        { kind: "move_instance", instanceId: dragPreview.instanceId, position },
      ]);
    }
    setDragPreview(null);
  }

  function rotateSelected(): void {
    if (!selected?.placement) {
      return;
    }
    const rotation = ((selected.placement.rotation + 90) % 360) as
      0 | 90 | 180 | 270;
    transact([{ kind: "rotate_instance", instanceId: selected.id, rotation }]);
  }

  function mirrorSelected(): void {
    if (!selected?.placement) {
      return;
    }
    transact([
      {
        kind: "mirror_instance",
        instanceId: selected.id,
        mirror: selected.placement.mirror === "none" ? "x" : "none",
      },
    ]);
  }

  function saveSnapshot(): void {
    localStorage.setItem(SNAPSHOT_KEY, serializeProject(project));
    setStatus(`Saved revision ${document.revision}`);
  }

  function reopenSnapshot(): void {
    const snapshot = localStorage.getItem(SNAPSHOT_KEY);
    if (!snapshot) {
      setStatus("No saved snapshot");
      return;
    }
    try {
      const reopened = parseProject(snapshot);
      const reopenedDocument = reopened.documents.find(
        (candidate) => candidate.id === reopened.topDocumentId,
      )!;
      history.current.reset(reopenedDocument);
      setProject(reopened);
      setSelectedId(null);
      setDragPreview(null);
      setStatus(`Reopened revision ${reopenedDocument.revision}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reopen failed");
    }
  }

  function exportSvg(): void {
    const svg = renderDocumentSvg(document, resolver, { title: project.name });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.replaceAll(/[^a-z0-9]+/giu, "-").toLowerCase()}.svg`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(`Exported revision ${document.revision}`);
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
    const entryCandidates = sourceInputs.filter(
      (input) => input.path.split("/").at(-1)?.toLowerCase() === "circuit.spi",
    );
    if (entryCandidates.length !== 1) {
      setStatus(
        `Select one circuit.spi entry and its local include files; found ${entryCandidates.length}`,
      );
      return;
    }
    setStatus("Importing SPICE sources");
    try {
      const result = await importSpiceSources(
        sourceInputs,
        entryCandidates[0]!.path,
      );
      if (!result.project || !result.successful) {
        const firstError = result.diagnostics.find(
          (item) => item.severity === "error",
        );
        setStatus(firstError?.message ?? "SPICE import failed");
        return;
      }
      const importedDocument = result.project.documents.find(
        (candidate) => candidate.id === result.project!.topDocumentId,
      )!;
      const instanceCount = result.project.documents.reduce(
        (count, candidate) => count + candidate.instances.length,
        0,
      );
      const genericCount = result.project.documents
        .flatMap((candidate) => candidate.instances)
        .filter((instance) =>
          instance.symbolId.startsWith("generic-block-"),
        ).length;
      history.current.reset(importedDocument);
      setProject(result.project);
      setSelectedId(null);
      setDragPreview(null);
      setViewBox(DEFAULT_VIEWBOX);
      setStatus(
        `Imported ${result.project.documents.length} Documents and ${instanceCount} instances; ${genericCount} generic symbols`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "SPICE import failed");
    }
  }

  function zoom(factor: number): void {
    setViewBox((current) => {
      const width = Math.round(current.width * factor);
      const height = Math.round(current.height * factor);
      return {
        x: current.x + Math.round((current.width - width) / 2),
        y: current.y + Math.round((current.height - height) / 2),
        width,
        height,
      };
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Interactive Circuit Maker</h1>
          <p>{project.name}</p>
        </div>
        <div className="toolbar" aria-label="Edit toolbar">
          <button
            type="button"
            onClick={() => transact([{ kind: "undo" }])}
            disabled={!history.current.canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => transact([{ kind: "redo" }])}
            disabled={!history.current.canRedo}
          >
            Redo
          </button>
          <button
            type="button"
            onClick={rotateSelected}
            disabled={!selected?.placement}
          >
            Rotate
          </button>
          <button
            type="button"
            onClick={mirrorSelected}
            disabled={!selected?.placement}
          >
            Mirror
          </button>
          <button type="button" onClick={saveSnapshot}>
            Save snapshot
          </button>
          <button type="button" onClick={reopenSnapshot}>
            Reopen snapshot
          </button>
          <button type="button" onClick={exportSvg}>
            Export SVG
          </button>
          <label className="file-import">
            Import SPICE
            <input
              data-testid="spice-files"
              type="file"
              accept=".spi,.cir,.sp,.inc,.lib"
              multiple
              onChange={(event) =>
                void importSpiceFiles(event.currentTarget.files)
              }
            />
          </label>
        </div>
      </header>
      <aside className="side-panel" aria-label="Unplaced instances">
        <h2>Unplaced Instances</h2>
        {unplaced.length === 0 ? <p>All instances placed</p> : null}
        {unplaced.map((instance) => (
          <button
            type="button"
            draggable
            data-testid={`unplaced-${instance.id}`}
            key={instance.id}
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "application/x-icm-instance",
                instance.id,
              );
              event.dataTransfer.effectAllowed = "move";
            }}
          >
            {instance.id} · {instance.symbolId}
          </button>
        ))}
        <dl className="inspector">
          <dt>Selected</dt>
          <dd>{selectedId ?? "None"}</dd>
          <dt>Revision</dt>
          <dd data-testid="revision">{document.revision}</dd>
          <dt>Documents</dt>
          <dd data-testid="document-count">{project.documents.length}</dd>
          <dt>Instances</dt>
          <dd data-testid="instance-count">{projectInstanceCount}</dd>
          <dt>Status</dt>
          <dd data-testid="status">{status}</dd>
        </dl>
      </aside>
      <section className="canvas-panel">
        <div className="viewport-toolbar" aria-label="Viewport toolbar">
          <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom in">
            +
          </button>
          <button
            type="button"
            onClick={() => zoom(1.25)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() =>
              setViewBox((current) => ({ ...current, x: current.x - 50 }))
            }
          >
            Pan left
          </button>
          <button type="button" onClick={() => setViewBox(DEFAULT_VIEWBOX)}>
            Fit
          </button>
        </div>
        <svg
          className="schematic-canvas"
          data-testid="schematic-canvas"
          role="img"
          aria-label="Schematic canvas"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          onClick={() => setSelectedId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <defs>
            <pattern
              id="grid"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="0" cy="0" r="0.7" fill="#d8d8d2" />
            </pattern>
          </defs>
          <rect
            x={viewBox.x}
            y={viewBox.y}
            width={viewBox.width}
            height={viewBox.height}
            fill="url(#grid)"
          />
          <g dangerouslySetInnerHTML={{ __html: scene.formalBody }} />
          <g data-layer="editor-overlay">
            {document.instances
              .filter((instance) => instance.placement !== null)
              .map((instance) => (
                <circle
                  key={instance.id}
                  data-testid={`hit-${instance.id}`}
                  cx={instance.placement!.position.x}
                  cy={instance.placement!.position.y}
                  r="36"
                  className={
                    selectedId === instance.id
                      ? "hit-target selected"
                      : "hit-target"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(instance.id);
                  }}
                  onPointerDown={(event) => beginMove(event, instance.id)}
                  onPointerMove={previewMove}
                  onPointerUp={finishMove}
                />
              ))}
            {dragPreview ? (
              <circle
                className="drag-preview"
                cx={dragPreview.position.x}
                cy={dragPreview.position.y}
                r="34"
              />
            ) : null}
          </g>
        </svg>
      </section>
    </main>
  );
}
