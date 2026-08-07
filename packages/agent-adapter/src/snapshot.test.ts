import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject } from "@icm/model";
import type { CircuitProject } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  AgentCircuitRequestSchema,
  AgentSessionSnapshotSchema,
} from "./schema.js";
import {
  buildAgentSessionSnapshot,
  canonicalSnapshotContent,
} from "./snapshot.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

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

describe("Agent Document Snapshot", () => {
  it("provides complete bidirectional topology and presentation facts", () => {
    const project = fixtureProject();
    const document = project.documents[0]!;
    const snapshot = buildAgentSessionSnapshot({
      project,
      document,
      resolver,
    });

    expect(AgentSessionSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.document.revision).toBe(document.revision);
    expect(snapshot.document.presentation).toEqual(document.presentation);
    expect(snapshot.document.routes[0]).toMatchObject({
      from: expect.any(Object),
      to: expect.any(Object),
      waypoints: expect.any(Array),
      segmentModes: expect.any(Array),
      polyline: expect.any(Array),
    });
    expect(snapshot.document.layoutGroups[0]?.objectIds.length).toBeGreaterThan(
      0,
    );

    const m1 = snapshot.document.instances.find((item) => item.id === "M1")!;
    expect(m1.pins.find((pin) => pin.name === "G")).toMatchObject({
      netId: "net-vinp",
      pagePosition: expect.any(Object),
    });
    const vinp = snapshot.document.nets.find((item) => item.id === "net-vinp")!;
    expect(vinp.terminals).toContainEqual({ instanceId: "M1", pinName: "G" });

    for (const instance of snapshot.document.instances) {
      for (const pin of instance.pins) {
        if (!pin.netId) continue;
        const net = snapshot.document.nets.find(
          (candidate) => candidate.id === pin.netId,
        );
        expect(net?.terminals).toContainEqual({
          instanceId: instance.id,
          pinName: pin.name,
        });
      }
    }
    for (const net of snapshot.document.nets) {
      for (const terminal of net.terminals) {
        const instance = snapshot.document.instances.find(
          (candidate) => candidate.id === terminal.instanceId,
        );
        expect(instance).toBeDefined();
        expect(
          instance?.pins.find((pin) => pin.name === terminal.pinName)?.netId,
        ).toBe(net.id);
      }
    }

    const canonical = canonicalSnapshotContent({
      project: snapshot.project,
      document: snapshot.document,
    });
    expect(snapshot.byteLength).toBe(Buffer.byteLength(canonical, "utf8"));
    expect(snapshot.topologyHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("is deterministic across persisted collection order and resolves references", () => {
    const project = fixtureProject();
    const parent = project.documents[0]!;
    parent.instances[0]!.properties["spice.target"] = "subcircuit:child";
    const child = structuredClone(parent);
    child.id = "document-child";
    child.name = "child";
    child.instances = [];
    child.nets = [];
    child.routes = [];
    child.junctions = [];
    child.annotations = [];
    child.layoutGroups = [];
    child.constraints = [];
    project.documents.push(child);

    const first = buildAgentSessionSnapshot({
      project,
      document: parent,
      resolver,
    });
    const reordered = structuredClone(project);
    const reorderedParent = reordered.documents.find(
      (document) => document.id === parent.id,
    )!;
    reorderedParent.instances.reverse();
    reorderedParent.nets.reverse();
    reorderedParent.routes.reverse();
    reorderedParent.ports.reverse();
    reorderedParent.annotations.reverse();
    reordered.documents.reverse();
    const second = buildAgentSessionSnapshot({
      project: reordered,
      document: reorderedParent,
      resolver,
    });

    expect(second.topologyHash).toBe(first.topologyHash);
    expect(
      first.project.documents.find((document) => document.id === parent.id)
        ?.references,
    ).toContainEqual({
      instanceId: "M1",
      targetName: "child",
      targetDocumentId: "document-child",
    });
  });

  it("cannot be submitted as a mutation request", () => {
    const project = fixtureProject();
    const snapshot = buildAgentSessionSnapshot({
      project,
      document: project.documents[0]!,
      resolver,
    });
    expect(
      AgentCircuitRequestSchema.safeParse({
        apiVersion: "2.0",
        requestId: "replace-document",
        operation: "transact",
        documentId: snapshot.document.id,
        expectedRevision: snapshot.document.revision,
        transactionId: "replace-document",
        snapshot,
      }).success,
    ).toBe(false);
  });
});
