import { SymbolDefinitionSchema } from "./schema.js";
import type { SymbolDefinition, SymbolVariant } from "./schema.js";

export interface ResolvedSymbol {
  definition: SymbolDefinition;
  variant?: SymbolVariant;
}

export interface SymbolResolver {
  resolve(symbolId: string, variantId?: string): ResolvedSymbol | undefined;
}

export class InMemorySymbolResolver implements SymbolResolver {
  readonly #symbols = new Map<string, SymbolDefinition>();
  readonly #aliases = new Map<string, string>();

  constructor(definitions: readonly SymbolDefinition[]) {
    for (const input of definitions) {
      const definition = SymbolDefinitionSchema.parse(input);
      if (
        this.#symbols.has(definition.id) ||
        this.#aliases.has(definition.id)
      ) {
        throw new Error(`Duplicate symbol or alias: ${definition.id}`);
      }
      this.#symbols.set(definition.id, definition);
      for (const alias of definition.aliases) {
        if (this.#symbols.has(alias) || this.#aliases.has(alias)) {
          throw new Error(`Duplicate symbol or alias: ${alias}`);
        }
        this.#aliases.set(alias, definition.id);
      }
    }
  }

  resolve(symbolId: string, variantId?: string): ResolvedSymbol | undefined {
    const canonicalId = this.#aliases.get(symbolId) ?? symbolId;
    const definition = this.#symbols.get(canonicalId);
    if (!definition) {
      return undefined;
    }
    if (variantId === undefined) {
      return { definition };
    }
    const variant = definition.variants.find(
      (candidate) => candidate.id === variantId,
    );
    return variant ? { definition, variant } : undefined;
  }
}
