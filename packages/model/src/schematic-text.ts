import type { RichTextDocument, RichTextRun, RichTextStyle } from "./schema.js";

export type SchematicTextKind =
  | "default-instance"
  | "instance-label"
  | "net-label"
  | "power-label"
  | "pin-name"
  | "route-marker";

export interface SchematicMathRuns {
  base: string;
  subscript?: string;
  suffix?: string;
  style: "math" | "italic";
}

/** Derive standardized math typography from a schematic semantic identifier. */
export function parseSchematicMath(
  text: string,
  kind: SchematicTextKind,
): SchematicMathRuns | null {
  // This compatibility parser is used only when a persisted annotation has
  // no explicit RichText content. New formatting is authored by the toolbar.
  const explicit = /^(?:\\it\{([^{}]+)\}|([^{}_]+))_\{([^{}]+)\}([+-])?$/u.exec(
    text,
  );
  if (explicit) {
    return {
      base: explicit[1] ?? explicit[2]!,
      subscript: explicit[3]!,
      ...(explicit[4] ? { suffix: explicit[4] } : {}),
      style: explicit[1] ? "italic" : "math",
    };
  }
  const explicitItalic = /^\\it\{([^{}]+)\}$/u.exec(text);
  if (explicitItalic) {
    return { base: explicitItalic[1]!, style: "italic" };
  }
  if (/[\\{}^]/u.test(text)) return null;

  const underscore = text.indexOf("_");
  if (underscore > 0 && underscore < text.length - 1) {
    return {
      base: text.slice(0, underscore),
      subscript: text.slice(underscore + 1),
      style: "math",
    };
  }

  if (kind === "default-instance" || kind === "instance-label") {
    const match = /^([A-Za-z]+)(.+)$/u.exec(text);
    return match
      ? { base: match[1]!, subscript: match[2]!, style: "math" }
      : null;
  }

  const match = /^([VI])(.+?)([+-])?$/u.exec(text);
  return match
    ? {
        base: match[1]!,
        subscript: match[2]!,
        ...(match[3] ? { suffix: match[3] } : {}),
        style: "math",
      }
    : null;
}

function styled(children: RichTextRun[], style: RichTextStyle): RichTextRun {
  return { kind: "span", style, children };
}

/** Convert a schematic identifier into the canonical RichText document. */
export function schematicTextDocument(
  text: string,
  kind: SchematicTextKind,
): RichTextDocument {
  const runs = parseSchematicMath(text, kind);
  if (!runs) return { runs: [{ kind: "text", value: text }] };

  const subscript: RichTextRun[] = runs.subscript
    ? [
        styled(
          runs.style === "math"
            ? [styled([{ kind: "text", value: runs.subscript }], "bold")]
            : [{ kind: "text", value: runs.subscript }],
          "subscript",
        ),
      ]
    : [];
  const base =
    runs.style === "italic"
      ? styled([{ kind: "text", value: runs.base }], "italic")
      : styled(
          [styled([{ kind: "text", value: runs.base }], "bold")],
          "italic",
        );
  return {
    runs: [
      base,
      ...subscript,
      ...(runs.suffix ? [{ kind: "text" as const, value: runs.suffix }] : []),
    ],
  };
}
