import type { NetlistDeviceClass, StableId } from "@icm/model";

export type DeviceNetlistTargetPolicy =
  "builtin" | "required-model" | "child-cell" | "none";

export interface DeviceCapabilities {
  readonly supportsModel: boolean;
  readonly supportsBulkBinding: boolean;
  readonly supportsValueAnnotation: boolean;
}

export interface DeviceDescriptor {
  readonly symbolId: StableId;
  readonly deviceClass: NetlistDeviceClass;
  readonly referencePrefix: string | null;
  readonly pinOrder: readonly string[];
  readonly targetPolicy: DeviceNetlistTargetPolicy;
  readonly requiredParameters: readonly string[];
  readonly dialects: readonly ["spice", "spectre"];
  readonly capabilities: DeviceCapabilities;
}

/** Existing public term retained for netlist consumers. */
export type DeviceNetlistDefinition = Omit<DeviceDescriptor, "capabilities">;

export interface DeviceDescriptorIssue {
  readonly symbolId: string;
  readonly message: string;
}

/** Existing public term retained for netlist consumers. */
export type DeviceNetlistDefinitionIssue = DeviceDescriptorIssue;
