import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  executeProjectTransaction,
  planRemoveCellTerminalMarkers,
} from "@icm/edit-engine";
import { createEmptyProject } from "@icm/model";
import type { CircuitProject, SchematicDocument } from "@icm/model";
import { parseProject } from "@icm/project-protocol";
import { builtInSymbols, createProjectSymbolResolver } from "@icm/symbols";
import { expect, test } from "vitest";

import { proposeVisualSelectionDeletion } from "../selection/delete-selection";
import { copyWholeDocument, proposePaste } from "./clipboard";

interface PlacedScene {
  instanceIds: string[];
  routeIds: string[];
  junctionIds: string[];
  annotationIds: string[];
  draftingIds: string[];
}

function example(name: string): SchematicDocument {
  return parseProject(
    readFileSync(
      resolve(process.cwd(), `apps/editor/src/examples/${name}.icproj.json`),
      "utf8",
    ),
  ).documents[0]!;
}

function addedIds<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[],
): string[] {
  const existing = new Set(before.map((item) => item.id));
  return after.flatMap((item) => (existing.has(item.id) ? [] : [item.id]));
}

function placeScene(
  project: CircuitProject,
  source: SchematicDocument,
  sequence: number,
): { project: CircuitProject; scene: PlacedScene } {
  const document = project.documents[0]!;
  const clipboard = copyWholeDocument(source)!;
  const proposal = proposePaste(
    document,
    clipboard,
    { x: sequence * 4_000, y: 0 },
    sequence,
  );
  expect(proposal.errors).toEqual([]);
  const result = executeProjectTransaction(project, {
    transactionId: `place-gallery-scene-${sequence}`,
    projectId: project.id,
    expectedStructureRevision: project.structureRevision,
    actor: { kind: "human", id: "test" },
    edits: [
      {
        kind: "transact_document",
        documentId: document.id,
        expectedRevision: document.revision,
        edits: proposal.edits,
      },
    ],
  });
  if (!result.ok) throw new Error(JSON.stringify(result, null, 2));
  const placed = result.project.documents[0]!;
  return {
    project: result.project,
    scene: {
      instanceIds: proposal.instanceIds,
      routeIds: addedIds(document.routes, placed.routes),
      junctionIds: addedIds(document.junctions, placed.junctions),
      annotationIds: addedIds(document.annotations, placed.annotations),
      draftingIds: addedIds(
        document.drafting?.objects ?? [],
        placed.drafting?.objects ?? [],
      ),
    },
  };
}

function deleteScene(
  project: CircuitProject,
  scene: PlacedScene,
  sequence: number,
): CircuitProject {
  const document = project.documents[0]!;
  const markerIds = document.netlist!.terminals.flatMap((terminal) =>
    terminal.interfaceInstanceIds.filter((instanceId) =>
      scene.instanceIds.includes(instanceId),
    ),
  );
  const deletionEdits = proposeVisualSelectionDeletion(
    document,
    createProjectSymbolResolver(project, builtInSymbols),
    scene,
    sequence,
  );
  const result = executeProjectTransaction(project, {
    transactionId: `delete-gallery-scene-${sequence}`,
    projectId: project.id,
    expectedStructureRevision: project.structureRevision,
    actor: { kind: "human", id: "test" },
    edits: planRemoveCellTerminalMarkers(
      project,
      document.id,
      markerIds,
      deletionEdits,
    ),
  });
  if (!result.ok) throw new Error(JSON.stringify(result, null, 2));
  return result.project;
}

test("places Gallery A, B, A with name-based interfaces and deletes each scene", () => {
  const sceneA = example("current-mirror-loaded-differential-pair");
  const sceneB = example("fully-differential-two-stage-op-amp");
  const expectedNames = new Set([
    ...sceneA.netlist!.terminals.map((terminal) => terminal.name),
    ...sceneB.netlist!.terminals.map((terminal) => terminal.name),
  ]);
  let project = createEmptyProject("mixed-gallery", "Mixed Gallery");

  const firstA = placeScene(project, sceneA, 1);
  project = firstA.project;
  const onlyB = placeScene(project, sceneB, 2);
  project = onlyB.project;
  const secondA = placeScene(project, sceneA, 3);
  project = secondA.project;

  expect(
    new Set(
      project.documents[0]!.netlist!.terminals.map((terminal) => terminal.name),
    ),
  ).toEqual(expectedNames);
  for (const sourceTerminal of sceneA.netlist!.terminals) {
    expect(
      project.documents[0]!.netlist!.terminals.find(
        (terminal) => terminal.name === sourceTerminal.name,
      )?.interfaceInstanceIds,
    ).toHaveLength(2);
  }
  for (const sourceTerminal of sceneB.netlist!.terminals) {
    expect(
      project.documents[0]!.netlist!.terminals.find(
        (terminal) => terminal.name === sourceTerminal.name,
      )?.interfaceInstanceIds,
    ).toHaveLength(1);
  }

  project = deleteScene(project, onlyB.scene, 1);
  expect(
    project.documents[0]!.netlist!.terminals.map((terminal) => terminal.name),
  ).toEqual(sceneA.netlist!.terminals.map((terminal) => terminal.name));

  project = deleteScene(project, firstA.scene, 2);
  expect(project.documents[0]!.netlist!.terminals).toHaveLength(
    sceneA.netlist!.terminals.length,
  );
  expect(
    project.documents[0]!.netlist!.terminals.every(
      (terminal) => terminal.interfaceInstanceIds.length === 1,
    ),
  ).toBe(true);

  project = deleteScene(project, secondA.scene, 3);
  expect(project.documents[0]).toMatchObject({
    instances: [],
    nets: [],
    routes: [],
    junctions: [],
    annotations: [],
    netlist: { terminals: [] },
  });
});
