export interface SymbolInsertRequest {
  kind: "symbol";
  symbolId: string;
  symbolName: string;
  parameters: Record<string, string>;
  initialRotation: 0 | 90 | 180 | 270;
  showReference: boolean;
  referenceText: string | null;
  showValue: boolean;
  portRole?: "net-port" | "cell-terminal";
  portName?: string;
  portDirection?: "input" | "output" | "inout" | "passive";
}

export interface VddRailInsertRequest {
  kind: "vdd-rail";
  symbolId: "vdd";
  symbolName: "VDD Rail";
  netName: string;
}

export interface CellInsertRequest {
  kind: "cell";
  symbolId: string;
  symbolName: string;
  childDocumentId: string;
  cellName: string;
  parameters: Record<string, string>;
  initialRotation: 0 | 90 | 180 | 270;
  showReference: boolean;
  referenceText: string | null;
  showValue: true;
}

export interface ExternalSubcircuitInsertRequest {
  kind: "external-subcircuit";
  symbolId: string;
  symbolName: string;
  definitionId: string;
  masterName: string;
  parameters: Record<string, string>;
  initialRotation: 0 | 90 | 180 | 270;
  showReference: boolean;
  referenceText: string | null;
  showValue: true;
}

export type ComponentInsertRequest =
  | SymbolInsertRequest
  | CellInsertRequest
  | ExternalSubcircuitInsertRequest
  | VddRailInsertRequest;
