import type { SymbolStrokeRole } from "@icm/symbols";

import { razaviPeripheralGeometry } from "./razavi-peripheral-geometry.generated.js";

export interface SchematicStyleProfile {
  readonly id: "textbook-monochrome-v1" | "razavi-textbook-v1";
  readonly foreground: string;
  readonly background: string;
  readonly strokes: {
    readonly wire: number;
    readonly symbol: number;
    readonly normal: number;
    readonly emphasis: number;
    readonly ground: number;
    readonly supply: number;
    readonly annotation: number;
  };
  readonly nodes: {
    readonly junctionRadius: number;
    readonly portOriginRadius: number;
  };
  readonly annotations: {
    readonly supplyBarWidth: number;
    readonly currentArrowLength: number;
    readonly arrowHeadLength: number;
    readonly arrowHeadWidth: number;
    readonly currentLabelGap: number;
    readonly polarityOffsetX: number;
    readonly polarityHalfGap: number;
  };
  readonly lineCap: "butt" | "round" | "square";
  readonly lineJoin: "miter" | "round" | "bevel";
  readonly miterLimit: number;
  readonly scaleFormalStrokes: boolean;
  readonly typography: SchematicTypography;
}

export interface SchematicTypography {
  readonly fontFamily: string;
  readonly mathWeight: number;
  readonly mathStyle: "italic";
  readonly plainWeight: number;
  readonly instanceFontSize: number;
  readonly netFontSize: number;
  readonly powerFontSize: number;
  readonly annotationFontSize: number;
  readonly polarityFontSize: number;
  readonly captionFontSize: number;
  readonly subscriptScale: number;
  readonly subscriptBaselineShiftEm: number;
  readonly subscriptHorizontalGapEm: number;
  readonly labelGap: number;
  readonly lineHeight: number;
}

/** The one typography system shared by all presentation profiles. */
export const globalSchematicTypography: SchematicTypography = {
  fontFamily: "'DejaVu Sans',Arial,'Helvetica Neue',Helvetica,sans-serif",
  mathWeight: 700,
  mathStyle: "italic",
  plainWeight: 400,
  instanceFontSize: 15.116,
  netFontSize: 15.116,
  powerFontSize: 15.116,
  annotationFontSize: 15.116,
  polarityFontSize: 14,
  captionFontSize: 14,
  subscriptScale: 0.76,
  subscriptBaselineShiftEm: 0.28,
  subscriptHorizontalGapEm: 0.046,
  labelGap: 6,
  lineHeight: 1,
};

export const textbookMonochromeProfile: SchematicStyleProfile = {
  id: "textbook-monochrome-v1",
  foreground: "#000",
  background: "#fff",
  strokes: {
    wire: 1,
    symbol: 1,
    normal: 1.2,
    emphasis: 2.16,
    ground: 2.16,
    supply: 2.16,
    annotation: 0.8,
  },
  nodes: { junctionRadius: 1.75, portOriginRadius: 0 },
  annotations: {
    supplyBarWidth: 0,
    currentArrowLength: 24,
    arrowHeadLength: 7,
    arrowHeadWidth: 8,
    currentLabelGap: 7,
    polarityOffsetX: 0,
    polarityHalfGap: 0,
  },
  lineCap: "square",
  lineJoin: "miter",
  miterLimit: 4,
  scaleFormalStrokes: false,
  typography: globalSchematicTypography,
};

export const razaviTextbookProfile: SchematicStyleProfile = {
  id: "razavi-textbook-v1",
  foreground: "#000",
  background: "#fff",
  strokes: {
    wire: 1.6,
    symbol: 1.6,
    normal: 1.6,
    emphasis: 2.16,
    ground: razaviPeripheralGeometry.groundBarStroke,
    supply: 1.8,
    annotation: 1.6,
  },
  nodes: {
    junctionRadius: razaviPeripheralGeometry.solidNodeRadius,
    // A hollow Port uses the same *outside* radius as a solid junction.  Its
    // geometric radius therefore excludes half of the normal outline stroke.
    portOriginRadius: razaviPeripheralGeometry.solidNodeRadius - 1.3,
  },
  annotations: {
    supplyBarWidth: 20,
    currentArrowLength: razaviPeripheralGeometry.currentArrowLength,
    arrowHeadLength: razaviPeripheralGeometry.arrowHeadLength,
    arrowHeadWidth: razaviPeripheralGeometry.arrowHeadWidth,
    currentLabelGap: razaviPeripheralGeometry.currentLabelGap,
    polarityOffsetX: 12,
    polarityHalfGap: 8,
  },
  lineCap: "butt",
  lineJoin: "miter",
  miterLimit: 4,
  scaleFormalStrokes: true,
  typography: globalSchematicTypography,
};

const profiles = new Map<string, SchematicStyleProfile>([
  [textbookMonochromeProfile.id, textbookMonochromeProfile],
  [razaviTextbookProfile.id, razaviTextbookProfile],
]);

export function resolveSchematicStyleProfile(
  profileId: string,
): SchematicStyleProfile {
  const profile = profiles.get(profileId);
  if (!profile)
    throw new Error(`Unknown schematic style profile: ${profileId}`);
  return profile;
}

export function strokeWidthForRole(
  profile: SchematicStyleProfile,
  role: SymbolStrokeRole,
): number {
  return profile.strokes[role];
}

export function resolvePrimitiveStrokeWidth(
  profile: SchematicStyleProfile,
  role: SymbolStrokeRole | undefined,
  legacyWidth: number | undefined,
): number | undefined {
  if (role !== undefined) return strokeWidthForRole(profile, role);
  if (legacyWidth === undefined) return undefined;
  if (profile.id === "textbook-monochrome-v1") return legacyWidth;
  return legacyWidth >= 1.8 ? profile.strokes.emphasis : profile.strokes.normal;
}
