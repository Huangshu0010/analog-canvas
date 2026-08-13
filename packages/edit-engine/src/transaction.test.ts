import { createEmptyDocument, transformPoint } from "@icm/model";
import {
  defaultInstanceLabelPlacement,
  resolveSchematicStyleProfile,
  visibleSymbolLocalBounds,
} from "@icm/derived";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { executeTransaction } from "./transaction.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

function documentWithInstance() {
  const document = createEmptyDocument("document-main", "Main");
  document.instances.push({
    id: "M1",
    symbolId: "nmos",
    placement: null,
    properties: {},
  });
  return document;
}

function transaction(expectedRevision = 0, dryRun = false) {
  return {
    transactionId: "transaction-test",
    documentId: "document-main",
    expectedRevision,
    actor: { kind: "human" as const, id: "human-test" },
    dryRun,
    edits: [{ kind: "noop" as const, reason: "Phase 0 envelope proof" }],
  };
}

describe("Edit Transaction envelope", () => {
  it("permits a power rail only on a Net established by a VDD symbol", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push({
      id: "VDD1",
      symbolId: "vdd",
      placement: null,
      properties: {},
    });
    document.ports.push(
      {
        id: "rail-left",
        name: "L",
        direction: "passive",
        position: { x: 0, y: 0 },
      },
      {
        id: "rail-right",
        name: "R",
        direction: "passive",
        position: { x: 40, y: 0 },
      },
    );
    document.netlist!.portOrder.push("rail-left", "rail-right");
    document.nets.push({
      id: "net-vdd",
      scope: "global",
      terminals: [{ instanceId: "VDD1", pinName: "P" }],
      ports: ["rail-left", "rail-right"],
    });

    const accepted = executeTransaction(
      document,
      {
        ...transaction(),
        edits: [
          {
            kind: "set_route_points",
            routeId: "rail",
            netId: "net-vdd",
            from: { kind: "port", portId: "rail-left" },
            to: { kind: "port", portId: "rail-right" },
            waypoints: [],
            segmentModes: ["manual"],
            presentation: "power-rail",
          },
        ],
      },
      { symbolResolver: resolver },
    );
    expect(accepted.ok).toBe(true);

    document.nets[0]!.terminals = [];
    const rejected = executeTransaction(
      document,
      {
        ...transaction(),
        edits: [
          {
            kind: "set_route_points",
            routeId: "rail",
            netId: "net-vdd",
            from: { kind: "port", portId: "rail-left" },
            to: { kind: "port", portId: "rail-right" },
            waypoints: [],
            segmentModes: ["manual"],
            presentation: "power-rail",
          },
        ],
      },
      { symbolResolver: resolver },
    );
    expect(rejected).toMatchObject({
      ok: false,
      error: { message: "Power rail rail must belong to a VDD Net" },
    });
  });

  it("sets a Cell bulk default by stable Net id before reconciliation", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push({
      id: "M1",
      symbolId: "nmos",
      placement: null,
      properties: {},
    });
    document.nets.push({
      id: "net-substrate",
      name: "SUBSTRATE",
      scope: "local",
      terminals: [],
      ports: [],
    });
    const result = executeTransaction(
      document,
      {
        ...transaction(),
        edits: [
          { kind: "set_mos_bulk_defaults", nmosNetId: "net-substrate" },
          { kind: "reconcile_mos_bulk", instanceIds: ["M1"] },
        ],
      },
      { symbolResolver: resolver },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.mosBulkDefaults).toEqual({
      nmosNetId: "net-substrate",
    });
    expect(result.document.instances[0]?.mosBulkBinding).toEqual({
      origin: "cell-default",
      netId: "net-substrate",
    });
  });

  it("materializes manual MOS fallback bulk and permits an explicit override", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push({
      id: "M1",
      symbolId: "nmos",
      symbolVariantId: "textbook-3terminal",
      placement: { position: { x: 0, y: 0 }, rotation: 0, mirror: "none" },
      properties: {},
    });
    const reconciled = executeTransaction(
      document,
      {
        ...transaction(),
        edits: [{ kind: "reconcile_mos_bulk", instanceIds: ["M1"] }],
      },
      { symbolResolver: resolver },
    );
    expect(reconciled.ok).toBe(true);
    if (!reconciled.ok) return;
    expect(reconciled.document.instances[0]?.mosBulkBinding).toEqual({
      origin: "product-fallback",
      netId: "net-global-0",
    });
    expect(reconciled.document.nets[0]?.terminals).toContainEqual({
      instanceId: "M1",
      pinName: "B",
    });

    reconciled.document.nets.push({
      id: "net-vbody",
      name: "VBODY",
      scope: "local",
      terminals: [],
      ports: [],
    });
    const overridden = executeTransaction(
      reconciled.document,
      {
        ...transaction(reconciled.document.revision),
        edits: [
          { kind: "clear_mos_bulk_default", instanceId: "M1" },
          {
            kind: "connect_endpoints",
            from: { kind: "terminal", instanceId: "M1", pinName: "B" },
            to: { kind: "terminal", instanceId: "M1", pinName: "B" },
            newNetId: "net-explicit-body",
          },
        ],
      },
      { symbolResolver: resolver },
    );
    expect(overridden.ok).toBe(true);
    if (!overridden.ok) return;
    expect(overridden.document.instances[0]?.mosBulkBinding).toBeUndefined();
    expect(
      overridden.document.nets.find((net) => net.id === "net-global-0")
        ?.terminals,
    ).not.toContainEqual({ instanceId: "M1", pinName: "B" });
  });
  it("accepts Net-id Label bindings and rejects overloaded object ids", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.nets.push({
      id: "net-signal",
      scope: "local",
      terminals: [],
      ports: [],
    });
    const annotation = {
      id: "label-signal",
      kind: "net-label" as const,
      text: "SIGNAL",
      position: { x: 100, y: 100 },
      attachedObjectId: "net-signal",
      offset: { x: 0, y: -8 },
      alignment: "middle" as const,
      rotation: 0 as const,
      locked: false,
    };
    const accepted = executeTransaction(document, {
      ...transaction(),
      edits: [{ kind: "upsert_annotation", annotation }],
    });
    expect(accepted).toMatchObject({ ok: true });

    const rejected = executeTransaction(document, {
      ...transaction(),
      edits: [
        {
          kind: "upsert_annotation",
          annotation: { ...annotation, attachedObjectId: "junction-signal" },
        },
      ],
    });
    expect(rejected).toMatchObject({
      ok: false,
      error: { message: "Net Label attachment is not a Net: junction-signal" },
    });
  });

  it("rejects a stale revision without changing the Document", () => {
    const document = createEmptyDocument("document-main", "Main");
    const before = JSON.stringify(document);
    const result = executeTransaction(document, transaction(8));
    expect(result).toMatchObject({ ok: false, applied: false, revision: 0 });
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_REVISION");
    }
    expect(result.document).toBe(document);
    expect(JSON.stringify(document)).toBe(before);
  });

  it("applies an accepted no-op atomically and advances revision", () => {
    const document = createEmptyDocument("document-main", "Main");
    const result = executeTransaction(document, transaction());
    expect(result).toMatchObject({
      ok: true,
      applied: true,
      revision: 1,
      proposedRevision: 1,
    });
    expect(result.document).not.toBe(document);
    expect(document.revision).toBe(0);
  });

  it("normalizes a power-symbol Net regardless of how the Net was created", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push(
      {
        id: "M2",
        symbolId: "pmos",
        placement: null,
        properties: {},
      },
      {
        id: "VDD3",
        symbolId: "vdd",
        placement: null,
        properties: {},
      },
    );
    const result = executeTransaction(
      document,
      {
        ...transaction(),
        edits: [
          {
            kind: "connect_endpoints",
            from: { kind: "terminal", instanceId: "M2", pinName: "S" },
            to: { kind: "terminal", instanceId: "VDD3", pinName: "P" },
            newNetId: "net-ui-2",
          },
        ],
      },
      { symbolResolver: resolver },
    );

    expect(result).toMatchObject({
      ok: true,
      document: {
        nets: [
          {
            id: "net-ui-2",
            name: "VDD",
            scope: "global",
            terminals: [
              { instanceId: "M2", pinName: "S" },
              { instanceId: "VDD3", pinName: "P" },
            ],
          },
        ],
      },
    });
  });

  it("dry-runs without mutating or advancing the current revision", () => {
    const document = createEmptyDocument("document-main", "Main");
    const result = executeTransaction(document, transaction(0, true));
    expect(result).toMatchObject({
      ok: true,
      applied: false,
      revision: 0,
      proposedRevision: 1,
    });
    // dryRun returns the validated candidate geometry (so callers can inspect
    // proposed Routes), NOT the original Document reference. The original
    // Document must be untouched and the revision un-advanced.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).not.toBe(document);
    expect(document.revision).toBe(0);
    expect(result.document.revision).toBe(1);
  });

  it("rejects the complete transaction when an edit is unknown", () => {
    const document = createEmptyDocument("document-main", "Main");
    const result = executeTransaction(document, {
      ...transaction(),
      edits: [{ kind: "move_instance", instanceId: "M1" }],
    });
    expect(result).toMatchObject({ ok: false, applied: false, revision: 0 });
    expect(result.document).toBe(document);
  });

  it("places and transforms an instance through typed edits", () => {
    const document = documentWithInstance();
    const placed = executeTransaction(document, {
      ...transaction(),
      edits: [
        {
          kind: "place_instance",
          instanceId: "M1",
          placement: {
            position: { x: 100, y: 80 },
            rotation: 0,
            mirror: "none",
          },
        },
      ],
    });
    expect(placed).toMatchObject({
      ok: true,
      applied: true,
      revision: 1,
      diff: { changedObjectIds: ["M1"] },
    });
    if (!placed.ok) {
      throw new Error("Placement unexpectedly failed");
    }

    const transformed = executeTransaction(placed.document, {
      ...transaction(1),
      transactionId: "transaction-transform",
      edits: [
        {
          kind: "move_instance",
          instanceId: "M1",
          position: { x: 120, y: 90 },
        },
        { kind: "rotate_instance", instanceId: "M1", rotation: 90 },
        { kind: "mirror_instance", instanceId: "M1", mirror: "x" },
      ],
    });
    expect(transformed).toMatchObject({
      ok: true,
      revision: 2,
      document: {
        instances: [
          {
            id: "M1",
            placement: {
              position: { x: 120, y: 90 },
              rotation: 90,
              mirror: "x",
            },
          },
        ],
      },
    });
  });

  it("patches instance properties atomically and records a non-source edit", () => {
    const document = documentWithInstance();
    document.instances[0]!.properties = {
      "spice.param.value": "10k",
      value: "8k",
    };
    document.sourceStatus = "in-sync";

    const result = executeTransaction(document, {
      ...transaction(),
      edits: [
        {
          kind: "patch_instance_properties",
          instanceId: "M1",
          set: { value: "12k", enabled: true },
          unset: ["spice.param.value"],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      revision: 1,
      diff: { changedObjectIds: ["M1"] },
      document: {
        sourceStatus: "geometry-only-changed",
        instances: [
          {
            properties: { value: "12k", enabled: true },
          },
        ],
      },
    });
    expect(document.instances[0]!.properties).toEqual({
      "spice.param.value": "10k",
      value: "8k",
    });
  });

  it("rejects an invalid property patch without partially changing the instance", () => {
    const document = documentWithInstance();
    document.instances[0]!.properties = { value: "10k" };

    const result = executeTransaction(document, {
      ...transaction(),
      edits: [
        {
          kind: "patch_instance_properties",
          instanceId: "M1",
          set: { value: "12k" },
          unset: ["value"],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      applied: false,
      error: { code: "EDIT_PRECONDITION" },
    });
    expect(document.instances[0]!.properties).toEqual({ value: "10k" });
  });

  it("reuses upright label placement when a BJT rotates", () => {
    const document = createEmptyDocument("document-main", "BJT label");
    const instance = {
      id: "Q1",
      symbolId: "npn",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    document.instances.push(instance);
    const resolved = resolver.resolve("npn");
    if (!resolved) throw new Error("missing npn");
    const profile = resolveSchematicStyleProfile(
      document.presentation.styleProfileId,
    );
    const initial = defaultInstanceLabelPlacement(instance, resolved, profile);
    if (!initial) throw new Error("missing default label placement");
    document.annotations.push({
      id: "instance-label-Q1",
      kind: "instance-label",
      text: "Q1",
      position: initial.position,
      offset: {
        x: initial.semanticPosition.x - instance.placement.position.x,
        y: initial.semanticPosition.y - instance.placement.position.y,
      },
      attachedObjectId: "Q1",
      alignment: initial.alignment,
      rotation: 0,
      locked: false,
    });

    const rotated = executeTransaction(
      document,
      {
        ...transaction(),
        edits: [{ kind: "rotate_instance", instanceId: "Q1", rotation: 90 }],
      },
      { symbolResolver: resolver },
    );
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    const rotatedInstance = rotated.document.instances[0]!;
    const localBounds = visibleSymbolLocalBounds(resolved);
    const worldCorners = [
      { x: localBounds.x, y: localBounds.y },
      { x: localBounds.x + localBounds.width, y: localBounds.y },
      {
        x: localBounds.x + localBounds.width,
        y: localBounds.y + localBounds.height,
      },
      { x: localBounds.x, y: localBounds.y + localBounds.height },
    ].map((point) =>
      transformPoint(
        point,
        rotatedInstance.placement!.position,
        rotatedInstance.placement!,
      ),
    );
    const bottom = Math.max(...worldCorners.map((point) => point.y));
    const label = rotated.document.annotations[0]!;
    expect(label).toMatchObject({ alignment: "middle", rotation: 0 });
    // The persisted semantic anchor is integer-rounded, so permit the one
    // pixel rounding difference while requiring the glyph edge to stay clear.
    expect(label.position.y).toBeGreaterThanOrEqual(
      Math.floor(bottom + profile.typography.instanceFontSize * 1.05 + 1.5),
    );
    expect(label.position.y).toBeLessThanOrEqual(
      Math.ceil(bottom + profile.typography.instanceFontSize * 1.05 + 2.5),
    );
  });

  it("rejects a multi-edit transaction atomically after a later precondition failure", () => {
    const document = documentWithInstance();
    const before = JSON.stringify(document);
    const result = executeTransaction(document, {
      ...transaction(),
      edits: [
        {
          kind: "place_instance",
          instanceId: "M1",
          placement: {
            position: { x: 100, y: 80 },
            rotation: 0,
            mirror: "none",
          },
        },
        {
          kind: "move_instance",
          instanceId: "missing",
          position: { x: 0, y: 0 },
        },
      ],
    });
    expect(result).toMatchObject({ ok: false, applied: false, revision: 0 });
    expect(result.document).toBe(document);
    expect(JSON.stringify(document)).toBe(before);
  });
});
