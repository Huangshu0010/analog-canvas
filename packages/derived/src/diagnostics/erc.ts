import type { CircuitProject } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import type { ProjectConnectivityIndex } from "../connectivity-index.js";
import { directObjectLocator, type ObjectLocator } from "../object-locator.js";
import type { Diagnostic, DiagnosticSeverity } from "./diagnostic.js";

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

/** Compatibility aliases for ERC consumers; their protocol is Diagnostic. */
export type ErcSeverity = DiagnosticSeverity;
export type ErcDiagnostic = Diagnostic & { domain: "erc" };

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
): ObjectLocator {
  return {
    ...directObjectLocator(documentId, "terminal", `${instanceId}:${pinName}`),
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

    // ERC_UNRESOLVED_SYMBOL and hierarchy interface checks. These run before
    // pin connectivity checks so unknown symbols never get silently skipped.
    for (const instance of document.instances) {
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (!resolved) {
        diagnostics.push({
          id: `erc:unresolved-symbol:${document.id}:${instance.id}`,
          domain: "erc",
          code: "ERC_UNRESOLVED_SYMBOL",
          severity: "error",
          confidence: "high",
          gateEligible: true,
          message: `Instance ${instance.id} references unresolved symbol ${instance.symbolId}`,
          primary: directObjectLocator(document.id, "instance", instance.id),
          related: [],
          parameters: { instanceId: instance.id, symbolId: instance.symbolId },
        });
      }

      const childDocumentId = instance.properties["spice.childDocumentId"];
      if (typeof childDocumentId !== "string") continue;
      const child = project.documents.find(
        (candidate) => candidate.id === childDocumentId,
      );
      if (!child) {
        diagnostics.push({
          id: `erc:hierarchy-target-missing:${document.id}:${instance.id}`,
          domain: "erc",
          code: "ERC_HIERARCHY_TARGET_MISSING",
          severity: "error",
          confidence: "high",
          gateEligible: true,
          message: `Instance ${instance.id} references missing child document ${childDocumentId}`,
          primary: directObjectLocator(document.id, "instance", instance.id),
          related: [],
          parameters: { instanceId: instance.id, childDocumentId },
        });
        continue;
      }
      if (!resolved) continue;
      const pinNames = new Set(resolved.definition.pins.map((pin) => pin.name));
      const childPortNames = new Set(child.ports.map((port) => port.name));
      if (pinNames.size !== childPortNames.size) {
        diagnostics.push({
          id: `erc:port-count-mismatch:${document.id}:${instance.id}`,
          domain: "erc",
          code: "ERC_PORT_COUNT_MISMATCH",
          severity: "error",
          confidence: "high",
          gateEligible: true,
          message: `Instance ${instance.id} has ${pinNames.size} symbol pins but child document ${child.id} has ${childPortNames.size} ports`,
          primary: directObjectLocator(document.id, "instance", instance.id),
          related: child.ports.map((port) =>
            directObjectLocator(child.id, "port", port.id),
          ),
          parameters: {
            instanceId: instance.id,
            pinCount: pinNames.size,
            portCount: childPortNames.size,
          },
        });
      }
      const mismatchedPorts = child.ports.filter(
        (port) => !pinNames.has(port.name),
      );
      const unmatchedPins = resolved.definition.pins.filter(
        (pin) => !childPortNames.has(pin.name),
      );
      if (mismatchedPorts.length > 0 || unmatchedPins.length > 0) {
        diagnostics.push({
          id: `erc:port-name-mismatch:${document.id}:${instance.id}`,
          domain: "erc",
          code: "ERC_PORT_NAME_MISMATCH",
          severity: "error",
          confidence: "high",
          gateEligible: true,
          message: `Instance ${instance.id} symbol pins do not match child document ${child.id} port names`,
          primary: directObjectLocator(document.id, "instance", instance.id),
          related: mismatchedPorts.map((port) =>
            directObjectLocator(child.id, "port", port.id),
          ),
          parameters: {
            instanceId: instance.id,
            childDocumentId: child.id,
            unmatchedPortCount: mismatchedPorts.length,
            unmatchedPinCount: unmatchedPins.length,
          },
        });
      }
    }

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
        primary: directObjectLocator(document.id, "instance", primaryId!),
        related: restIds.map((objectId) =>
          directObjectLocator(document.id, "instance", objectId),
        ),
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
        primary: directObjectLocator(document.id, "net", primaryId!),
        related: restIds.map((objectId) =>
          directObjectLocator(document.id, "net", objectId),
        ),
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
          ...directObjectLocator(document.id, "no-connect", noConnect.id),
          endpoint: noConnect.endpoint,
        },
        related: [directObjectLocator(document.id, "net", owner)],
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
