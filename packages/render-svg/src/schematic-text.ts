import type { RichTextDocument } from "@icm/model";

import { renderRichTextDocument } from "./rich-text.js";
import type { RichTextDocumentInput } from "./rich-text.js";
import type { SchematicStyleProfile } from "./style-profile.js";

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
  style?: "math" | "italic";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function permitsImplicitMath(_kind: SchematicTextKind): boolean {
  return true;
}

export function parseSchematicMath(
  text: string,
  kind: SchematicTextKind,
): SchematicMathRuns | null {
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
  if (explicitItalic) return { base: explicitItalic[1]!, style: "italic" };
  if (!permitsImplicitMath(kind)) return null;

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

  if (
    kind === "net-label" ||
    kind === "power-label" ||
    kind === "route-marker" ||
    kind === "pin-name"
  ) {
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

  return null;
}

function styled(
  children: RichTextDocument["runs"],
  style: "italic" | "bold",
): RichTextDocument["runs"][number] {
  return { kind: "span", style, children } as RichTextDocument["runs"][number];
}

function legacySchematicMathDocument(
  runs: SchematicMathRuns,
): RichTextDocumentInput {
  const document: RichTextDocumentInput = { runs: [] };
  document.runs.push({
    kind: "text",
    value: runs.base,
    role: "legacy-base",
  });
  if (runs.subscript) {
    document.runs.push({
      kind: "span",
      style: "subscript",
      children: [{ kind: "text", value: runs.subscript }],
    });
  }
  if (runs.suffix) {
    document.runs.push({
      kind: "text",
      value: runs.suffix,
      role: "legacy-suffix",
    });
  }
  return document;
}

/** Convert legacy schematic-math strings into canonical RichText content. */
export function schematicTextDocument(
  text: string,
  kind: SchematicTextKind,
): RichTextDocument {
  const runs = parseSchematicMath(text, kind);
  if (!runs)
    return { runs: [{ kind: "text", value: text }] } as RichTextDocument;

  const math = (
    children: RichTextDocument["runs"],
  ): RichTextDocument["runs"][number] =>
    runs.style === "italic"
      ? styled(children, "italic")
      : styled([styled(children, "bold")], "italic");
  const baseAndSubscript: RichTextDocument["runs"] = [
    { kind: "text", value: runs.base },
    ...(runs.subscript
      ? [
          {
            kind: "span" as const,
            style: "subscript" as const,
            children: [{ kind: "text" as const, value: runs.subscript }],
          },
        ]
      : []),
  ];
  return {
    runs: [
      math(baseAndSubscript),
      ...(runs.suffix ? [{ kind: "text" as const, value: runs.suffix }] : []),
    ],
  } as RichTextDocument;
}

export function schematicTextFontSize(
  kind: SchematicTextKind,
  profile: SchematicStyleProfile,
): number {
  const typography = profile.typography;
  switch (kind) {
    case "default-instance":
    case "instance-label":
      return typography.instanceFontSize;
    case "net-label":
    case "pin-name":
      return typography.netFontSize;
    case "power-label":
      return typography.powerFontSize;
    case "route-marker":
      return typography.annotationFontSize;
  }
}

/**
 * Compatibility wrapper for legacy callers. Both semantic labels and drafting
 * rich text now use the same AST-to-SVG renderer.
 */
export function renderSchematicTextContent(
  text: string,
  kind: SchematicTextKind,
  profile: SchematicStyleProfile,
): string {
  if (profile.id === "textbook-monochrome-v1") return escapeXml(text);
  const runs = parseSchematicMath(text, kind);
  if (!runs) {
    return renderRichTextDocument(
      { runs: [{ kind: "text", value: text }] },
      profile,
    );
  }
  return renderRichTextDocument(legacySchematicMathDocument(runs), profile, {
    defaultItalic: true,
    defaultBold: runs.style === "math",
  });
}

export function schematicTextSizeAttribute(
  kind: SchematicTextKind,
  profile: SchematicStyleProfile,
  sizeScale?: number,
): string {
  if (profile.id === "textbook-monochrome-v1" && sizeScale === undefined) {
    return "";
  }
  const base = schematicTextFontSize(kind, profile);
  const size =
    sizeScale !== undefined && Number.isFinite(sizeScale) && sizeScale > 0
      ? Math.round(base * sizeScale * 100) / 100
      : base;
  return ` font-size="${size}"`;
}
