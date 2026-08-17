import {
  proposeEndpointRouteAttachment,
  type SchematicEdit,
  type WireSource,
} from "@icm/edit-engine";
import {
  findRouteSegmentsAtPoint,
  resolveDocumentRoutingGeometry,
  resolveElectricalContactTargets,
} from "@icm/derived";
import type {
  ElectricalContactCandidate,
  ElectricalContactTarget,
} from "@icm/derived";
import { transformPoint } from "@icm/model";
import type { Instance, RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

const POWER_CONNECTION_BY_SYMBOL = {
  ground: { name: "0", pinName: "0", domain: "ground" },
  "vdd-port": { name: "VDD", pinName: "P", domain: "vdd" },
} as const;

export type SymbolPowerConnection =
  (typeof POWER_CONNECTION_BY_SYMBOL)[keyof typeof POWER_CONNECTION_BY_SYMBOL];

export function powerConnectionForSymbol(
  symbolId: string,
): SymbolPowerConnection | undefined {
  return POWER_CONNECTION_BY_SYMBOL[
    symbolId as keyof typeof POWER_CONNECTION_BY_SYMBOL
  ];
}

export interface PlacementContactProposal {
  edits: readonly SchematicEdit[];
  matched: boolean;
  ambiguous: boolean;
  powerNetId?: string;
  powerEndpoint?: RouteEndpoint;
}

function newInstanceEndpoints(
  resolver: SymbolResolver,
  instance: Instance,
): readonly WireSource[] {
  if (!instance.placement) return [];
  const resolved = resolver.resolve(
    instance.symbolId,
    instance.symbolVariantId,
  );
  if (!resolved) return [];
  return resolved.definition.pins.flatMap((pin): WireSource[] => {
    const endpoint = {
      kind: "terminal" as const,
      instanceId: instance.id,
      pinName: pin.name,
    };
    return !resolved.variant?.hiddenPinNames.includes(pin.name) &&
      pin.presentation.visibility !== "implicit"
      ? [
          {
            endpoint,
            netId: null,
            point: transformPoint(
              pin.at,
              instance.placement!.position,
              instance.placement!,
            ),
            preludeEdits: [],
          },
        ]
      : [];
  });
}

function samePoint(
  left: { x: number; y: number },
  right: { x: number; y: number },
): boolean {
  return left.x === right.x && left.y === right.y;
}

/**
 * A component may acquire electrical connectivity only from an exact visible
 * pin-to-pin, pin-to-Junction, or pin-to-Route contact. Grid coincidence alone
 * is deliberately insufficient. Multiple independent contacts commit
 * together; multiple disconnected conductors at one point remain ambiguous.
 */
export function proposePlacementContact(
  document: SchematicDocument,
  resolver: SymbolResolver,
  instance: Instance,
  targets: readonly WireSource[],
): PlacementContactProposal {
  const contacts: Array<{
    source: WireSource;
    target: ElectricalContactTarget;
  }> = [];
  let ambiguous = false;
  const routingGeometry = resolveDocumentRoutingGeometry(document, resolver);
  for (const source of newInstanceEndpoints(resolver, instance)) {
    const candidates: ElectricalContactCandidate[] = targets
      .filter((target) => samePoint(source.point, target.point))
      .map((target) => ({
        kind: "endpoint" as const,
        id: `endpoint:${JSON.stringify(target.endpoint)}`,
        point: target.point,
        netId: target.netId,
        endpoint: target.endpoint,
      }));
    for (const address of findRouteSegmentsAtPoint(
      routingGeometry,
      source.point,
    )) {
      const route = document.routes.find(
        (candidate) => candidate.id === address.routeId,
      );
      if (!route) continue;
      candidates.push({
        kind: "route" as const,
        id: `route:${route.id}:${address.segmentIndex}`,
        point: source.point,
        netId: route.netId,
        routeId: route.id,
        segmentIndex: address.segmentIndex,
      });
    }
    const groups = resolveElectricalContactTargets(
      document,
      resolver,
      candidates,
    );
    if (groups.length === 1) contacts.push({ source, target: groups[0]! });
    else if (groups.length > 1) ambiguous = true;
  }
  if (ambiguous) {
    return { edits: [], matched: false, ambiguous: true };
  }
  if (contacts.length === 0) {
    return { edits: [], matched: false, ambiguous: false };
  }
  const routeIds = contacts.flatMap((contact) =>
    contact.target.route ? [contact.target.route.routeId] : [],
  );
  if (new Set(routeIds).size !== routeIds.length) {
    return { edits: [], matched: false, ambiguous: true };
  }
  const power =
    POWER_CONNECTION_BY_SYMBOL[
      instance.symbolId as keyof typeof POWER_CONNECTION_BY_SYMBOL
    ];
  const edits: SchematicEdit[] = [];
  let powerNetId: string | undefined;
  let powerEndpoint: RouteEndpoint | undefined;
  for (const contact of contacts) {
    const { source, target } = contact;
    if (target.endpoint) {
      const newNetId =
        contacts.length === 1
          ? `net-contact-${instance.id.toLowerCase()}`
          : `net-contact-${instance.id.toLowerCase()}-${
              source.endpoint.kind === "terminal"
                ? source.endpoint.pinName.toLowerCase()
                : "pin"
            }`;
      const createsNet = target.endpoint.netId === null;
      edits.push({
        kind: "connect_endpoints",
        from: source.endpoint,
        to: target.endpoint.endpoint,
        ...(createsNet ? { newNetId } : {}),
        ...(createsNet && power
          ? { newNetName: power.name, newNetScope: "global" as const }
          : {}),
      });
      if (power && createsNet) powerNetId = newNetId;
      else if (power && target.endpoint.netId) {
        powerNetId = target.endpoint.netId;
      }
    } else if (target.route) {
      edits.push(
        ...proposeEndpointRouteAttachment(
          document,
          source.endpoint,
          null,
          target.route.routeId,
          source.point,
          target.route.segmentIndex,
          `contact-${instance.id.toLowerCase()}-${source.endpoint.kind === "terminal" ? source.endpoint.pinName.toLowerCase() : "pin"}`,
        ).edits,
      );
      if (power) powerNetId = target.route.netId;
    }
    if (power) powerEndpoint = source.endpoint;
  }
  // A visual marker may name a new Net, but it never remains the runtime
  // source of electrical truth: persist that identity in the same edit batch.
  if (power && powerNetId) {
    edits.push({
      kind: "set_net_power_domain",
      netId: powerNetId,
      powerDomain: power.domain,
    });
  }
  return {
    edits,
    matched: true,
    ambiguous: false,
    ...(powerNetId ? { powerNetId } : {}),
    ...(powerEndpoint ? { powerEndpoint } : {}),
  };
}

export function proposedStandalonePowerConnection(
  document: SchematicDocument,
  instance: Instance,
): PlacementContactProposal {
  const power =
    POWER_CONNECTION_BY_SYMBOL[
      instance.symbolId as keyof typeof POWER_CONNECTION_BY_SYMBOL
    ];
  if (!power) return { edits: [], matched: false, ambiguous: false };
  const endpoint: RouteEndpoint = {
    kind: "terminal",
    instanceId: instance.id,
    pinName: power.pinName,
  };
  const netId = `net-power-${instance.id.toLowerCase()}`;
  const existingSupplyNet = document.nets.find(
    (net) =>
      net.scope === "global" && (net.powerDomain ?? "none") === power.domain,
  );
  return {
    edits: [
      {
        kind: "connect_endpoints",
        from: endpoint,
        to: endpoint,
        newNetId: netId,
        newNetName: power.name,
        newNetScope: "global",
      },
      {
        kind: "set_net_power_domain",
        netId,
        powerDomain: power.domain,
      },
      ...(existingSupplyNet
        ? [
            {
              kind: "merge_nets" as const,
              targetNetId: existingSupplyNet.id,
              sourceNetId: netId,
            },
          ]
        : []),
    ],
    matched: false,
    ambiguous: false,
    powerNetId: existingSupplyNet?.id ?? netId,
    powerEndpoint: endpoint,
  };
}
