import { SymbolDefinitionSchema } from "./schema.js";
import type { SymbolDefinition, SymbolPin, SymbolPrimitive } from "./schema.js";

const GENERIC_BLOCK_PATTERN = /^generic-block-([1-9][0-9]*)$/u;

export function genericBlockPinCount(symbolId: string): number | null {
  const match = GENERIC_BLOCK_PATTERN.exec(symbolId);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isSafeInteger(count) && count <= 256 ? count : null;
}

export function createGenericBlockSymbol(pinCount: number): SymbolDefinition {
  if (!Number.isSafeInteger(pinCount) || pinCount < 1 || pinCount > 256) {
    throw new Error("Generic block pin count must be an integer from 1 to 256");
  }
  const leftCount = Math.ceil(pinCount / 2);
  const rightCount = pinCount - leftCount;
  const rows = Math.max(leftCount, rightCount, 1);
  const height = Math.max(40, rows * 20 + 20);
  const top = -height / 2;
  const pins: SymbolPin[] = [];
  const primitives: SymbolPrimitive[] = [
    {
      kind: "polyline",
      points: [
        { x: -25, y: top + 5 },
        { x: 25, y: top + 5 },
        { x: 25, y: -top - 5 },
        { x: -25, y: -top - 5 },
        { x: -25, y: top + 5 },
      ],
    },
  ];

  for (let index = 0; index < pinCount; index += 1) {
    const onLeft = index < leftCount;
    const row = onLeft ? index : index - leftCount;
    const y = top + 20 * (row + 1);
    const atX = onLeft ? -40 : 40;
    const bodyX = onLeft ? -25 : 25;
    pins.push({
      name: `P${index + 1}`,
      role: "positional",
      at: { x: atX, y },
      direction: onLeft ? "west" : "east",
      presentation: {
        visibility: "visible",
        leadLength: 15,
        showName: true,
      },
    });
    primitives.push({
      kind: "line",
      from: { x: atX, y },
      to: { x: bodyX, y },
    });
  }

  return SymbolDefinitionSchema.parse({
    schemaVersion: 1,
    id: `generic-block-${pinCount}`,
    name: `Generic ${pinCount}-pin Block`,
    viewBox: { x: -40, y: top, width: 80, height },
    pins,
    primitives,
    variants: [],
    aliases: [],
  });
}
