import type {
  Instance,
  Net,
  RouteBranch,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";

export type MosBulkKind = "nmos" | "pmos";
export type MosBulkResolution =
  | {
      status: "explicit" | "cell-default" | "supply-default";
      instance: Instance;
      net: Net;
      materialized: boolean;
    }
  | {
      status: "no-connect" | "unresolved";
      instance: Instance;
      net: undefined;
      materialized: false;
    };

export function mosBulkKind(instance: Instance): MosBulkKind | undefined {
  return instance.symbolId === "nmos" || instance.symbolId === "pmos"
    ? instance.symbolId
    : undefined;
}

/**
 * The letter `B` is overloaded by SPICE symbols: it is MOS bulk but BJT base.
 * Keep that distinction at the semantic boundary so presentation and editing
 * code never turn an ordinary BJT base wire into a MOS bulk route.
 */
export function isMosBulkTerminal(
  document: SchematicDocument,
  endpoint: RouteEndpoint,
): boolean {
  if (endpoint.kind !== "terminal" || endpoint.pinName !== "B") return false;
  const instance = document.instances.find(
    (candidate) => candidate.id === endpoint.instanceId,
  );
  return Boolean(instance && mosBulkKind(instance));
}

/** A dashed Route is meaningful only when it visibly represents MOS bulk. */
export function isMosBulkRoute(
  document: SchematicDocument,
  route: RouteBranch,
): boolean {
  return (
    route.presentation === "bulk-dashed" &&
    [route.from, route.to].some((endpoint) =>
      isMosBulkTerminal(document, endpoint),
    )
  );
}

/**
 * Single authority for MOS body intent. Net membership remains the electrical
 * truth; this function only explains whether that truth was explicit or was
 * materialized from a configured cell default. MOS polarity never creates or
 * selects a named supply Net.
 */
export function resolveMosBulkConnection(
  document: SchematicDocument,
  instanceOrId: Instance | string,
): MosBulkResolution | undefined {
  const instance =
    typeof instanceOrId === "string"
      ? document.instances.find((candidate) => candidate.id === instanceOrId)
      : instanceOrId;
  if (!instance || !mosBulkKind(instance)) return undefined;

  const connectedNet = document.nets.find((net) =>
    net.terminals.some(
      (terminal) =>
        terminal.instanceId === instance.id && terminal.pinName === "B",
    ),
  );
  if (connectedNet) {
    const origin = instance.mosBulkBinding;
    return {
      status: origin?.netId === connectedNet.id ? origin.origin : "explicit",
      instance,
      net: connectedNet,
      materialized: true,
    };
  }

  if (
    document.noConnects.some(
      (item) =>
        item.endpoint.kind === "terminal" &&
        item.endpoint.instanceId === instance.id &&
        item.endpoint.pinName === "B",
    )
  ) {
    return {
      status: "no-connect",
      instance,
      net: undefined,
      materialized: false,
    };
  }

  // Imported/source-bound MOS instances must already carry the fourth SPICE
  // node. Never repair missing source data by guessing a body connection.
  if (instance.sourceRef || instance.importProvenance) {
    return {
      status: "unresolved",
      instance,
      net: undefined,
      materialized: false,
    };
  }

  const kind = mosBulkKind(instance)!;
  const configuredId =
    kind === "nmos"
      ? document.mosBulkDefaults?.nmosNetId
      : document.mosBulkDefaults?.pmosNetId;
  const configured = configuredId
    ? document.nets.find((net) => net.id === configuredId)
    : undefined;
  if (configured) {
    return {
      status: "cell-default",
      instance,
      net: configured,
      materialized: false,
    };
  }

  return {
    status: "unresolved",
    instance,
    net: undefined,
    materialized: false,
  };
}

/**
 * Recognize the narrow legacy failure produced when an imported source Net was
 * physically split around hidden body terminals. SPICE source Evidence is
 * provenance, never electrical union; it is used here only as repair evidence
 * when the detached Net contains MOS B terminals and no authored geometry.
 */
export function resolveDetachedMosBulkDefault(
  document: SchematicDocument,
  instanceOrId: Instance | string,
): Net | undefined {
  const instance =
    typeof instanceOrId === "string"
      ? document.instances.find((candidate) => candidate.id === instanceOrId)
      : instanceOrId;
  const kind = instance ? mosBulkKind(instance) : undefined;
  if (!instance || !kind) return undefined;
  const configuredNetId =
    kind === "nmos"
      ? document.mosBulkDefaults?.nmosNetId
      : document.mosBulkDefaults?.pmosNetId;
  const configuredNet = configuredNetId
    ? document.nets.find((net) => net.id === configuredNetId)
    : undefined;
  const connectedNet = document.nets.find((net) =>
    net.terminals.some(
      (terminal) =>
        terminal.instanceId === instance.id && terminal.pinName === "B",
    ),
  );
  if (
    !configuredNet ||
    !connectedNet ||
    connectedNet.id === configuredNet.id ||
    connectedNet.terminals.length === 0 ||
    connectedNet.terminals.some((terminal) => {
      if (terminal.pinName !== "B") return true;
      const peer = document.instances.find(
        (candidate) => candidate.id === terminal.instanceId,
      );
      return !peer || !mosBulkKind(peer);
    }) ||
    document.routes.some((route) => route.netId === connectedNet.id) ||
    document.junctions.some((junction) => junction.netId === connectedNet.id)
  ) {
    return undefined;
  }
  const sourceIds = (netId: string) =>
    new Set(
      document.connectivityEvidence.flatMap((evidence) =>
        evidence.kind === "spice-source" && evidence.netId === netId
          ? [evidence.sourceNetId]
          : [],
      ),
    );
  const connectedSourceIds = sourceIds(connectedNet.id);
  const configuredSourceIds = sourceIds(configuredNet.id);
  return [...connectedSourceIds].some((sourceId) =>
    configuredSourceIds.has(sourceId),
  )
    ? configuredNet
    : undefined;
}

export function mosBulkShouldBeVisible(
  document: SchematicDocument,
  instanceOrId: Instance | string,
): boolean {
  const resolution = resolveMosBulkConnection(document, instanceOrId);
  if (resolution?.status !== "explicit") return false;
  return true;
}
