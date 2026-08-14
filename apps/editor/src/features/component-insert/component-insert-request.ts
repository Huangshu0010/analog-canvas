export interface SymbolInsertRequest {
  kind: "symbol";
  symbolId: string;
  symbolName: string;
  properties: Record<string, string>;
  initialRotation: 0 | 90 | 180 | 270;
  showReference: boolean;
  referenceText: string | null;
}

export interface VddRailInsertRequest {
  kind: "vdd-rail";
  symbolId: "vdd";
  symbolName: "VDD Rail";
}

export type ComponentInsertRequest = SymbolInsertRequest | VddRailInsertRequest;
