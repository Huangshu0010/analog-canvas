import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";

export class ProjectMigrationError extends Error {
  constructor(
    readonly path: readonly (string | number)[],
    message: string,
  ) {
    super(message);
  }
}

type CellTerminalDirection = "input" | "output" | "inout" | "passive";

export interface MigratedCellPin {
  readonly documentId: string;
  readonly terminalId: string;
  readonly name: string;
  readonly direction: CellTerminalDirection;
  readonly netId: string;
  readonly interfaceInstanceIds: readonly string[];
  readonly source: "existing-terminal" | "free-port";
}

export interface Schema23To24MigrationReport {
  readonly cellPins: readonly MigratedCellPin[];
  readonly removedFreePortClaims: number;
  readonly mergedBaseNets: number;
  readonly vddMarkersBefore: number;
  readonly vddMarkersAfter: number;
  readonly powerRailsBefore: number;
  readonly powerRailsAfter: number;
  readonly routesBefore: number;
  readonly routesAfter: number;
  readonly junctionsBefore: number;
  readonly junctionsAfter: number;
}

export interface Schema23To24MigrationResult {
  readonly project: Record<string, unknown>;
  readonly report: Schema23To24MigrationReport;
}

/**
 * Schema 24 retires Free Port while retaining the ordinary EDA rule that one
 * formal Cell Pin may have several drawing markers. Schema-23 free markers
 * with the same semantic name are promoted into one ordered CellTerminal and
 * one electrical Net; existing repeated formal markers remain unchanged.
 */
export function upgradeSchema23To24WithReport(
  raw: Record<string, unknown>,
): Schema23To24MigrationResult {
  const project = structuredClone(raw);
  const before = visualInventory(project);
  const cellPins: MigratedCellPin[] = [];
  let removedFreePortClaims = 0;
  let mergedBaseNets = 0;

  if (Array.isArray(project.documents)) {
    for (const [documentIndex, value] of project.documents.entries()) {
      if (!isRecord(value)) continue;
      const result = migrateDocumentPorts(value, documentIndex);
      cellPins.push(...result.cellPins);
      removedFreePortClaims += result.removedFreePortClaims;
      mergedBaseNets += result.mergedBaseNets;
    }
  }
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  const after = visualInventory(project);
  return {
    project,
    report: {
      cellPins,
      removedFreePortClaims,
      mergedBaseNets,
      vddMarkersBefore: before.vddMarkers,
      vddMarkersAfter: after.vddMarkers,
      powerRailsBefore: before.powerRails,
      powerRailsAfter: after.powerRails,
      routesBefore: before.routes,
      routesAfter: after.routes,
      junctionsBefore: before.junctions,
      junctionsAfter: after.junctions,
    },
  };
}

export function upgradeSchema23To24(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return upgradeSchema23To24WithReport(raw).project;
}

function migrateDocumentPorts(
  document: Record<string, unknown>,
  documentIndex: number,
): {
  cellPins: MigratedCellPin[];
  removedFreePortClaims: number;
  mergedBaseNets: number;
} {
  const documentId = stringValue(document.id) ?? `document-${documentIndex}`;
  const instances = records(document.instances);
  const ports = instances.filter(isPortInstance);
  const nets = records(document.nets);
  const annotations = records(document.annotations);
  const evidence = records(document.connectivityEvidence);
  const netlist = ensureNetlist(document);
  const terminals = records(netlist.terminals);
  const terminalIds = new Set<string>();
  const terminalNames = new Set<string>();
  const terminalByMarkerId = new Map<string, Record<string, unknown>>();
  const terminalByName = new Map<string, Record<string, unknown>>();
  const cellPins: MigratedCellPin[] = [];

  for (const [terminalIndex, terminal] of terminals.entries()) {
    const markerIds = terminalMarkerIds(terminal);
    if (markerIds.length === 0) {
      throw new ProjectMigrationError(
        [
          "documents",
          documentIndex,
          "netlist",
          "terminals",
          terminalIndex,
          "interfaceInstanceIds",
        ],
        "Cell terminal has no drawing marker",
      );
    }
    const id = stringValue(terminal.id);
    const name = stringValue(terminal.name);
    const netId = stringValue(terminal.netId);
    if (!id || !name || !netId) {
      throw new ProjectMigrationError(
        ["documents", documentIndex, "netlist", "terminals", terminalIndex],
        "Cell terminal is missing id, name, or Net",
      );
    }
    if (terminalIds.has(id) || terminalNames.has(name.toLowerCase())) {
      throw new ProjectMigrationError(
        ["documents", documentIndex, "netlist", "terminals", terminalIndex],
        `Duplicate Cell terminal identity: ${name}`,
      );
    }
    terminalIds.add(id);
    terminalNames.add(name.toLowerCase());
    terminal.interfaceInstanceIds = markerIds;
    delete terminal.interfaceInstanceId;
    terminalByName.set(name.toLowerCase(), terminal);
    markerIds.forEach((markerId) => terminalByMarkerId.set(markerId, terminal));
    cellPins.push({
      documentId,
      terminalId: id,
      name,
      direction: terminalDirection(terminal.direction),
      netId,
      interfaceInstanceIds: [...markerIds],
      source: "existing-terminal",
    });
  }

  let mergedBaseNets = 0;
  const convertedAnnotationIds = new Set<string>();
  for (const port of ports) {
    const markerId = stringValue(port.id);
    if (!markerId || terminalByMarkerId.has(markerId)) continue;
    const markerNet = nets.find((net) => netOwnsPort(net, markerId));
    const markerNetId = markerNet ? stringValue(markerNet.id) : undefined;
    if (!markerNetId) {
      throw new ProjectMigrationError(
        ["documents", documentIndex, "instances"],
        `Port ${markerId} must belong to one Base Net`,
      );
    }
    const name =
      freePortClaimName(evidence, markerId) ??
      anchoredAnnotationText(annotations, markerId) ??
      stringValue(port.schematicReference) ??
      markerId;
    let terminal = terminalByName.get(name.toLowerCase());
    if (terminal) {
      const targetNetId = stringValue(terminal.netId)!;
      if (markerNetId !== targetNetId) {
        mergeRawBaseNets(document, targetNetId, markerNetId);
        mergedBaseNets += 1;
      }
      const markerIds = terminalMarkerIds(terminal);
      if (!markerIds.includes(markerId)) markerIds.push(markerId);
      terminal.interfaceInstanceIds = markerIds;
    } else {
      const terminalId = uniqueId(
        `terminal-${markerId.toLowerCase()}`,
        terminalIds,
      );
      terminal = {
        id: terminalId,
        name,
        netId: markerNetId,
        direction: "inout",
        interfaceInstanceIds: [markerId],
      };
      terminals.push(terminal);
      terminalIds.add(terminalId);
      terminalNames.add(name.toLowerCase());
      terminalByName.set(name.toLowerCase(), terminal);
    }
    terminalByMarkerId.set(markerId, terminal);
    delete port.schematicReference;
    delete port.netlist;
    for (const annotation of annotations) {
      if (!annotationAnchorsObject(annotation, markerId)) continue;
      if (
        annotation.kind !== "instance-label" &&
        annotation.kind !== "net-label"
      ) {
        continue;
      }
      const annotationId = stringValue(annotation.id);
      if (annotationId) convertedAnnotationIds.add(annotationId);
      annotation.kind = "instance-label";
      annotation.binding = {
        kind: "cell-terminal-name",
        terminalId: stringValue(terminal.id)!,
      };
      delete annotation.netId;
      delete annotation.content;
    }
  }

  netlist.terminals = terminals;
  let removedFreePortClaims = 0;
  document.connectivityEvidence = evidence.filter((item) => {
    const owner = isRecord(item.owner) ? item.owner : null;
    const remove =
      owner?.kind === "free-port" ||
      (owner?.kind === "net-label" &&
        typeof owner.annotationId === "string" &&
        convertedAnnotationIds.has(owner.annotationId));
    if (remove) removedFreePortClaims += 1;
    return !remove;
  });

  return {
    cellPins: terminals.map((terminal) => ({
      documentId,
      terminalId: stringValue(terminal.id)!,
      name: stringValue(terminal.name)!,
      direction: terminalDirection(terminal.direction),
      netId: stringValue(terminal.netId)!,
      interfaceInstanceIds: terminalMarkerIds(terminal),
      source: cellPins.some((pin) => pin.terminalId === terminal.id)
        ? "existing-terminal"
        : "free-port",
    })),
    removedFreePortClaims,
    mergedBaseNets,
  };
}

function mergeRawBaseNets(
  document: Record<string, unknown>,
  targetNetId: string,
  sourceNetId: string,
): void {
  if (targetNetId === sourceNetId) return;
  const nets = records(document.nets);
  const target = nets.find((net) => net.id === targetNetId);
  const source = nets.find((net) => net.id === sourceNetId);
  if (!target || !source) {
    throw new ProjectMigrationError(
      ["documents"],
      `Cannot merge missing Base Nets ${targetNetId} and ${sourceNetId}`,
    );
  }
  const targetTerminals = records(target.terminals);
  for (const terminal of records(source.terminals)) {
    if (
      !targetTerminals.some(
        (candidate) =>
          candidate.instanceId === terminal.instanceId &&
          candidate.pinName === terminal.pinName,
      )
    ) {
      targetTerminals.push(terminal);
    }
  }
  target.terminals = targetTerminals;
  document.nets = nets.filter((net) => net !== source);
  rewriteNetId(document, sourceNetId, targetNetId);
}

function rewriteNetId(
  value: unknown,
  sourceNetId: string,
  targetNetId: string,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => rewriteNetId(item, sourceNetId, targetNetId));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if ((key === "netId" || key === "bodyNetId") && child === sourceNetId) {
      value[key] = targetNetId;
    } else if (key === "memberNetIds" && Array.isArray(child)) {
      value[key] = [
        ...new Set(child.map((id) => (id === sourceNetId ? targetNetId : id))),
      ];
    } else {
      rewriteNetId(child, sourceNetId, targetNetId);
    }
  }
}

function ensureNetlist(
  document: Record<string, unknown>,
): Record<string, unknown> {
  if (isRecord(document.netlist)) return document.netlist;
  const netlist = {
    name: stringValue(document.name) ?? "Cell",
    terminals: [],
    formalParameters: [],
  };
  document.netlist = netlist;
  return netlist;
}

function terminalMarkerIds(terminal: Record<string, unknown>): string[] {
  if (Array.isArray(terminal.interfaceInstanceIds)) {
    return terminal.interfaceInstanceIds.filter(
      (value): value is string => typeof value === "string",
    );
  }
  return typeof terminal.interfaceInstanceId === "string"
    ? [terminal.interfaceInstanceId]
    : [];
}

function terminalDirection(value: unknown): CellTerminalDirection {
  return value === "input" ||
    value === "output" ||
    value === "inout" ||
    value === "passive"
    ? value
    : "inout";
}

function freePortClaimName(
  evidence: readonly Record<string, unknown>[],
  markerId: string,
): string | undefined {
  const claim = evidence.find((item) => {
    const owner = isRecord(item.owner) ? item.owner : null;
    return (
      item.kind === "name-claim" &&
      owner?.kind === "free-port" &&
      owner.instanceId === markerId
    );
  });
  return claim ? stringValue(claim.name) : undefined;
}

function anchoredAnnotationText(
  annotations: readonly Record<string, unknown>[],
  markerId: string,
): string | undefined {
  const annotation = annotations.find((item) =>
    annotationAnchorsObject(item, markerId),
  );
  if (!annotation) return undefined;
  return flattenRawRichText(
    annotation.formatOverride ?? annotation.content,
  )?.trim();
}

function flattenRawRichText(value: unknown): string | undefined {
  if (!isRecord(value) || !Array.isArray(value.runs)) return undefined;
  const flatten = (runs: unknown[]): string =>
    runs
      .map((run): string => {
        if (!isRecord(run)) return "";
        if (run.kind === "text" && typeof run.value === "string")
          return run.value;
        if (run.kind === "span" && Array.isArray(run.children))
          return flatten(run.children);
        return run.kind === "line-break" ? "\n" : "";
      })
      .join("");
  return flatten(value.runs);
}

function annotationAnchorsObject(
  annotation: Record<string, unknown>,
  objectId: string,
): boolean {
  return (
    isRecord(annotation.anchor) &&
    annotation.anchor.kind === "object" &&
    annotation.anchor.objectId === objectId
  );
}

function netOwnsPort(net: Record<string, unknown>, markerId: string): boolean {
  return records(net.terminals).some(
    (terminal) => terminal.instanceId === markerId && terminal.pinName === "P",
  );
}

function isPortInstance(instance: Record<string, unknown>): boolean {
  return instance.symbolId === "port" || instance.symbolId === "port-filled";
}

function uniqueId(base: string, occupied: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (occupied.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function visualInventory(project: Record<string, unknown>): {
  vddMarkers: number;
  powerRails: number;
  routes: number;
  junctions: number;
} {
  let vddMarkers = 0;
  let powerRails = 0;
  let routes = 0;
  let junctions = 0;
  for (const document of records(project.documents)) {
    const documentRoutes = records(document.routes);
    routes += documentRoutes.length;
    powerRails += documentRoutes.filter(
      (route) => route.presentation === "power-rail",
    ).length;
    junctions += Array.isArray(document.junctions)
      ? document.junctions.length
      : 0;
    vddMarkers += records(document.instances).filter(
      (instance) => instance.symbolId === "vdd-port",
    ).length;
  }
  return { vddMarkers, powerRails, routes, junctions };
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
