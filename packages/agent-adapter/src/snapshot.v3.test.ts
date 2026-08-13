// AP1 tests: API v3 snapshot targets (ADR 0018). These cover exact read/write
// parity for netlist/interface fields, the component catalog, the Project
// target, and v3 service behavior. v2 behavior is covered by snapshot.test.ts
// and service.test.ts.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject } from "@icm/model";
import type { CircuitProject, SchematicDocument } from "@icm/model";
import {
  builtInSymbols,
  deviceNetlistDefinition,
  InMemorySymbolResolver,
} from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { buildAgentCatalogSnapshot } from "./catalog.js";
import {
  AgentSnapshotV3ResponseSchema,
  AgentApiVersionSchema,
} from "./schema.js";
import type { AgentPermissions } from "./schema.js";
import { createAgentCircuitService } from "./service.js";
import {
  buildAgentDocumentSnapshotV3,
  buildAgentProjectSnapshot,
} from "./snapshot.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);
const allPermissions: AgentPermissions = {
  query: true,
  render: true,
  sourceSpans: false,
  edit: { geometry: true, connectivity: true, presentation: true },
};

function fixtureProject(): CircuitProject {
  return parseProject(
    readFileSync(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-5-dense-analog/project.icproj.json",
      ),
      "utf8",
    ),
  );
}

function serviceFixture(project: CircuitProject) {
  let document = structuredClone(project.documents[0]!);
  const service = createAgentCircuitService({
    agentId: "agent-v3-test",
    resolver,
    permissions: allPermissions,
    store: {
      getDocument: () => document,
      commitDocument: (next) => {
        document = next;
      },
      getProject: () => project,
    },
  });
  return { service, getDocument: () => document };
}

describe("Agent v3 document snapshot — exact netlist/interface parity", () => {
  it("surfaces the exact cell interface and every typed instance netlist fact", () => {
    const project = fixtureProject();
    const document = project.documents[0]!;
    const snapshot = buildAgentDocumentSnapshotV3({
      project,
      document,
      resolver,
    });

    expect(snapshot.cellInterface).toEqual({
      name: document.netlist!.name,
      portOrder: [...document.netlist!.portOrder],
    });

    const modelById = new Map(
      document.instances.map((instance) => [instance.id, instance]),
    );
    for (const instanceSnapshot of snapshot.instances) {
      const model = modelById.get(instanceSnapshot.id)!;
      if (model.netlist) {
        expect(instanceSnapshot.netlist).toBeDefined();
        expect(instanceSnapshot.netlist!.reference).toBe(
          model.netlist.reference,
        );
        expect(instanceSnapshot.netlist!.binding).toEqual(
          model.netlist.binding,
        );
        expect(instanceSnapshot.netlist!.parameters).toEqual(
          model.netlist.parameters,
        );
      } else {
        expect(instanceSnapshot.netlist).toBeUndefined();
      }
    }
  });

  it("remains stable across two builds (deterministic ordering)", () => {
    const project = fixtureProject();
    const document = project.documents[0]!;
    const first = buildAgentDocumentSnapshotV3({ project, document, resolver });
    const second = buildAgentDocumentSnapshotV3({
      project,
      document,
      resolver,
    });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("Agent v3 project snapshot", () => {
  it("exposes every document's cell interface, hierarchy edges, and source summary", () => {
    const project = fixtureProject();
    const snapshot = buildAgentProjectSnapshot({ project });

    expect(snapshot.id).toBe(project.id);
    expect(snapshot.name).toBe(project.name);
    expect(snapshot.topDocumentId).toBe(project.topDocumentId);
    expect(snapshot.sourceSummary).toEqual({
      entry: project.source.entry,
      dialect: project.source.dialect,
      sourcePolicy: project.source.sourcePolicy,
      fileCount: project.source.files.length,
    });

    expect(snapshot.documents).toHaveLength(project.documents.length);
    const top = snapshot.documents.find((doc) => doc.isTop)!;
    expect(top.id).toBe(project.topDocumentId);

    const modelById = new Map(project.documents.map((doc) => [doc.id, doc]));
    for (const docSnapshot of snapshot.documents) {
      const model = modelById.get(docSnapshot.id)!;
      expect(docSnapshot.cellInterface).toEqual(
        model.netlist
          ? {
              name: model.netlist.name,
              portOrder: [...model.netlist.portOrder],
            }
          : null,
      );
      expect(docSnapshot.portCount).toBe(model.ports.length);
      expect(docSnapshot.instanceCount).toBe(model.instances.length);
      // Every reference targets a known document id when the binding is typed.
      for (const reference of docSnapshot.references) {
        if (reference.targetDocumentId !== null) {
          expect(modelById.has(reference.targetDocumentId)).toBe(true);
        }
      }
    }
  });
});

describe("Agent v3 component catalog", () => {
  it("publishes every product symbol joined with its netlist device facts", () => {
    const snapshot = buildAgentCatalogSnapshot({
      symbolLibrary: { id: "razavi-symbols", version: "1" },
    });

    const expectedIds = [...builtInSymbols]
      .map((symbol) => symbol.id)
      .sort((left, right) => left.localeCompare(right, "en"));
    expect(snapshot.symbols.map((symbol) => symbol.id)).toEqual(expectedIds);

    const byId = new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol]));
    for (const definition of builtInSymbols) {
      const entry = byId.get(definition.id)!;
      expect(entry.name).toBe(definition.name);
      expect(entry.pins).toEqual(
        definition.pins.map((pin) => ({
          name: pin.name,
          role: pin.role,
          direction: pin.direction,
          visibility: pin.presentation.visibility,
        })),
      );
      const device = deviceNetlistDefinition(definition.id);
      expect(entry.netlist).toEqual(
        device
          ? {
              deviceClass: device.deviceClass,
              referencePrefix: device.referencePrefix,
              pinOrder: [...device.pinOrder],
              targetPolicy: device.targetPolicy,
              requiredParameters: [...device.requiredParameters],
            }
          : undefined,
      );
    }
  });
});

describe("Agent v3 snapshot service behavior", () => {
  it("returns catalog, project, and document targets with the v3 response shape", () => {
    const project = fixtureProject();
    const { service } = serviceFixture(project);

    const catalog = service.handle({
      apiVersion: "3.0",
      requestId: "snap-catalog",
      operation: "snapshot",
      target: "catalog",
    });
    expect(catalog).toMatchObject({
      apiVersion: "3.0",
      operation: "snapshot",
      ok: true,
      target: "catalog",
    });
    expect(AgentSnapshotV3ResponseSchema.parse(catalog)).toEqual(catalog);

    const projectResponse = service.handle({
      apiVersion: "3.0",
      requestId: "snap-project",
      operation: "snapshot",
      target: "project",
    });
    const projectParsed = AgentSnapshotV3ResponseSchema.parse(projectResponse);
    expect(projectParsed.target).toBe("project");
    if (projectParsed.target === "project") {
      expect(projectParsed.project.id).toBe(project.id);
    }

    const document: SchematicDocument = project.documents[0]!;
    const documentResponse = service.handle({
      apiVersion: "3.0",
      requestId: "snap-document",
      operation: "snapshot",
      target: "document",
      documentId: document.id,
    });
    const documentParsed =
      AgentSnapshotV3ResponseSchema.parse(documentResponse);
    expect(documentParsed.target).toBe("document");
    if (documentParsed.target === "document") {
      expect(documentParsed.revision).toBe(document.revision);
      expect(documentParsed.document.cellInterface).toEqual({
        name: document.netlist!.name,
        portOrder: [...document.netlist!.portOrder],
      });
    }
  });

  it("requires a target for v3 snapshots and a documentId for the document target", () => {
    expect([...AgentApiVersionSchema.options]).toContain("3.0");
    const project = fixtureProject();
    const { service } = serviceFixture(project);

    const missingTarget = service.handle({
      apiVersion: "3.0",
      requestId: "snap-no-target",
      operation: "snapshot",
    });
    expect(missingTarget.ok).toBe(false);

    const documentTargetWithoutId = service.handle({
      apiVersion: "3.0",
      requestId: "snap-doc-no-id",
      operation: "snapshot",
      target: "document",
    });
    expect(documentTargetWithoutId.ok).toBe(false);
  });
});
