import type { SchematicStyleProfile } from "./style-profile.js";

// Unified RichText AST -> SVG tspan renderer (ADR 0010 / WP-A2). The canvas,
// formal SVG, PNG, and PDF exports all use this single implementation. Input
// is the model's RichTextDocument AST (four node kinds; span has four styles).
// Output is a string of <tspan> elements safe to embed in a <text>.
//
// The renderer honors the style profile's typography tokens (math weight/style,
// subscript scale and baseline shift) and reuses the subscript scale with a
// positive baseline shift for superscript. A fraction stacks numerator over
// denominator with a horizontal rule approximated by a baseline shift; both
// parts are rendered at reduced size so the fraction reads at label height.

interface RichTextNode {
  kind: string;
  value?: string;
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
  inheritedStyle: string;
  dy: number;
  lineOriginX: number;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function runStyle(
  profile: SchematicStyleProfile,
  italic: boolean,
  bold: boolean,
): string {
  const fontStyle = italic ? "italic" : "normal";
  const weight = bold
    ? profile.typography.mathWeight
    : profile.typography.plainWeight;
  return `font-style:${fontStyle};font-weight:${weight}`;
}

export function renderRichTextDocument(
  document: RichTextDocumentInput,
  profile: SchematicStyleProfile,
  options: { lineOriginX?: number } = {},
): string {
  const ctx: RenderContext = {
    profile,
    inheritedStyle: runStyle(profile, false, false),
    dy: 0,
    lineOriginX: options.lineOriginX ?? 0,
  };
  return renderRuns(document.runs, ctx);
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
      return escapeXml(node.value ?? "");
    case "line-break":
      return "";
    case "span":
      return renderSpan(node, ctx);
    case "fraction":
      return renderFraction(node, ctx);
    default:
      return "";
  }
}

function renderSpan(node: RichTextNode, ctx: RenderContext): string {
  const style = node.style;
  const typography = ctx.profile.typography;
  if (style === "italic" || style === "bold") {
    const childCtx: RenderContext = {
      ...ctx,
      inheritedStyle: runStyle(
        ctx.profile,
        style === "italic",
        style === "bold",
      ),
    };
    const children = node.children ? renderRuns(node.children, childCtx) : "";
    return `<tspan data-text-run="span" style="${childCtx.inheritedStyle}">${children}</tspan>`;
  }
  if (style === "subscript" || style === "superscript") {
    const percent = Math.round(typography.subscriptScale * 100);
    const shift = typography.subscriptBaselineShiftEm;
    const dy = style === "subscript" ? shift : -shift;
    const childCtx: RenderContext = { ...ctx, dy: ctx.dy + dy };
    const children = node.children ? renderRuns(node.children, childCtx) : "";
    const restoreDy = style === "subscript" ? -shift : shift;
    return `<tspan data-text-run="${style}" font-size="${percent}%" baseline-shift="${dy < 0 ? "super" : "sub"}" style="${ctx.inheritedStyle}">${children}</tspan><tspan dy="${restoreDy / 2}em" style="${ctx.inheritedStyle}"></tspan>`;
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
  // Numerator shifted up, denominator shifted down past the rule line.
  return `<tspan data-text-run="fraction" style="${ctx.inheritedStyle}"><tspan data-text-run="numerator" font-size="${percent}%" dy="${-halfLine}em">${numerator}</tspan><tspan data-text-run="denominator" font-size="${percent}%" dy="${typography.lineHeight}em">${denominator}</tspan><tspan dy="${-halfLine}em" style="${ctx.inheritedStyle}"></tspan></tspan>`;
}
