import type { SchematicEdit, WireSource } from "@icm/edit-engine";
import { transformPoint } from "@icm/model";
import type { Instance, RouteEndpoint } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

const POWER_CONNECTION_BY_SYMBOL = {
  vdd: { name: "VDD", pinName: "P" },
  ground: { name: "0", pinName: "0" },
} as const;

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

function sameEndpoint(left: RouteEndpoint, right: RouteEndpoint): boolean {
  switch (left.kind) {
    case "terminal":
      return (
        right.kind === "terminal" &&
        right.instanceId === left.instanceId &&
        right.pinName === left.pinName
      );
    case "port":
      return right.kind === "port" && right.portId === left.portId;
    case "junction":
      return right.kind === "junction" && right.junctionId === left.junctionId;
  }
}

/**
 * A component may acquire electrical connectivity only from an exact visible
 * pin-to-pin/pin-to-junction contact. Grid coincidence alone is deliberately
 * insufficient. Multiple contacts are ambiguous and remain explicit wiring
 * work rather than silently shorting Nets.
 */
export function proposePlacementContact(
  resolver: SymbolResolver,
  instance: Instance,
  targets: readonly WireSource[],
): PlacementContactProposal {
  const contacts = newInstanceEndpoints(resolver, instance).flatMap((source) =>
    targets
      .filter((target) => samePoint(source.point, target.point))
      .map((target) => ({ source, target })),
  );
  if (contacts.length !== 1) {
    return { edits: [], matched: false, ambiguous: contacts.length > 1 };
  }
  const { source, target } = contacts[0]!;
  const power =
    POWER_CONNECTION_BY_SYMBOL[
      instance.symbolId as keyof typeof POWER_CONNECTION_BY_SYMBOL
    ];
  const newNetId = `net-contact-${instance.id.toLowerCase()}`;
  const createsNet = target.netId === null;
  const edit: SchematicEdit = {
    kind: "connect_endpoints",
    from: source.endpoint,
    to: target.endpoint,
    ...(createsNet ? { newNetId } : {}),
    ...(createsNet && power
      ? { newNetName: power.name, newNetScope: "global" as const }
      : {}),
  };
  return {
    edits: [edit],
    matched: true,
    ambiguous: false,
    ...(power && createsNet ? { powerNetId: newNetId } : {}),
    ...(power ? { powerEndpoint: source.endpoint } : {}),
  };
}

export function proposedStandalonePowerConnection(
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
    ],
    matched: false,
    ambiguous: false,
    powerNetId: netId,
    powerEndpoint: endpoint,
  };
}

/**
 * Repair only legacy visual contacts that are unambiguous by construction:
 * the P/0 pin of a placed power symbol touches exactly one other visible
 * endpoint. Existing distinct Nets are deliberately left alone; visual
 * overlap must never implicitly merge electrical Nets.
 */
export function proposeLegacyPowerContactReconciliation(
  resolver: SymbolResolver,
  instances: readonly Instance[],
  targets: readonly WireSource[],
): readonly SchematicEdit[] {
  return instances.flatMap((instance) => {
    const power =
      POWER_CONNECTION_BY_SYMBOL[
        instance.symbolId as keyof typeof POWER_CONNECTION_BY_SYMBOL
      ];
    if (!power) return [];
    const source = targets.find(
      (target) =>
        target.endpoint.kind === "terminal" &&
        target.endpoint.instanceId === instance.id &&
        target.endpoint.pinName === power.pinName,
    );
    if (!source) return [];
    const contacts = targets.filter(
      (target) =>
        !sameEndpoint(source.endpoint, target.endpoint) &&
        samePoint(source.point, target.point),
    );
    if (contacts.length !== 1) return [];
    const target = contacts[0]!;
    if (
      (source.netId && source.netId === target.netId) ||
      (source.netId && target.netId)
    ) {
      return [];
    }
    const proposal = proposePlacementContact(
      resolver,
      instance,
      targets.filter(
        (candidate) => !sameEndpoint(source.endpoint, candidate.endpoint),
      ),
    );
    return proposal.matched && !proposal.ambiguous ? proposal.edits : [];
  });
}
