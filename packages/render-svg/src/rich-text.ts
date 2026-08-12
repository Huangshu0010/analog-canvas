import type { SchematicStyleProfile } from "@icm/derived";

// Canonical RichText AST -> SVG tspan renderer. Schematic annotations and
// drafting text both terminate here; callers may choose different default
// content, but not a different glyph/style implementation.

interface RichTextNode {
  kind: string;
  value?: string;
  // Compatibility roles are adapter-only metadata for legacy schematic labels.
  // They never enter the RichText Project schema.
  role?: "legacy-base" | "legacy-subscript" | "legacy-suffix";
  style?: string;
  children?: RichTextNode[];
  numerator?: { runs: RichTextNode[] };
  denominator?: { runs: RichTextNode[] };
}

export interface RichTextDocumentInput {
  runs: RichTextNode[];
}

interface RenderContext {
  profile: SchematicStyleProfile;
  italic: boolean;
  bold: boolean;
  lineOriginX: number;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function styleAttribute(ctx: RenderContext): string {
  return `font-style:${ctx.italic ? "italic" : "normal"};font-weight:${ctx.bold ? ctx.profile.typography.mathWeight : ctx.profile.typography.plainWeight}`;
}

export function renderRichTextDocument(
  document: RichTextDocumentInput,
  profile: SchematicStyleProfile,
  options: {
    lineOriginX?: number;
    defaultItalic?: boolean;
    defaultBold?: boolean;
  } = {},
): string {
  return renderRuns(document.runs, {
    profile,
    italic: options.defaultItalic ?? false,
    bold: options.defaultBold ?? false,
    lineOriginX: options.lineOriginX ?? 0,
  });
}

function renderRuns(runs: RichTextNode[], ctx: RenderContext): string {
  let output = "";
  let lineOpen = false;
  for (const run of runs) {
    if (run.kind === "line-break") {
      if (lineOpen) output += "</tspan>";
      output += `<tspan data-text-run="line-break" x="${ctx.lineOriginX}" dy="${ctx.profile.typography.lineHeight}em">`;
      lineOpen = true;
      continue;
    }
    output += renderRun(run, ctx);
  }
  if (lineOpen) output += "</tspan>";
  return output;
}

function renderRun(node: RichTextNode, ctx: RenderContext): string {
  switch (node.kind) {
    case "text":
      return renderText(node, ctx);
    case "span":
      return renderSpan(node, ctx);
    case "fraction":
      return renderFraction(node, ctx);
    default:
      return "";
  }
}

function renderText(node: RichTextNode, ctx: RenderContext): string {
  const value = escapeXml(node.value ?? "");
  if (node.role === "legacy-base") {
    return `<tspan data-text-run="base" style="${styleAttribute(ctx)}">${value}</tspan>`;
  }
  if (node.role === "legacy-suffix") {
    return `<tspan data-text-run="suffix" baseline-shift="baseline" dy="${ctx.profile.typography.subscriptBaselineShiftEm}em" style="font-style:normal;font-weight:${ctx.profile.typography.plainWeight}">${value}</tspan>`;
  }
  return value;
}

function renderSpan(node: RichTextNode, ctx: RenderContext): string {
  if (node.style === "italic" || node.style === "bold") {
    const childCtx: RenderContext = {
      ...ctx,
      italic: ctx.italic || node.style === "italic",
      bold: ctx.bold || node.style === "bold",
    };
    const children = node.children ? renderRuns(node.children, childCtx) : "";
    return `<tspan data-text-run="span" style="${styleAttribute(childCtx)}">${children}</tspan>`;
  }
  if (node.style === "subscript" || node.style === "superscript") {
    const typography = ctx.profile.typography;
    const percent = Math.round(typography.subscriptScale * 100);
    const shift =
      node.style === "subscript"
        ? -typography.subscriptBaselineShiftEm
        : typography.subscriptBaselineShiftEm;
    const children = node.children ? renderRuns(node.children, ctx) : "";
    const dx =
      node.style === "subscript" ? typography.subscriptHorizontalGapEm : 0;
    const style =
      node.role === "legacy-subscript"
        ? `font-style:normal;font-weight:${typography.mathWeight}`
        : styleAttribute(ctx);
    return `<tspan data-text-run="${node.style}" dx="${dx}em" font-size="${percent}%" baseline-shift="${shift}em" style="${style}">${children}</tspan>`;
  }
  return node.children ? renderRuns(node.children, ctx) : "";
}

function renderFraction(node: RichTextNode, ctx: RenderContext): string {
  const typography = ctx.profile.typography;
  const percent = Math.round(typography.subscriptScale * 100);
  const halfLine = typography.lineHeight / 2;
  const numerator = node.numerator ? renderRuns(node.numerator.runs, ctx) : "";
  const denominator = node.denominator
    ? renderRuns(node.denominator.runs, ctx)
    : "";
  return `<tspan data-text-run="fraction" style="${styleAttribute(ctx)}"><tspan data-text-run="numerator" font-size="${percent}%" dy="${-halfLine}em">${numerator}</tspan><tspan data-text-run="denominator" font-size="${percent}%" dy="${typography.lineHeight}em">${denominator}</tspan><tspan dy="${-halfLine}em" style="${styleAttribute(ctx)}"></tspan></tspan>`;
}
