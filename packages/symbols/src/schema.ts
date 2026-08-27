import { z } from "zod";

import {
  SYMBOL_CONNECTION_GRID,
  SymbolDefinitionSchema,
  SymbolPinRoutingSchema,
  SymbolPinSchema,
  SymbolPrimitiveSchema,
  SymbolStrokeRoleSchema,
  SymbolVariantSchema,
} from "@icm/model";

/**
 * ADR 0047: the persisted Symbol artwork schema lives in `@icm/model` (the
 * persistence boundary validates custom symbols). This module re-exports it
 * so existing `@icm/symbols` import sites keep working unchanged.
 */
export {
  SYMBOL_CONNECTION_GRID,
  SymbolDefinitionSchema,
  SymbolPinRoutingSchema,
  SymbolPinSchema,
  SymbolPrimitiveSchema,
  SymbolStrokeRoleSchema,
  SymbolVariantSchema,
};
export type {
  SymbolDefinition,
  SymbolPin,
  SymbolPrimitive,
  SymbolStrokeRole,
  SymbolVariant,
} from "@icm/model";

export const SymbolDefinitionJsonSchema = z.toJSONSchema(
  SymbolDefinitionSchema,
  {
    target: "draft-2020-12",
  },
);
