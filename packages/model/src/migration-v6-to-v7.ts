// Schema 6 -> 7 migration. RichText and VisualAnchor become the only
// persisted annotation presentation authority. Legacy `text`, positional
// attachment fields and routeAttachment are consumed here and never reach the
// current Project schema.

import { migrateLegacySchematicText } from "./schematic-text.js";

const TARGET_SCHEMA_VERSION = 7;

type Record_ = Record<string, unknown>;
type Point = { x: number; y: number };

function isRecord(value: unknown): value is Record_ {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asPoint(value: unknown): Point | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
    ? { x: value.x, y: value.y }
    : undefined;
}

function fallbackPosition(annotation: Record_): Point {
  return asPoint(annotation.position) ?? { x: 0, y: 0 };
}

function sourceContent(annotation: Record_): unknown {
  const content = annotation.content;
  if (isRecord(content) && Array.isArray(content.runs)) return content;
  const text = typeof annotation.text === "string" ? annotation.text : " ";
  const kind = annotation.kind;
  return migrateLegacySchematicText(
    text || " ",
    kind === "instance-label" ||
      kind === "net-label" ||
      kind === "power-label" ||
      kind === "route-marker"
      ? kind
      : "instance-label",
  );
}

function positionsById(document: Record_): Map<string, Point> {
  const positions = new Map<string, Point>();
  const instances = Array.isArray(document.instances) ? document.instances : [];
  for (const instance of instances) {
    if (!isRecord(instance)) continue;
    const placement = isRecord(instance.placement)
      ? instance.placement
      : undefined;
    const position = asPoint(placement?.position);
    const id = asString(instance.id);
    if (id && position) positions.set(id, position);
  }
  for (const collectionName of ["ports", "junctions"] as const) {
    const collection = Array.isArray(document[collectionName])
      ? document[collectionName]
      : [];
    for (const item of collection) {
      if (!isRecord(item)) continue;
      const id = asString(item.id);
      const position = asPoint(item.position);
      if (id && position) positions.set(id, position);
    }
  }
  return positions;
}

function netIdForAttachment(
  document: Record_,
  attachmentId: string,
): string | undefined {
  const nets = Array.isArray(document.nets)
    ? document.nets.filter(isRecord)
    : [];
  if (nets.some((net) => net.id === attachmentId)) return attachmentId;
  const junctions = Array.isArray(document.junctions)
    ? document.junctions.filter(isRecord)
    : [];
  const junction = junctions.find((candidate) => candidate.id === attachmentId);
  if (typeof junction?.netId === "string") return junction.netId;
  const portNet = nets.find(
    (net) => Array.isArray(net.ports) && net.ports.includes(attachmentId),
  );
  if (typeof portNet?.id === "string") return portNet.id;
  const terminalNets = nets.filter(
    (net) =>
      Array.isArray(net.terminals) &&
      net.terminals.some(
        (terminal) =>
          isRecord(terminal) && terminal.instanceId === attachmentId,
      ),
  );
  return terminalNets.length === 1 && typeof terminalNets[0]?.id === "string"
    ? terminalNets[0].id
    : undefined;
}

function validExistingAnchor(
  anchor: unknown,
  positions: ReadonlyMap<string, Point>,
  routeIds: ReadonlySet<string>,
  fallback: Point,
): Record_ | undefined {
  if (!isRecord(anchor) || typeof anchor.kind !== "string") return undefined;
  if (anchor.kind === "free")
    return { kind: "free", position: asPoint(anchor.position) ?? fallback };
  if (
    anchor.kind === "object" &&
    typeof anchor.objectId === "string" &&
    positions.has(anchor.objectId)
  ) {
    return {
      kind: "object",
      objectId: anchor.objectId,
      localOffset: asPoint(anchor.localOffset) ?? { x: 0, y: 0 },
      fallbackPosition: asPoint(anchor.fallbackPosition) ?? fallback,
    };
  }
  if (
    anchor.kind === "route" &&
    typeof anchor.routeId === "string" &&
    routeIds.has(anchor.routeId)
  ) {
    return {
      kind: "route",
      routeId: anchor.routeId,
      segmentIndex:
        typeof anchor.segmentIndex === "number" ? anchor.segmentIndex : 0,
      t: typeof anchor.t === "number" ? anchor.t : 0,
      normalOffset:
        typeof anchor.normalOffset === "number" ? anchor.normalOffset : 0,
      direction: anchor.direction === "reverse" ? "reverse" : "forward",
      orientation:
        anchor.orientation === "horizontal" ? "horizontal" : "follow",
      fallbackPosition: asPoint(anchor.fallbackPosition) ?? fallback,
    };
  }
  return undefined;
}

function canonicalAnchor(
  annotation: Record_,
  positions: ReadonlyMap<string, Point>,
  routeIds: ReadonlySet<string>,
): Record_ {
  const fallback = fallbackPosition(annotation);
  const existing = validExistingAnchor(
    annotation.anchor,
    positions,
    routeIds,
    fallback,
  );
  if (existing) return existing;
  const legacyRoute = isRecord(annotation.routeAttachment)
    ? annotation.routeAttachment
    : undefined;
  if (
    legacyRoute &&
    typeof legacyRoute.routeId === "string" &&
    routeIds.has(legacyRoute.routeId)
  ) {
    return {
      kind: "route",
      routeId: legacyRoute.routeId,
      segmentIndex:
        typeof legacyRoute.segmentIndex === "number"
          ? legacyRoute.segmentIndex
          : 0,
      t: typeof legacyRoute.t === "number" ? legacyRoute.t : 0,
      normalOffset:
        typeof legacyRoute.normalOffset === "number"
          ? legacyRoute.normalOffset
          : 0,
      direction: legacyRoute.direction === "reverse" ? "reverse" : "forward",
      orientation: "follow",
      fallbackPosition: fallback,
    };
  }
  const attached = asString(annotation.attachedObjectId);
  if (attached && positions.has(attached)) {
    return {
      kind: "object",
      objectId: attached,
      localOffset: asPoint(annotation.offset) ?? { x: 0, y: 0 },
      fallbackPosition: fallback,
    };
  }
  return { kind: "free", position: fallback };
}

function toDraftText(annotation: Record_): Record_ {
  return {
    id: `legacy-annotation-${String(annotation.id ?? "text")}`,
    kind: "text",
    content: sourceContent(annotation),
    alignment: annotation.alignment ?? "start",
    rotation: annotation.rotation ?? 0,
    typographyToken: "label",
    locked: annotation.locked === true,
    zIndex: 0,
    anchor: { kind: "free", position: fallbackPosition(annotation) },
  };
}

function migrateDocument(document: Record_): Record_ {
  const positions = positionsById(document);
  const routeIds = new Set(
    (Array.isArray(document.routes) ? document.routes : []).flatMap((route) =>
      isRecord(route) && typeof route.id === "string" ? [route.id] : [],
    ),
  );
  const annotations = Array.isArray(document.annotations)
    ? document.annotations.filter(isRecord)
    : [];
  const drafting = isRecord(document.drafting)
    ? document.drafting
    : { objects: [] };
  const draftingObjects = Array.isArray(drafting.objects)
    ? [...drafting.objects]
    : [];
  const retainedAnnotations: Record_[] = [];
  for (const annotation of annotations) {
    const kind = annotation.kind;
    const attachmentId = asString(annotation.attachedObjectId);
    const requiresNet = kind === "net-label" || kind === "power-label";
    const netId =
      requiresNet && attachmentId
        ? netIdForAttachment(document, attachmentId)
        : undefined;
    // An old free label without an electrical Net was merely text. Preserve its
    // appearance as DraftText instead of inventing an electrical relation.
    if (requiresNet && !netId) {
      draftingObjects.push(toDraftText(annotation));
      continue;
    }
    retainedAnnotations.push({
      id: annotation.id,
      kind,
      content: sourceContent(annotation),
      anchor: canonicalAnchor(annotation, positions, routeIds),
      ...(netId ? { netId } : {}),
      alignment: annotation.alignment ?? "start",
      rotation: annotation.rotation ?? 0,
      locked: annotation.locked === true,
      ...(typeof annotation.sizeScale === "number"
        ? { sizeScale: annotation.sizeScale }
        : {}),
      ...(annotation.markerKind ? { markerKind: annotation.markerKind } : {}),
    });
  }
  return {
    ...document,
    annotations: retainedAnnotations,
    drafting: { ...drafting, objects: draftingObjects },
  };
}

/** Idempotently rewrites old annotation presentation into schema-v7 authority. */
export function migrateV6ToV7(input: Record_): Record_ {
  const documents = Array.isArray(input.documents) ? input.documents : [];
  return {
    ...input,
    schemaVersion: TARGET_SCHEMA_VERSION,
    documents: documents.map((document) =>
      isRecord(document) ? migrateDocument(document) : document,
    ),
  };
}
