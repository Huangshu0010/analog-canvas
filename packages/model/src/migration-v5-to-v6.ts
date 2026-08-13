// Schema 5 -> 6 migration. Ports become the single electrical and visual
// authority. Legacy port/port-filled Symbol instances are converted exactly
// once; later runtime code has no reason to resolve them.

const TARGET_SCHEMA_VERSION = 6;

type Record_ = Record<string, unknown>;

function isRecord(value: unknown): value is Record_ {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPoint(value: unknown): { x: number; y: number } | undefined {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.x) ||
    !Number.isInteger(value.y)
  ) {
    return undefined;
  }
  return { x: value.x as number, y: value.y as number };
}

function legacyPortPosition(
  instance: Record_,
): { x: number; y: number } | null {
  const placement = isRecord(instance.placement)
    ? instance.placement
    : undefined;
  if (!placement) return null;
  const origin = asPoint(placement.position);
  const rotation = placement.rotation;
  const mirror = placement.mirror;
  if (
    !origin ||
    ![0, 90, 180, 270].includes(rotation as number) ||
    !["none", "x"].includes(mirror as string)
  ) {
    return null;
  }
  // The retired symbol terminal P is at local (10, 0). Preserve the true
  // endpoint position so all existing Route geometry remains unchanged.
  const localX = mirror === "x" ? -10 : 10;
  const offset =
    rotation === 0
      ? { x: localX, y: 0 }
      : rotation === 90
        ? { x: 0, y: localX }
        : rotation === 180
          ? { x: -localX, y: 0 }
          : { x: 0, y: -localX };
  return { x: origin.x + offset.x, y: origin.y + offset.y };
}

function portName(instance: Record_): string {
  const netlist = isRecord(instance.netlist) ? instance.netlist : undefined;
  const properties = isRecord(instance.properties)
    ? instance.properties
    : undefined;
  return (
    asString(netlist?.reference) ??
    asString(properties?.["spice.name"]) ??
    asString(instance.id) ??
    "Port"
  );
}

function endpointForLegacyPort(
  endpoint: unknown,
  portIds: ReadonlySet<string>,
): unknown {
  if (
    isRecord(endpoint) &&
    endpoint.kind === "terminal" &&
    typeof endpoint.instanceId === "string" &&
    endpoint.pinName === "P" &&
    portIds.has(endpoint.instanceId)
  ) {
    return { kind: "port", portId: endpoint.instanceId };
  }
  return endpoint;
}

function migrateDocument(document: Record_): Record_ {
  const annotations = Array.isArray(document.annotations)
    ? document.annotations.filter(isRecord)
    : [];
  const supplyPortIds = new Set(
    annotations.flatMap((annotation) =>
      annotation.kind === "power-label" &&
      typeof annotation.attachedObjectId === "string"
        ? [annotation.attachedObjectId]
        : [],
    ),
  );
  const instances = Array.isArray(document.instances)
    ? document.instances.filter(isRecord)
    : [];
  const legacyPorts = instances.filter(
    (instance) =>
      instance.symbolId === "port" || instance.symbolId === "port-filled",
  );
  const legacyPortIds = new Set(
    legacyPorts.flatMap((instance) =>
      typeof instance.id === "string" ? [instance.id] : [],
    ),
  );
  const existingPorts = Array.isArray(document.ports)
    ? document.ports.filter(isRecord)
    : [];
  const ports: Record_[] = [
    ...existingPorts.map((port) => ({
      ...port,
      presentation:
        port.presentation === "filled" || port.presentation === "supply"
          ? port.presentation
          : supplyPortIds.has(String(port.id))
            ? "supply"
            : "hollow",
    })),
    ...legacyPorts.flatMap((instance) => {
      const id = asString(instance.id);
      if (!id) return [];
      return [
        {
          id,
          name: portName(instance),
          direction: "passive",
          position: legacyPortPosition(instance),
          presentation: supplyPortIds.has(id)
            ? "supply"
            : instance.symbolId === "port-filled"
              ? "filled"
              : "hollow",
        },
      ];
    }),
  ];
  const existingOrder =
    isRecord(document.netlist) && Array.isArray(document.netlist.portOrder)
      ? document.netlist.portOrder.filter(
          (id): id is string => typeof id === "string",
        )
      : [];
  const portOrder = [...existingOrder];
  for (const port of ports) {
    if (typeof port.id === "string" && !portOrder.includes(port.id)) {
      portOrder.push(port.id);
    }
  }
  const netlist = isRecord(document.netlist)
    ? { ...document.netlist, portOrder }
    : document.netlist;
  return {
    ...document,
    ...(netlist ? { netlist } : {}),
    ports,
    instances: instances.filter(
      (instance) => !legacyPortIds.has(String(instance.id)),
    ),
    nets: Array.isArray(document.nets)
      ? document.nets.map((net) => {
          if (!isRecord(net)) return net;
          const retainedTerminals = Array.isArray(net.terminals)
            ? net.terminals.filter(
                (terminal) =>
                  !(
                    isRecord(terminal) &&
                    terminal.pinName === "P" &&
                    typeof terminal.instanceId === "string" &&
                    legacyPortIds.has(terminal.instanceId)
                  ),
              )
            : [];
          const migratedPortIds = Array.isArray(net.terminals)
            ? net.terminals.flatMap((terminal) =>
                isRecord(terminal) &&
                terminal.pinName === "P" &&
                typeof terminal.instanceId === "string" &&
                legacyPortIds.has(terminal.instanceId)
                  ? [terminal.instanceId]
                  : [],
              )
            : [];
          const priorPortIds = Array.isArray(net.ports)
            ? net.ports.filter((id): id is string => typeof id === "string")
            : [];
          return {
            ...net,
            terminals: retainedTerminals,
            ports: [...new Set([...priorPortIds, ...migratedPortIds])],
          };
        })
      : document.nets,
    routes: Array.isArray(document.routes)
      ? document.routes.map((route) =>
          isRecord(route)
            ? {
                ...route,
                from: endpointForLegacyPort(route.from, legacyPortIds),
                to: endpointForLegacyPort(route.to, legacyPortIds),
              }
            : route,
        )
      : document.routes,
    noConnects: Array.isArray(document.noConnects)
      ? document.noConnects.map((noConnect) =>
          isRecord(noConnect)
            ? {
                ...noConnect,
                endpoint: endpointForLegacyPort(
                  noConnect.endpoint,
                  legacyPortIds,
                ),
              }
            : noConnect,
        )
      : document.noConnects,
  };
}

/** Idempotently gives every persisted Port explicit presentation authority. */
export function migrateV5ToV6(input: Record_): Record_ {
  const documents = Array.isArray(input.documents) ? input.documents : [];
  return {
    ...input,
    schemaVersion: TARGET_SCHEMA_VERSION,
    documents: documents.map((document) =>
      isRecord(document) ? migrateDocument(document) : document,
    ),
  };
}
