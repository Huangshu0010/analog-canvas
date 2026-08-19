import { z } from "zod";

import { StableIdSchema } from "./common.js";

/** Symbol-local grid used by derived hierarchical Cell block geometry. */
export const CELL_SYMBOL_CONNECTION_GRID = 10;

function symbolGridMultiple(value: number): boolean {
  return value % CELL_SYMBOL_CONNECTION_GRID === 0;
}

export const CellSymbolSideSchema = z.enum(["north", "east", "south", "west"]);

export const CellSymbolPinPlacementSchema = z.strictObject({
  /** Stable formal-terminal identity; never a mutable pin name. */
  terminalId: StableIdSchema,
  side: CellSymbolSideSchema,
  /** Signed symbol-local distance from the body centre along `side`. */
  offset: z
    .number()
    .int()
    .refine(symbolGridMultiple, {
      message: `Cell symbol pin offset must align to the ${CELL_SYMBOL_CONNECTION_GRID}-unit connection grid`,
    }),
});

/**
 * Definition-level label position, measured from a pin's normal in-body
 * label location. `inwardOffset` is always toward the block body; keeping it
 * non-negative means a moved label cannot obscure the external wire target.
 */
export const CellSymbolPinLabelPlacementSchema = z.strictObject({
  terminalId: StableIdSchema,
  tangentOffset: z
    .number()
    .int()
    .refine(symbolGridMultiple, {
      message: `Cell symbol label tangent offset must align to the ${CELL_SYMBOL_CONNECTION_GRID}-unit connection grid`,
    }),
  inwardOffset: z
    .number()
    .int()
    .nonnegative()
    .refine(symbolGridMultiple, {
      message: `Cell symbol label inward offset must align to the ${CELL_SYMBOL_CONNECTION_GRID}-unit connection grid`,
    }),
});

export const CellSymbolBodySizeSchema = z.strictObject({
  width: z
    .number()
    .int()
    .positive()
    .refine(symbolGridMultiple, {
      message: `Cell symbol body width must align to the ${CELL_SYMBOL_CONNECTION_GRID}-unit connection grid`,
    }),
  height: z
    .number()
    .int()
    .positive()
    .refine(symbolGridMultiple, {
      message: `Cell symbol body height must align to the ${CELL_SYMBOL_CONNECTION_GRID}-unit connection grid`,
    }),
});

/**
 * Definition-level hierarchy block intent. The renderer derives artwork and
 * pin coordinates from this compact data; callers never persist a copy.
 */
export const CellSymbolPresentationSchema = z.strictObject({
  minimumBodySize: CellSymbolBodySizeSchema.optional(),
  pinPlacements: z.array(CellSymbolPinPlacementSchema).max(256).optional(),
  pinLabelPlacements: z
    .array(CellSymbolPinLabelPlacementSchema)
    .max(256)
    .optional(),
});

export const PresentationIntentSchema = z.strictObject({
  styleProfileId: StableIdSchema,
  grid: z.number().int().positive(),
  compactness: z.enum(["loose", "normal", "compact"]),
  flow: z
    .strictObject({
      power: z.literal("top").optional(),
      ground: z.literal("bottom").optional(),
      input: z.literal("left").optional(),
      output: z.literal("right").optional(),
    })
    .optional(),
  cellSymbol: CellSymbolPresentationSchema.optional(),
});
export const MosBulkDefaultsSchema = z.strictObject({
  nmosNetId: StableIdSchema.optional(),
  pmosNetId: StableIdSchema.optional(),
});
export const LayoutGroupSchema = z.strictObject({
  id: StableIdSchema,
  kind: z.enum([
    "differential-pair",
    "current-mirror",
    "matched-pair",
    "custom",
  ]),
  objectIds: z.array(StableIdSchema).min(1),
  locked: z.boolean(),
});
export const LayoutConstraintSchema = z.strictObject({
  id: StableIdSchema,
  kind: z.enum([
    "align-x",
    "align-y",
    "symmetric",
    "equal-spacing",
    "keep-clear",
  ]),
  objectIds: z.array(StableIdSchema).min(2),
  locked: z.boolean(),
});

export type CellSymbolSide = z.infer<typeof CellSymbolSideSchema>;
export type CellSymbolPinPlacement = z.infer<
  typeof CellSymbolPinPlacementSchema
>;
export type CellSymbolPinLabelPlacement = z.infer<
  typeof CellSymbolPinLabelPlacementSchema
>;
export type CellSymbolPresentation = z.infer<
  typeof CellSymbolPresentationSchema
>;
