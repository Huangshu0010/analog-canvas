import { createHash } from "node:crypto";

import type { CircuitProject, SchematicDocument } from "@icm/model";

// ADR 0010 electricalTopologyHash. Covers only electrical facts so the
// schema-1 -> schema-2 annotation/drafting migration preserves topology
// identity. Excludes placement/rotation/mirror, Route geometry, Junction
// placement, annotations, drafting objects, and guides. This is the
// migration-identity hash referenced by the agent-api spec.

/**
 * Canonical electrical projection of one Document: instance ids + symbol +
 * variant, port ids + direction, and per-Net terminal/port membership. Order
 * is deterministic so identical electrical content hashes identically.
 */
function electricalProjection(document: SchematicDocument): unknown {
  const instances = [...document.instances]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((instance) => ({
      id: instance.id,
      symbolId: instance.symbolId,
      symbolVariantId: instance.symbolVariantId,
    }));
  const ports = [...document.ports]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((port) => ({ id: port.id, direction: port.direction }));
  const nets = [...document.nets]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((net) => ({
      id: net.id,
      scope: net.scope,
      terminals: [...net.terminals].sort((left, right) =>
        `${left.instanceId}:${left.pinName}`.localeCompare(
          `${right.instanceId}:${right.pinName}`,
        ),
      ),
      ports: [...net.ports].sort((left, right) => left.localeCompare(right)),
    }));
  return { instances, ports, nets };
}

/**
 * Compute a lowercase SHA-256 electrical topology hash for a Project. Two
 * Projects with identical electrical facts (instances, ports, Nets and their
 * membership, document identity) produce the same hash regardless of
 * placement, routing geometry, annotations, or drafting.
 */
export function electricalTopologyHash(project: CircuitProject): string {
  const documents = [...project.documents]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((document) => ({
      id: document.id,
      electrical: electricalProjection(document),
    }));
  const canonical = JSON.stringify({
    projectId: project.id,
    topDocumentId: project.topDocumentId,
    documents,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
