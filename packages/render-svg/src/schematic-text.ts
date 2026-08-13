import type { SchematicStyleProfile } from "@icm/derived";
import {
  parseSchematicMath,
  type SchematicMathRuns,
  type SchematicTextKind,
} from "@icm/model";

import {
  renderAttributedRichTextDocument,
  renderRichTextDocument,
  type AttributedRichTextDocument,
} from "./rich-text.js";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function legacySchematicMathDocument(
  runs: SchematicMathRuns,
): AttributedRichTextDocument {
  const document: AttributedRichTextDocument = { runs: [] };
  document.runs.push({
    kind: "text",
    value: runs.base,
    role: "legacy-base",
  });
  if (runs.subscript) {
    document.runs.push({
      kind: "span",
      style: "subscript",
      role: "legacy-subscript",
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

/** Render semantic identifiers through the shared RichText glyph pipeline. */
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
  return renderAttributedRichTextDocument(
    legacySchematicMathDocument(runs),
    profile,
    { defaultItalic: true, defaultBold: runs.style === "math" },
  );
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
