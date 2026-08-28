import { SymbolDefinitionSchema } from "@icm/symbols";
import type { SymbolDefinition } from "@icm/symbols";

export type ImportedSymbolParseResult =
  | { readonly ok: true; readonly symbol: SymbolDefinition }
  | { readonly ok: false; readonly message: string };

/**
 * Parse one imported symbol file (ADR 0047). The file is a bare Symbol DSL
 * `SymbolDefinition` as the schema validates it; its embedded `id` is accepted
 * but never trusted — the runtime re-keys the symbol to the definition
 * identity at the persistence boundary.
 */
export function parseImportedSymbolJson(text: string): ImportedSymbolParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: "The symbol file is not valid JSON" };
  }
  const symbol = SymbolDefinitionSchema.safeParse(parsed);
  if (!symbol.success) {
    const firstIssue = symbol.error.issues[0];
    const location = firstIssue?.path.length
      ? ` at ${firstIssue.path.join(".")}`
      : "";
    return {
      ok: false,
      message: `Invalid symbol definition${location}: ${firstIssue?.message ?? "schema validation failed"}`,
    };
  }
  return { ok: true, symbol: symbol.data };
}
