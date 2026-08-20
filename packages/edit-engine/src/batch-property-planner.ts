import { deviceDescriptor } from "@icm/devices";
import type { CircuitProject, InstanceNetlistBinding } from "@icm/model";

import type { ProjectStructureEdit } from "./project-transaction.js";

export type BatchPropertyField =
  | { readonly kind: "parameter"; readonly name: string }
  | { readonly kind: "model-target" };

export interface BatchPropertyTarget {
  readonly documentId: string;
  readonly instanceId: string;
}

export interface BatchPropertyPreview {
  readonly applicable: readonly BatchPropertyTarget[];
  readonly unchanged: readonly BatchPropertyTarget[];
  readonly incompatible: readonly (BatchPropertyTarget & {
    readonly reason: string;
  })[];
  readonly blocked: readonly (BatchPropertyTarget & {
    readonly reason: string;
  })[];
  readonly edits: readonly ProjectStructureEdit[];
}

type BatchNetlistAssignment = {
  instanceId: string;
  set?: Record<string, string>;
  unset?: string[];
  binding?: InstanceNetlistBinding | null;
};

/**
 * One property-field writer for explicit multi-selection. It returns the
 * same typed netlist facts that Properties uses; the table never patches a
 * JSON path or treats a mixed value as persisted data.
 */
export function planBatchProperty(
  project: CircuitProject,
  targets: readonly BatchPropertyTarget[],
  field: BatchPropertyField,
  rawValue: string,
): BatchPropertyPreview {
  const applicable: BatchPropertyTarget[] = [];
  const unchanged: BatchPropertyTarget[] = [];
  const incompatible: Array<BatchPropertyTarget & { reason: string }> = [];
  const blocked: Array<BatchPropertyTarget & { reason: string }> = [];
  const assignmentsByDocument = new Map<string, BatchNetlistAssignment[]>();
  for (const target of targets) {
    const document = project.documents.find(
      (candidate) => candidate.id === target.documentId,
    );
    const instance = document?.instances.find(
      (candidate) => candidate.id === target.instanceId,
    );
    if (!document || !instance) {
      blocked.push({ ...target, reason: "Instance no longer exists" });
      continue;
    }
    if (!instance.netlist) {
      incompatible.push({ ...target, reason: "Symbol has no netlist record" });
      continue;
    }
    let assignment: BatchNetlistAssignment | undefined;
    if (field.kind === "parameter") {
      const parameter = deviceDescriptor(instance.symbolId)?.parameters.find(
        (parameter) =>
          parameter.name.toLowerCase() === field.name.toLowerCase(),
      );
      if (!parameter) {
        incompatible.push({
          ...target,
          reason: `${field.name} is not a descriptor parameter`,
        });
        continue;
      }
      const value = rawValue.trim();
      if (instance.netlist.parameters[parameter.name] === value) {
        unchanged.push(target);
        continue;
      }
      assignment = value
        ? { instanceId: instance.id, set: { [parameter.name]: value } }
        : { instanceId: instance.id, unset: [parameter.name] };
    } else {
      const descriptor = deviceDescriptor(instance.symbolId);
      if (descriptor?.targetPolicy !== "required-model") {
        incompatible.push({
          ...target,
          reason: "Symbol does not accept a model target",
        });
        continue;
      }
      const name = rawValue.trim();
      const current = instance.netlist.binding;
      if ((current?.kind === "model" ? current.name : "") === name) {
        unchanged.push(target);
        continue;
      }
      assignment = {
        instanceId: instance.id,
        binding: name
          ? { kind: "model", deviceClass: descriptor.deviceClass, name }
          : null,
      };
    }
    applicable.push(target);
    const assignments = assignmentsByDocument.get(document.id) ?? [];
    assignments.push(assignment);
    assignmentsByDocument.set(document.id, assignments);
  }
  const edits: ProjectStructureEdit[] = [
    ...assignmentsByDocument.entries(),
  ].map(([documentId, assignments]) => {
    const document = project.documents.find((item) => item.id === documentId)!;
    return {
      kind: "transact_document",
      documentId,
      expectedRevision: document.revision,
      edits: [{ kind: "bulk_patch_instance_netlist", assignments }],
    };
  });
  return { applicable, unchanged, incompatible, blocked, edits };
}
