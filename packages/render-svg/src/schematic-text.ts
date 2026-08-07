import type { SchematicStyleProfile } from "./style-profile.js";

export type SchematicTextKind =
  | "default-instance"
  | "instance-label"
  | "net-label"
  | "power-label"
  | "plain-text"
  | "current"
  | "voltage"
  | "figure-caption"
  | "pin-name";

export interface SchematicMathRuns {
  base: string;
  subscript: string;
  suffix?: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function permitsImplicitMath(kind: SchematicTextKind): boolean {
  return kind !== "plain-text" && kind !== "figure-caption";
}

export function parseSchematicMath(
  text: string,
  kind: SchematicTextKind,
): SchematicMathRuns | null {
  if (!permitsImplicitMath(kind)) return null;

  const underscore = text.indexOf("_");
  if (underscore > 0 && underscore < text.length - 1) {
    return {
      base: text.slice(0, underscore),
      subscript: text.slice(underscore + 1),
    };
  }

  if (kind === "default-instance" || kind === "instance-label") {
    const match = /^([A-Za-z]+)(.+)$/u.exec(text);
    return match ? { base: match[1]!, subscript: match[2]! } : null;
  }

  if (
    kind === "net-label" ||
    kind === "power-label" ||
    kind === "current" ||
    kind === "voltage" ||
    kind === "pin-name"
  ) {
    const match = /^([VI])(.+?)([+-])?$/u.exec(text);
    return match
      ? {
          base: match[1]!,
          subscript: match[2]!,
          ...(match[3] ? { suffix: match[3] } : {}),
        }
      : null;
  }

  return null;
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
    case "figure-caption":
      return typography.captionFontSize;
    case "plain-text":
    case "current":
    case "voltage":
      return typography.annotationFontSize;
  }
}

export function renderSchematicTextContent(
  text: string,
  kind: SchematicTextKind,
  profile: SchematicStyleProfile,
): string {
  if (profile.id === "textbook-monochrome-v1") return escapeXml(text);

  const runs = parseSchematicMath(text, kind);
  if (!runs) return escapeXml(text);

  const typography = profile.typography;
  const runStyle = `font-style:${typography.mathStyle};font-weight:${typography.mathWeight}`;
  const subscriptPercent = typography.subscriptScale * 100;
  const suffix = runs.suffix
    ? `<tspan data-text-run="suffix" baseline-shift="baseline" dy="${typography.subscriptBaselineShiftEm}em" style="font-style:normal;font-weight:${typography.plainWeight}">${escapeXml(runs.suffix)}</tspan>`
    : "";
  return `<tspan data-text-run="base" style="${runStyle}">${escapeXml(runs.base)}</tspan><tspan data-text-run="subscript" font-size="${subscriptPercent}%" baseline-shift="-${typography.subscriptBaselineShiftEm}em" style="${runStyle}">${escapeXml(runs.subscript)}</tspan>${suffix}`;
}

export function schematicTextSizeAttribute(
  kind: SchematicTextKind,
  profile: SchematicStyleProfile,
  sizeScale?: number,
): string {
  // Keep legacy monochrome output byte-stable unless an author explicitly
  // changes the annotation scale.  In that case monochrome must honor the
  // persisted presentation setting just like the Razavi profile does.
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
