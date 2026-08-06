import { SymbolDefinitionSchema } from "./schema.js";
import type { SymbolDefinition, SymbolVariant } from "./schema.js";
import {
  createGenericBlockSymbol,
  genericBlockPinCount,
} from "./generic-block.js";

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
  readonly #generated = new Map<string, SymbolDefinition>();

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
    let definition =
      this.#symbols.get(canonicalId) ?? this.#generated.get(canonicalId);
    if (!definition) {
      const pinCount = genericBlockPinCount(canonicalId);
      if (pinCount !== null) {
        definition = createGenericBlockSymbol(pinCount);
        this.#generated.set(canonicalId, definition);
      }
    }
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
