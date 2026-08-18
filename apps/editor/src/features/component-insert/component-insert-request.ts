export interface SymbolInsertRequest {
  kind: "symbol";
  symbolId: string;
  symbolName: string;
  properties: Record<string, string>;
  initialRotation: 0 | 90 | 180 | 270;
  showReference: boolean;
  referenceText: string | null;
  showValue: boolean;
}

export interface VddRailInsertRequest {
  kind: "vdd-rail";
  symbolId: "vdd";
  symbolName: "VDD Rail";
}

export interface CellInsertRequest {
  kind: "cell";
  symbolId: string;
  symbolName: string;
  childDocumentId: string;
  cellName: string;
  properties: Record<string, string>;
  initialRotation: 0 | 90 | 180 | 270;
  showReference: boolean;
  referenceText: string | null;
  showValue: true;
}

export type ComponentInsertRequest =
  SymbolInsertRequest | CellInsertRequest | VddRailInsertRequest;
