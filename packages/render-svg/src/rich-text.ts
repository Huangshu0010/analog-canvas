import type { SchematicStyleProfile } from "@icm/derived";
import type { RichTextDocument, RichTextRun } from "@icm/model";

type CompatibilityRole = "legacy-base" | "legacy-subscript" | "legacy-suffix";

type RenderTextRun = Extract<RichTextRun, { kind: "text" }> & {
  role?: CompatibilityRole;
};
type RenderSpanRun = Omit<
  Extract<RichTextRun, { kind: "span" }>,
  "children"
> & {
  role?: CompatibilityRole;
  children: RenderRichTextRun[];
};
type RenderRichTextRun =
  RenderTextRun | Extract<RichTextRun, { kind: "line-break" }> | RenderSpanRun;

export interface AttributedRichTextDocument {
  runs: RenderRichTextRun[];
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
  document: RichTextDocument,
  profile: SchematicStyleProfile,
  options: {
    lineOriginX?: number;
    defaultItalic?: boolean;
    defaultBold?: boolean;
  } = {},
): string {
  return renderAttributedRichTextDocument(document, profile, options);
}

/** @internal Compatibility metadata for standardized schematic identifiers. */
export function renderAttributedRichTextDocument(
  document: AttributedRichTextDocument,
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

function renderRuns(runs: RenderRichTextRun[], ctx: RenderContext): string {
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

function renderRun(node: RenderRichTextRun, ctx: RenderContext): string {
  switch (node.kind) {
    case "text":
      return renderText(node, ctx);
    case "line-break":
      return "";
    case "span":
      return renderSpan(node, ctx);
  }
}

function renderText(node: RenderTextRun, ctx: RenderContext): string {
  const value = escapeXml(node.value);
  if (node.role === "legacy-base") {
    return `<tspan data-text-run="base" style="${styleAttribute(ctx)}">${value}</tspan>`;
  }
  if (node.role === "legacy-suffix") {
    return `<tspan data-text-run="suffix" baseline-shift="baseline" dy="${ctx.profile.typography.subscriptBaselineShiftEm}em" style="font-style:normal;font-weight:${ctx.profile.typography.plainWeight}">${value}</tspan>`;
  }
  return value;
}

function renderSpan(node: RenderSpanRun, ctx: RenderContext): string {
  if (node.style === "italic" || node.style === "bold") {
    const childCtx: RenderContext = {
      ...ctx,
      italic: ctx.italic || node.style === "italic",
      bold: ctx.bold || node.style === "bold",
    };
    const children = renderRuns(node.children, childCtx);
    return `<tspan data-text-run="span" style="${styleAttribute(childCtx)}">${children}</tspan>`;
  }

  const typography = ctx.profile.typography;
  const percent = Math.round(typography.subscriptScale * 100);
  const shift =
    node.style === "subscript"
      ? -typography.subscriptBaselineShiftEm
      : typography.subscriptBaselineShiftEm;
  const children = renderRuns(node.children, ctx);
  const dx =
    node.style === "subscript" ? typography.subscriptHorizontalGapEm : 0;
  const style =
    node.role === "legacy-subscript"
      ? `font-style:normal;font-weight:${typography.mathWeight}`
      : styleAttribute(ctx);
  return `<tspan data-text-run="${node.style}" dx="${dx}em" font-size="${percent}%" baseline-shift="${shift}em" style="${style}">${children}</tspan>`;
}
