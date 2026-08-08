import { describe, expect, it } from "vitest";

import type { Annotation } from "./schema.js";
import { migrateV1ToV2 } from "./migration-v1-to-v2.js";

// Helpers build minimal schema-1 annotation records with the fields the
// migration reads, so the tests stay focused on migration behavior.

function baseAnnotation(overrides: Partial<Annotation> & { id: string }): Record<string, unknown> {
  return {
    alignment: "start",
    kind: "plain-text",
    locked: false,
    offset: { x: 0, y: 0 },
    position: { x: 100, y: 100 },
    rotation: 0,
    text: "",
    ...overrides,
  };
}

function topDocument(record: Record<string, unknown>): Record<string, unknown> {
  const documents = (record.documents as Array<Record<string, unknown>>).filter(
    (document): document is Record<string, unknown> => typeof document === "object",
  );
  return documents[0]!;
}

describe("migrateV1ToV2", () => {
  it("advances schemaVersion to 2 and leaves electrical fields untouched", () => {
    const project = {
      schemaVersion: 1,
      documents: [
        {
          id: "doc",
          annotations: [],
          instances: [{ id: "M1" }],
          nets: [{ id: "n1", terminals: [{ instanceId: "M1", pinName: "D" }] }],
        },
      ],
    };
    const result = migrateV1ToV2(project);
    expect(result.project.schemaVersion).toBe(2);
    const document = topDocument(result.project);
    expect(document.instances).toEqual([{ id: "M1" }]);
    expect(document.nets).toEqual([
      { id: "n1", terminals: [{ instanceId: "M1", pinName: "D" }] },
    ]);
  });

  it("preserves instance/net/power labels as SchematicAnnotation", () => {
    const annotations = [
      baseAnnotation({ id: "l1", kind: "instance-label", text: "M_{1}", attachedObjectId: "M1" }),
      baseAnnotation({ id: "l2", kind: "net-label", text: "V_b", attachedObjectId: "n1" }),
      baseAnnotation({ id: "l3", kind: "power-label", text: "V_{DD}" }),
    ];
    const result = migrateV1ToV2({ schemaVersion: 1, documents: [{ id: "doc", annotations }] });
    const document = topDocument(result.project);
    expect(document.annotations).toEqual(annotations);
  });

  it("migrates current to route-marker/current preserving the route attachment", () => {
    const annotation = baseAnnotation({
      id: "ix",
      kind: "current",
      text: "I_x",
      routeAttachment: {
        routeId: "r1",
        segmentIndex: 0,
        t: 0.5,
        direction: "forward",
        normalOffset: -16,
      },
    });
    const result = migrateV1ToV2({ schemaVersion: 1, documents: [{ id: "doc", annotations: [annotation] }] });
    const annotationOut = (topDocument(result.project).annotations as Array<Record<string, unknown>>)[0]!;
    expect(annotationOut.kind).toBe("route-marker");
    expect(annotationOut.markerKind).toBe("current");
    expect(annotationOut.anchor).toMatchObject({
      kind: "route",
      routeId: "r1",
      segmentIndex: 0,
      t: 0.5,
      normalOffset: -16,
      direction: "forward",
      orientation: "follow",
      fallbackPosition: { x: 100, y: 100 },
    });
  });

  it("migrates voltage with attachedObjectId to object-anchor route-marker/voltage with no diagnostic", () => {
    const annotation = baseAnnotation({
      id: "vx",
      kind: "voltage",
      text: "V_x",
      attachedObjectId: "M1",
      offset: { x: 8, y: 0 },
    });
    const result = migrateV1ToV2({ schemaVersion: 1, documents: [{ id: "doc", annotations: [annotation] }] });
    expect(result.diagnostics).toEqual([]);
    const annotationOut = (topDocument(result.project).annotations as Array<Record<string, unknown>>)[0]!;
    expect(annotationOut.kind).toBe("route-marker");
    expect(annotationOut.markerKind).toBe("voltage");
    expect(annotationOut.anchor).toMatchObject({
      kind: "object",
      objectId: "M1",
      localOffset: { x: 8, y: 0 },
      fallbackPosition: { x: 100, y: 100 },
    });
  });

  it("migrates free-positioned voltage to free DraftText with a migration diagnostic and no guessed route", () => {
    const annotation = baseAnnotation({
      id: "vx",
      kind: "voltage",
      text: "V_x",
      position: { x: 320, y: 160 },
      alignment: "middle",
    });
    const result = migrateV1ToV2({ schemaVersion: 1, documents: [{ id: "doc", annotations: [annotation] }] });
    expect(result.diagnostics).toEqual([
      {
        code: "voltage-no-attachment",
        sourceAnnotationId: "vx",
        message: "Free-positioned voltage marker migrated to free text; review its placement.",
      },
    ]);
    const document = topDocument(result.project);
    expect(document.annotations).toEqual([]);
    const draft = (document.drafting as Record<string, unknown>).objects as Array<Record<string, unknown>>;
    expect(draft[0]).toMatchObject({
      id: "vx",
      kind: "text",
      content: { runs: [{ kind: "text", value: "V_x" }] },
      alignment: "middle",
      anchor: { kind: "free", position: { x: 320, y: 160 } },
    });
    // No route/segmentIndex/t is invented.
    expect(JSON.stringify(draft[0])).not.toContain("segmentIndex");
  });

  it("migrates plain-text and figure-caption to drafting text, preserving the caption token", () => {
    const annotations = [
      baseAnnotation({ id: "n1", kind: "plain-text", text: "feedback" }),
      baseAnnotation({ id: "c1", kind: "figure-caption", text: "Fig. 1", alignment: "middle" }),
    ];
    const result = migrateV1ToV2({ schemaVersion: 1, documents: [{ id: "doc", annotations }] });
    const document = topDocument(result.project);
    expect(document.annotations).toEqual([]);
    const objects = (document.drafting as Record<string, unknown>).objects as Array<Record<string, unknown>>;
    expect(objects).toHaveLength(2);
    expect(objects[0]).toMatchObject({
      id: "n1",
      kind: "text",
      typographyToken: "body",
      content: { runs: [{ kind: "text", value: "feedback" }] },
    });
    expect(objects[1]).toMatchObject({
      id: "c1",
      kind: "text",
      typographyToken: "caption",
      content: { runs: [{ kind: "text", value: "Fig. 1" }] },
      alignment: "middle",
    });
  });

  it("is idempotent: re-running on a migrated project is a no-op with empty diagnostics", () => {
    const project = {
      schemaVersion: 1,
      documents: [
        {
          id: "doc",
          annotations: [
            baseAnnotation({ id: "n1", kind: "plain-text", text: "note" }),
            baseAnnotation({ id: "ix", kind: "current", text: "I_x", routeAttachment: { routeId: "r1", segmentIndex: 0, t: 0.5, direction: "forward", normalOffset: -1 } }),
            baseAnnotation({ id: "vx", kind: "voltage", text: "V_x" }),
          ],
        },
      ],
    };
    const first = migrateV1ToV2(project);
    const second = migrateV1ToV2(first.project);
    expect(second.diagnostics).toEqual([]);
    expect(second.project).toEqual(first.project);
  });
});
