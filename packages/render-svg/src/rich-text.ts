import type { SchematicStyleProfile } from "@icm/derived";
import { fractionGeometry, fractionPartScale } from "@icm/derived";
import { flattenRichText } from "@icm/model";
import type { RichTextDocument, RichTextRun } from "@icm/model";

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

/** Render only canonical RichText AST runs. */
export function renderRichTextDocument(
  document: RichTextDocument,
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

function renderRuns(runs: RichTextRun[], ctx: RenderContext): string {
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

function renderRun(node: RichTextRun, ctx: RenderContext): string {
  switch (node.kind) {
    case "text":
      return escapeXml(node.value);
    case "line-break":
      return "";
    case "span":
      return renderSpan(node, ctx);
    case "fraction":
      return renderInlineFraction(node, ctx);
  }
}

/**
 * Inline stacked fraction for mixed rich text. The parts are centered on the
 * block through deterministic dx compensation (0.6 em per code point, the
 * same model as the shared layout). The fraction bar itself needs a line
 * element, which a <text> cannot host; annotation-level fractions render
 * through the structured bar path in render.ts instead.
 */
function renderInlineFraction(
  node: Extract<RichTextRun, { kind: "fraction" }>,
  ctx: RenderContext,
): string {
  const typography = ctx.profile.typography;
  const scale = fractionPartScale(typography.subscriptScale);
  const percent = Math.round(scale * 100);
  const numerator = renderRuns(node.numerator.runs, ctx);
  const denominator = renderRuns(node.denominator.runs, ctx);
  // Part widths are measured in base em (char count × 0.6 × part scale); the
  // overhang is in em of the part font, so scale it back to base em too. The
  // dx compensation then converts base-em offsets to the part tspans' own em.
  const numeratorWidthEm =
    [...flattenRichText(node.numerator)].length * 0.6 * scale;
  const denominatorWidthEm =
    [...flattenRichText(node.denominator)].length * 0.6 * scale;
  const blockWidthEm =
    Math.max(numeratorWidthEm, denominatorWidthEm) +
    fractionGeometry.barOverhangEm * scale * 2;
  const numeratorDx = (blockWidthEm - numeratorWidthEm) / 2 / scale;
  const denominatorDx =
    ((blockWidthEm - denominatorWidthEm) / 2 - numeratorWidthEm) / scale;
  const resetDx = (blockWidthEm - denominatorWidthEm) / 2;
  // Vertical offsets are in em of the part font, so they need no /scale in
  // the part tspans' own units; the base-font reset tspan scales its drop.
  return `<tspan data-text-run="fraction"><tspan data-text-run="numerator" font-size="${percent}%" dx="${numeratorDx}" dy="${-fractionGeometry.numeratorBaselineRiseEm}em">${numerator}</tspan><tspan data-text-run="denominator" font-size="${percent}%" dx="${denominatorDx}" dy="${fractionGeometry.numeratorBaselineRiseEm + fractionGeometry.denominatorBaselineDropEm}em">${denominator}</tspan><tspan dx="${resetDx}" dy="${-fractionGeometry.denominatorBaselineDropEm * scale}em"></tspan></tspan>`;
}

function renderSpan(
  node: Extract<RichTextRun, { kind: "span" }>,
  ctx: RenderContext,
): string {
  if (node.style === "italic" || node.style === "bold") {
    const childCtx: RenderContext = {
      ...ctx,
      italic: ctx.italic || node.style === "italic",
      bold: ctx.bold || node.style === "bold",
    };
    return `<tspan data-text-run="span" style="${styleAttribute(childCtx)}">${renderRuns(node.children, childCtx)}</tspan>`;
  }

  const typography = ctx.profile.typography;
  const percent = Math.round(typography.subscriptScale * 100);
  const shift =
    node.style === "subscript"
      ? -typography.subscriptBaselineShiftEm
      : typography.subscriptBaselineShiftEm;
  const dx =
    node.style === "subscript" ? typography.subscriptHorizontalGapEm : 0;
  // Scripts in the Razavi profile are upright by default. They retain the
  // surrounding weight so a bold math base has a bold upright subscript; an
  // explicit nested italic span remains an intentional user override.
  const scriptCtx: RenderContext = { ...ctx, italic: false };
  return `<tspan data-text-run="${node.style}" dx="${dx}em" font-size="${percent}%" baseline-shift="${shift}em" style="${styleAttribute(scriptCtx)}">${renderRuns(node.children, scriptCtx)}</tspan>`;
}
