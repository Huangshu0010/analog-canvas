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
  const exhaustive: never = run;
  return exhaustive;
}

function appendInline(target: Line[], addition: Line[]): void {
  const current = target.at(-1)!;
  current.width += addition[0]?.width ?? 0;
  current.height = Math.max(current.height, addition[0]?.height ?? 0);
  for (const line of addition.slice(1)) target.push({ ...line });
}
