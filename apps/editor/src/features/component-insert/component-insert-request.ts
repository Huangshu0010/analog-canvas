export interface ComponentInsertRequest {
  symbolId: string;
  symbolName: string;
  properties: Record<string, string>;
  initialRotation: 0 | 90 | 180 | 270;
  showReference: boolean;
  referenceText: string | null;
}
