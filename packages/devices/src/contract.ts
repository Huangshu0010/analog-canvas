import type { NetlistDeviceClass, StableId } from "@icm/model";

export type DeviceNetlistTargetPolicy =
  "builtin" | "required-model" | "child-cell" | "none";

export interface DeviceCapabilities {
  readonly supportsModel: boolean;
  readonly supportsBulkBinding: boolean;
  readonly supportsValueAnnotation: boolean;
}

export interface DeviceDescriptor {
  /** Stable device-protocol identity; it is not persisted in Project JSON. */
  readonly id: string;
  /** The exact current Symbol artwork this device uses. */
  readonly symbolId: StableId;
  readonly deviceClass: NetlistDeviceClass;
  readonly referencePrefix: string | null;
  readonly pinOrder: readonly string[];
  readonly targetPolicy: DeviceNetlistTargetPolicy;
  readonly requiredParameters: readonly string[];
  readonly dialects: readonly ["spice", "spectre"];
  readonly capabilities: DeviceCapabilities;
}

export interface DeviceDescriptorIssue {
  readonly deviceId: string;
  readonly message: string;
}

/** Minimal visual contract used only to validate registry/Symbol parity. */
export interface DeviceSymbolContract {
  readonly id: string;
  readonly pins: readonly { readonly name: string }[];
}

export interface DeviceRegistry {
  readonly descriptors: readonly DeviceDescriptor[];
  byId(id: string): DeviceDescriptor | undefined;
  bySymbolId(symbolId: string): DeviceDescriptor | undefined;
}
