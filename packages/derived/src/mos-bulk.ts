import type { Instance, Net, SchematicDocument } from "@icm/model";

export type MosBulkKind = "nmos" | "pmos";
export type MosBulkResolution =
  | {
      status: "explicit" | "cell-default" | "product-fallback";
      instance: Instance;
      net: Net;
      materialized: boolean;
    }
  | {
      status: "product-fallback";
      instance: Instance;
      net: undefined;
      materialized: false;
      fallbackName: "0" | "VDD";
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

function fallbackNet(
  document: SchematicDocument,
  kind: MosBulkKind,
): Net | undefined {
  const domain = kind === "nmos" ? "ground" : "vdd";
  return document.nets.find((net) => (net.powerDomain ?? "none") === domain);
}

/**
 * Single authority for MOS body intent. Net membership remains the electrical
 * truth; this function only explains whether that truth was explicit or was
 * materialized from a cell/product default.
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

  const fallback = fallbackNet(document, kind);
  return fallback
    ? {
        status: "product-fallback",
        instance,
        net: fallback,
        materialized: false,
      }
    : {
        status: "product-fallback",
        instance,
        net: undefined,
        materialized: false,
        fallbackName: kind === "nmos" ? "0" : "VDD",
      };
}

export function mosBulkShouldBeVisible(
  document: SchematicDocument,
  instanceOrId: Instance | string,
): boolean {
  const resolution = resolveMosBulkConnection(document, instanceOrId);
  if (resolution?.status !== "explicit") return false;
  const kind = mosBulkKind(resolution.instance)!;
  const configuredId =
    kind === "nmos"
      ? document.mosBulkDefaults?.nmosNetId
      : document.mosBulkDefaults?.pmosNetId;
  if (configuredId === resolution.net.id) return false;
  const expectedDomain = kind === "nmos" ? "ground" : "vdd";
  return (
    (resolution.net.powerDomain ?? "none") !== expectedDomain &&
    fallbackNet(document, kind)?.id !== resolution.net.id
  );
}
