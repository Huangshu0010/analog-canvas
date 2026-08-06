import type { SourceBundle } from "./source-types.js";

export const SPICE_DIALECT_IDS = ["ngspice-46-core", "spice3f5-core"] as const;

export type SupportedSpiceDialectId = (typeof SPICE_DIALECT_IDS)[number];

export interface SpiceDialectEvidence {
  dialect: SupportedSpiceDialectId;
  confidence: "explicit" | "high" | "compatible";
  evidence: string[];
}

export interface SpiceCompileOptions {
  dialect?: SupportedSpiceDialectId | "auto";
}

export function detectSpiceDialect(
  bundle: SourceBundle,
  override: SpiceCompileOptions["dialect"] = "auto",
): SpiceDialectEvidence {
  if (override && override !== "auto") {
    return {
      dialect: override,
      confidence: "explicit",
      evidence: [`caller override: ${override}`],
    };
  }
  const evidence = new Set<string>();
  for (const syntaxFile of bundle.syntaxFiles) {
    for (const statement of syntaxFile.statements) {
      if (statement.kind === "control_boundary") evidence.add(".control");
      if (statement.kind === "conditional") evidence.add(`.${statement.form}`);
      if (statement.kind === "function") evidence.add(".func");
      if (
        statement.kind === "directive" &&
        ["csparam", "incpslt", "pss", "sp"].includes(statement.name)
      ) {
        evidence.add(`.${statement.name}`);
      }
    }
  }
  return evidence.size > 0
    ? {
        dialect: "ngspice-46-core",
        confidence: "high",
        evidence: [...evidence].sort((left, right) =>
          left.localeCompare(right, "en"),
        ),
      }
    : {
        dialect: "spice3f5-core",
        confidence: "compatible",
        evidence: ["no ngspice-specific structural syntax detected"],
      };
}
