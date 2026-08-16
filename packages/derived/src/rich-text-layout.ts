import type { RichTextDocument, RichTextRun } from "@icm/model";

import type { SchematicStyleProfile } from "./style-profile.js";

export interface RichTextMetrics {
  fontSize: number;
  lineHeight: number;
  subscriptScale: number;
  subscriptBaselineShiftEm: number;
}

export interface RichTextLayout {
  width: number;
  height: number;
  lineWidths: number[];
  lineHeights: number[];
}

/**
 * Shared geometry of an inline stacked fraction. All offsets are in em of
 * the PART font (the fraction parts render at `fractionPartScale`), so the
 * block grows with the parts and the bar always lands where the metrics say.
 * At the reference subscript scale (0.76) these reproduce the original
 * base-font offsets (bar 0.3, numerator rise 0.6, denominator drop 0.42,
 * overhang 0.08, gap 0.26, ascent 0.12).
 */
export const fractionGeometry = {
  /** Fraction parts render three A+ levels (30%) above the profile subscript scale. */
  partScaleMultiplier: 1.3,
  /** Fraction bar height above the anchor baseline, em of the part font. */
  barRiseEm: 0.395,
  /** Numerator baseline above the anchor baseline, em of the part font. */
  numeratorBaselineRiseEm: 0.789,
  /** Denominator baseline below the anchor baseline, em of the part font. */
  denominatorBaselineDropEm: 0.553,
  /** Fraction bar overhang beyond the widest part, per side, em of the part font. */
  barOverhangEm: 0.105,
  /** Vertical allowance between the two part lines, em of the part font. */
  barGapEm: 0.342,
  /** Ascent a fraction adds beyond the plain first-line ascent heuristic, em of the part font. */
  extraAscentEm: 0.52,
} as const;

/**
 * Fraction part font scale relative to the base font: three A+ levels above
 * the profile subscript scale. The single knob behind every fraction render
 * and measure so the parts stay proportionally large.
 */
export function fractionPartScale(subscriptScale: number): number {
  return subscriptScale * fractionGeometry.partScaleMultiplier;
}

export function containsFractionRun(document: RichTextDocument): boolean {
  const visit = (runs: readonly RichTextRun[]): boolean =>
    runs.some(
      (run) =>
        run.kind === "fraction" || (run.kind === "span" && visit(run.children)),
    );
  return visit(document.runs);
}

type Line = { width: number; height: number };
export function typographyFontSize(
  token: "caption" | "body" | "label",
  profile: SchematicStyleProfile,
): number {
  return token === "caption"
    ? profile.typography.captionFontSize
    : profile.typography.annotationFontSize;
}

export function richTextMetrics(
  profile: SchematicStyleProfile,
  token: "caption" | "body" | "label" = "body",
  sizeScale = 1,
): RichTextMetrics {
  return {
    fontSize: typographyFontSize(token, profile) * sizeScale,
    lineHeight: profile.typography.lineHeight,
    subscriptScale: profile.typography.subscriptScale,
    subscriptBaselineShiftEm: profile.typography.subscriptBaselineShiftEm,
  };
}

/** Deterministic layout shared by editor hits, export bounds, and snapshots. */
export function measureRichTextDocument(
  document: RichTextDocument,
  metrics: RichTextMetrics,
): RichTextLayout {
  const lines = measureRuns(document.runs, metrics);
  return {
    width: Math.max(0, ...lines.map((line) => line.width)),
    height: lines.reduce((sum, line) => sum + line.height, 0),
    lineWidths: lines.map((line) => line.width),
    lineHeights: lines.map((line) => line.height),
  };
}

function measureRuns(runs: RichTextRun[], metrics: RichTextMetrics): Line[] {
  const baseHeight = metrics.fontSize * metrics.lineHeight;
  const lines: Line[] = [{ width: 0, height: baseHeight }];
  for (const run of runs) {
    if (run.kind === "line-break") {
      lines.push({ width: 0, height: baseHeight });
      continue;
    }
    appendInline(lines, measureRun(run, metrics));
  }
  return lines;
}

function measureRun(run: RichTextRun, metrics: RichTextMetrics): Line[] {
  if (run.kind === "text") {
    return [
      {
        width: [...run.value].length * metrics.fontSize * 0.6,
        height: metrics.fontSize * metrics.lineHeight,
      },
    ];
  }
  if (run.kind === "line-break") {
    return [
      { width: 0, height: metrics.fontSize * metrics.lineHeight },
      { width: 0, height: metrics.fontSize * metrics.lineHeight },
    ];
  }
  if (run.kind === "span") {
    const scale =
      run.style === "subscript" || run.style === "superscript"
        ? metrics.subscriptScale
        : 1;
    const child = measureRuns(run.children, {
      ...metrics,
      fontSize: metrics.fontSize * scale,
    });
    if (scale < 1) {
      const shift = metrics.fontSize * metrics.subscriptBaselineShiftEm;
      child.forEach((line) => {
        line.height += shift;
      });
    }
    return child;
  }
  if (run.kind === "fraction") {
    // The parts straddle the anchor baseline, so the whole block is one
    // taller inline line: both part stacks plus the bar allowance. Geometry
    // offsets are in em of the part font, so the spacing scales with them.
    const partScale = fractionPartScale(metrics.subscriptScale);
    const partMetrics = {
      ...metrics,
      fontSize: metrics.fontSize * partScale,
    };
    const numerator = measureRuns(run.numerator.runs, partMetrics);
    const denominator = measureRuns(run.denominator.runs, partMetrics);
    const numeratorHeight = numerator.reduce(
      (sum, line) => sum + line.height,
      0,
    );
    const denominatorHeight = denominator.reduce(
      (sum, line) => sum + line.height,
      0,
    );
    return [
      {
        width:
          Math.max(
            ...numerator.map((line) => line.width),
            ...denominator.map((line) => line.width),
          ) +
          metrics.fontSize * partScale * fractionGeometry.barOverhangEm * 2,
        height:
          numeratorHeight +
          denominatorHeight +
          metrics.fontSize * partScale * fractionGeometry.barGapEm,
      },
    ];
  }
  const exhaustive: never = run;
  return exhaustive;
}

function appendInline(target: Line[], addition: Line[]): void {
  const current = target.at(-1)!;
  current.width += addition[0]?.width ?? 0;
  current.height = Math.max(current.height, addition[0]?.height ?? 0);
  for (const line of addition.slice(1)) target.push({ ...line });
}
