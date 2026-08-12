import type { CircuitProject } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import type { ProjectConnectivityIndex } from "../connectivity-index.js";

/**
 * ERC engine (roadmap §8 R8). Emits the unified ADR 0015 `Diagnostic` envelope
 * with `domain: "erc"`, driven by the `ProjectConnectivityIndex` (WP-R2) and the
 * persisted `NoConnect` records (WP-R7). Electrical rules are kept strictly
 * separate from visual/routing observations (ADR 0015): a visual observation
 * count is never proof of electrical correctness.
 *
 * This first batch covers the name-conflict, NoConnect-conflict, and unconnected-
 * pin rules. Role-specific (floating gate/bulk), model-binding, and hierarchy
 * rules extend the same framework in follow-on targets.
 */

export type ErcSeverity = "error" | "warning" | "info";

export type ErcLocatorKind =
  | "document"
  | "instance"
  | "net"
  | "route"
  | "junction"
  | "terminal"
  | "port"
  | "annotation"
  | "no-connect";

export interface ErcEndpoint {
  kind: "terminal" | "port";
  instanceId?: string;
  pinName?: string;
  portId?: string;
}

export interface ErcLocator {
  documentId: string;
  kind: ErcLocatorKind;
  objectId: string;
  endpoint?: ErcEndpoint;
}

export interface ErcDiagnostic {
  id: string;
  domain: "erc";
  code: string;
  severity: ErcSeverity;
  confidence: "high" | "medium" | "low";
  gateEligible: boolean;
  message: string;
  primary: ErcLocator;
  related: readonly ErcLocator[];
  parameters: Readonly<Record<string, string | number | boolean>>;
}

function noConnectKey(endpoint: {
  kind: "terminal" | "port";
  instanceId?: string;
  pinName?: string;
  portId?: string;
}): string {
  return endpoint.kind === "terminal"
    ? `terminal:${endpoint.instanceId}:${endpoint.pinName}`
    : `port:${endpoint.portId}`;
}

function terminalLocator(
  documentId: string,
  instanceId: string,
  pinName: string,
): ErcLocator {
  return {
    documentId,
    kind: "terminal",
    objectId: `${instanceId}:${pinName}`,
    endpoint: { kind: "terminal", instanceId, pinName },
  };
}

export function runErcChecks(
  project: CircuitProject,
  index: ProjectConnectivityIndex,
  resolver: SymbolResolver,
): readonly ErcDiagnostic[] {
  const diagnostics: ErcDiagnostic[] = [];
  const documents = [...project.documents].sort((a, b) =>
    a.id.localeCompare(b.id, "en"),
  );

  for (const document of documents) {
    const docIndex = index.documents.get(document.id);
    const endpointToNet = docIndex?.endpointToNet ?? new Map<string, string>();
    const noConnectEndpoints = new Set(
      document.noConnects.map((noConnect) => noConnectKey(noConnect.endpoint)),
    );

    // ERC_DUPLICATE_INSTANCE_NAME
    const instancesByName = new Map<string, string[]>();
    for (const instance of document.instances) {
      const spiceName = instance.properties["spice.name"];
      const name = (
        typeof spiceName === "string" && spiceName.length > 0
          ? spiceName
          : instance.id
      ).toLowerCase();
      const group = instancesByName.get(name) ?? [];
      group.push(instance.id);
      instancesByName.set(name, group);
    }
    for (const [name, ids] of instancesByName) {
      if (ids.length < 2) continue;
      const [primaryId, ...restIds] = [...ids].sort((a, b) =>
        a.localeCompare(b, "en"),
      );
      diagnostics.push({
        id: `erc:dup-instance:${document.id}:${name}`,
        domain: "erc",
        code: "ERC_DUPLICATE_INSTANCE_NAME",
        severity: "error",
        confidence: "high",
        gateEligible: true,
        message: `Instance name "${name}" is used by ${ids.length} instances in document ${document.id}`,
        primary: {
          documentId: document.id,
          kind: "instance",
          objectId: primaryId!,
        },
        related: restIds.map((objectId) => ({
          documentId: document.id,
          kind: "instance" as const,
          objectId,
        })),
        parameters: { name, count: ids.length },
      });
    }

    // ERC_DUPLICATE_NET_NAME
    const netsByName = new Map<string, string[]>();
    for (const net of document.nets) {
      if (!net.name) continue;
      const name = net.name.toLowerCase();
      const group = netsByName.get(name) ?? [];
      group.push(net.id);
      netsByName.set(name, group);
    }
    for (const [name, ids] of netsByName) {
      if (ids.length < 2) continue;
      const [primaryId, ...restIds] = [...ids].sort((a, b) =>
        a.localeCompare(b, "en"),
      );
      diagnostics.push({
        id: `erc:dup-net:${document.id}:${name}`,
        domain: "erc",
        code: "ERC_DUPLICATE_NET_NAME",
        severity: "error",
        confidence: "high",
        gateEligible: true,
        message: `Net name "${name}" is shared by ${ids.length} nets in document ${document.id} without an explicit merge`,
        primary: { documentId: document.id, kind: "net", objectId: primaryId! },
        related: restIds.map((objectId) => ({
          documentId: document.id,
          kind: "net" as const,
          objectId,
        })),
        parameters: { name, count: ids.length },
      });
    }

    // ERC_NO_CONNECT_CONFLICT
    for (const noConnect of document.noConnects) {
      const owner = endpointToNet.get(noConnectKey(noConnect.endpoint));
      if (!owner) continue;
      diagnostics.push({
        id: `erc:no-connect-conflict:${document.id}:${noConnect.id}`,
        domain: "erc",
        code: "ERC_NO_CONNECT_CONFLICT",
        severity: "error",
        confidence: "high",
        gateEligible: true,
        message: `NoConnect ${noConnect.id} is also connected to net ${owner}`,
        primary: {
          documentId: document.id,
          kind: "no-connect",
          objectId: noConnect.id,
          endpoint: noConnect.endpoint,
        },
        related: [{ documentId: document.id, kind: "net", objectId: owner }],
        parameters: { netId: owner, noConnectId: noConnect.id },
      });
    }

    // ERC_UNCONNECTED_PIN (v1-conservative required-pin policy: every visible
    // pin must have a Net or a NoConnect; passive-pin tolerance is deferred).
    for (const instance of document.instances) {
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (!resolved) continue;
      const hidden = new Set(resolved.variant?.hiddenPinNames ?? []);
      for (const pin of resolved.definition.pins) {
        if (hidden.has(pin.name)) continue;
        if (pin.presentation.visibility === "implicit") continue;
        const endpoint = {
          kind: "terminal" as const,
          instanceId: instance.id,
          pinName: pin.name,
        };
        const key = noConnectKey(endpoint);
        if (endpointToNet.has(key)) continue;
        if (noConnectEndpoints.has(key)) continue;
        diagnostics.push({
          id: `erc:unconnected-pin:${document.id}:${instance.id}:${pin.name}`,
          domain: "erc",
          code: "ERC_UNCONNECTED_PIN",
          severity: "warning",
          confidence: "high",
          gateEligible: false,
          message: `Pin ${instance.id}.${pin.name} is not connected and has no NoConnect`,
          primary: terminalLocator(document.id, instance.id, pin.name),
          related: [],
          parameters: { instanceId: instance.id, pinName: pin.name },
        });
      }
    }
  }

  return diagnostics.sort(
    (a, b) =>
      a.primary.documentId.localeCompare(b.primary.documentId, "en") ||
      a.code.localeCompare(b.code, "en") ||
      a.primary.objectId.localeCompare(b.primary.objectId, "en"),
  );
}
