import type { NetlistDeviceClass, StableId } from "@icm/model";

export type DesignNetlistDeviceClass = NetlistDeviceClass | "hierarchical";

export interface DesignNetlistNode {
  pinName: string;
  netName: string;
}

export interface DesignNetlistParameter {
  name: string;
  rawValue: string;
}

export interface DesignNetlistInstance {
  id: StableId;
  reference: string;
  deviceClass: DesignNetlistDeviceClass;
  target: string | null;
  nodes: DesignNetlistNode[];
  parameters: DesignNetlistParameter[];
}

export interface DesignNetlistCell {
  id: StableId;
  name: string;
  ports: Array<{ id: StableId; name: string; netName: string }>;
  nets: Array<{
    id: StableId;
    name: string;
    scope: "local" | "global";
  }>;
  instances: DesignNetlistInstance[];
}

export interface DesignNetlistIR {
  topCellId: StableId;
  cells: DesignNetlistCell[];
  globals: string[];
}

export type NetlistDiagnosticSeverity = "error" | "warning";

export interface NetlistDiagnostic {
  code: string;
  severity: NetlistDiagnosticSeverity;
  documentId: StableId;
  objectIds: StableId[];
  message: string;
}

export interface DesignNetlistExtractionResult {
  ir: DesignNetlistIR | null;
  diagnostics: NetlistDiagnostic[];
}
