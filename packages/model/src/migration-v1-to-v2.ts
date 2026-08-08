// ADR 0010 schema 1 -> 2 migration. This is a pure, idempotent function that
// applies the Text & Peripheral Editing System migration table. In A1a it is
// unit-tested but NOT registered with the persistence migration registry
// (CURRENT_PROJECT_SCHEMA_VERSION stays 1); the integration gate registers it
// and bumps the constant.
//
// The migration never changes Net/Route/Junction/instance and never rewrites
// original SPICE. It narrows annotations to SchematicAnnotation and moves
// non-electrical text into the drafting container. electricalTopologyHash is
// unchanged (placement, Route geometry, Junction placement, annotations, and
// drafting are all excluded from that hash).

const TARGET_SCHEMA_VERSION = 2;

export interface MigrationDiagnostic {
  code: string;
  sourceAnnotationId: string;
  message: string;
}

export interface MigrationResult {
  project: Record<string, unknown>;
  diagnostics: MigrationDiagnostic[];
}

type Record_ = Record<string, unknown>;

function isRecord(value: unknown): value is Record_ {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Migrate a schema-1 Project record to schema 2. Idempotent: a record already
 * at schema 2 (drafting present, no legacy-only annotation kinds that still
 * need moving) is returned unchanged with empty diagnostics.
 */
export function migrateV1ToV2(input: unknown): MigrationResult {
  if (!isRecord(input)) {
    throw new Error("migrateV1ToV2 expects a Project record");
  }
  const diagnostics: MigrationDiagnostic[] = [];

  const version = input.schemaVersion;
  const documents = asArray(input.documents).filter(isRecord);
  const alreadyV2 =
    version === TARGET_SCHEMA_VERSION &&
    documents.every((document) => isRecord(document.drafting));

  // Build the migrated documents. Even when already v2 we re-walk to preserve
  // a stable output shape, but we emit no diagnostics and no annotation moves.
  const migratedDocuments = documents.map((document) =>
    migrateDocument(document, alreadyV2, diagnostics),
  );

  return {
    project: { ...input, schemaVersion: TARGET_SCHEMA_VERSION, documents: migratedDocuments },
    diagnostics,
  };
}

function migrateDocument(
  document: Record_,
  alreadyV2: boolean,
  diagnostics: MigrationDiagnostic[],
): Record_ {
  const annotations = asArray(document.annotations).filter(isRecord);
  const existingDrafting = isRecord(document.drafting)
    ? document.drafting
    : { objects: [], guides: [] };
  const draftingObjects = asArray(existingDrafting.objects).filter(isRecord);

  const keptAnnotations: Record_[] = [];
  for (const annotation of annotations) {
    const kind = annotation.kind;
    if (alreadyV2) {
      keptAnnotations.push(annotation);
      continue;
    }
    if (kind === "instance-label" || kind === "net-label" || kind === "power-label") {
      keptAnnotations.push(annotation);
      continue;
    }
    if (kind === "current") {
      keptAnnotations.push(toRouteMarker(annotation, "current"));
      continue;
    }
    if (kind === "voltage") {
      const migrated = migrateVoltage(annotation, diagnostics);
      if (migrated.routeMarker) {
        keptAnnotations.push(migrated.routeMarker);
      }
      if (migrated.draftText) {
        draftingObjects.push(migrated.draftText);
      }
      continue;
    }
    if (kind === "plain-text" || kind === "figure-caption") {
      draftingObjects.push(toDraftText(annotation));
      continue;
    }
    // route-marker (already schema-2 shape) passes through.
    keptAnnotations.push(annotation);
  }

  return {
    ...document,
    annotations: keptAnnotations,
    drafting: { objects: draftingObjects, guides: asArray(existingDrafting.guides) },
  };
}

function toRouteMarker(annotation: Record_, markerKind: "current" | "voltage"): Record_ {
  const { kind: _kind, routeAttachment, ...rest } = annotation;
  void _kind;
  const fallback = fallbackPoint(annotation);
  if (isRecord(routeAttachment)) {
    return {
      ...rest,
      kind: "route-marker",
      markerKind,
      anchor: {
        kind: "route",
        routeId: routeAttachment.routeId,
        segmentIndex: routeAttachment.segmentIndex,
        t: routeAttachment.t,
        normalOffset: routeAttachment.normalOffset,
        direction: routeAttachment.direction,
        orientation: "follow",
        fallbackPosition: fallback,
      },
    };
  }
  return {
    ...rest,
    kind: "route-marker",
    markerKind,
    anchor: { kind: "free", position: fallback },
  };
}

interface VoltageMigration {
  routeMarker?: Record_;
  draftText?: Record_;
}

function migrateVoltage(
  annotation: Record_,
  diagnostics: MigrationDiagnostic[],
): VoltageMigration {
  const attachedObjectId = annotation.attachedObjectId;
  const id = String(annotation.id ?? "");
  // Deterministic rule (ADR 0010): a resolvable attachedObjectId becomes an
  // object-anchor route-marker/voltage; otherwise free DraftText + a migration
  // diagnostic. Never guess a Route/segmentIndex/t from proximity.
  if (typeof attachedObjectId === "string" && attachedObjectId.length > 0) {
    return { routeMarker: toObjectAnchoredRouteMarker(annotation, "voltage") };
  }
  diagnostics.push({
    code: "voltage-no-attachment",
    sourceAnnotationId: id,
    message:
      "Free-positioned voltage marker migrated to free text; review its placement.",
  });
  return { draftText: toDraftText(annotation) };
}

function toObjectAnchoredRouteMarker(
  annotation: Record_,
  markerKind: "current" | "voltage",
): Record_ {
  const { kind: _kind, attachedObjectId, offset, ...rest } = annotation;
  void _kind;
  const localOffset = isRecord(offset) ? offset : { x: 0, y: 0 };
  return {
    ...rest,
    kind: "route-marker",
    markerKind,
    attachedObjectId,
    anchor: {
      kind: "object",
      objectId: attachedObjectId,
      localOffset,
      fallbackPosition: fallbackPoint(annotation),
    },
  };
}

function toDraftText(annotation: Record_): Record_ {
  const id = String(annotation.id ?? "");
  const text = typeof annotation.text === "string" ? annotation.text : "";
  const { kind: _kind, text: _text, ...rest } = annotation;
  void _kind;
  void _text;
  const typographyToken =
    annotation.kind === "figure-caption" ? "caption" : "body";
  return {
    id,
    kind: "text",
    content: { runs: [{ kind: "text", value: text }] },
    alignment: annotation.alignment ?? "start",
    rotation: annotation.rotation ?? 0,
    typographyToken,
    locked: annotation.locked ?? false,
    zIndex: 0,
    anchor: { kind: "free", position: fallbackPoint(annotation) },
    // Preserve original placement fields for traceability; the renderer reads
    // them until WP-A2 consumes drafting objects directly.
    ...preservePlacement(rest),
  };
}

function fallbackPoint(annotation: Record_): { x: number; y: number } {
  const position = isRecord(annotation.position) ? annotation.position : undefined;
  const x = typeof position?.x === "number" ? position.x : 0;
  const y = typeof position?.y === "number" ? position.y : 0;
  return { x, y };
}

function preservePlacement(rest: Record_): Record_ {
  const { position, offset, alignment, rotation, locked, sizeScale, ...remaining } = rest;
  void position;
  void offset;
  void alignment;
  void rotation;
  void locked;
  void sizeScale;
  return remaining;
}
