# Formal Export

Status: `accepted`

Version: `1.0`

Owning phase: `Phase 7`

Related ADR: [`0014-resolved-route-geometry.md`](../adr/0014-resolved-route-geometry.md).
Formal export consumes the resolved route geometry (centerline + endpoint joins)
and, as today, excludes editor overlays, flightlines, selection, and
diagnostics.

## Contract

Every export starts from one validated `SchematicDocument`, one symbol
resolver, and the formal SVG scene. Editor overlays, hit targets, selections,
flightlines, and diagnostics are never part of a formal artifact.

| Format | v0.1 derivation                           | Media type        |
| ------ | ----------------------------------------- | ----------------- |
| SVG    | canonical formal scene                    | `image/svg+xml`   |
| PNG    | white-background raster of that SVG at 3x | `image/png`       |
| PDF    | same PNG fitted to the same viewBox page  | `application/pdf` |

The SVG viewBox is the authoritative page bound. Node raster export substitutes
the formal serif stack with a bundled DejaVu Serif family before rasterization,
so missing host fonts cannot remove labels. The original SVG is unchanged.
Export filenames are normalized and all three formats use the same base name.

## Known limit

PDF 0.1 is a high-resolution raster PDF. It preserves page bounds and visual
content but not selectable vector primitives. Vector PDF is a later compatible
enhancement, not a reason to introduce a second renderer.

## Validation

- parse the SVG viewBox and reject invalid bounds;
- check PNG signature and dimensions against viewBox times scale;
- reopen PDF, check one page and page bounds, render it with Poppler, and
  visually compare it with the SVG/PNG fixture;
- assert formal SVG has no editor-only layers.
