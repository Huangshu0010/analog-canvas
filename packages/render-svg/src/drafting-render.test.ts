import { createEmptyDocument } from "@icm/model";
import { resolveSchematicStyleProfile } from "@icm/derived";
import { describe, expect, it } from "vitest";

import { renderDocumentSvg } from "./render.js";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("drafting layer rendering", () => {
  it("renders a DraftText object in a data-layer=drafting group", () => {
    const document = createEmptyDocument("doc", "Drafting");
    document.drafting = {
      objects: [
        {
          id: "note-1",
          kind: "text",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 100, y: 100 } },
          content: { runs: [{ kind: "text", value: "V_{in}" }] },
          alignment: "start",
          rotation: 0,
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('data-layer="drafting"');
    expect(svg).toContain('data-object-id="note-1"');
    expect(svg).toContain('data-kind="draft-text"');
    // The flat text projection preserves the literal value; full tspan
    // rendering is covered by the rich-text rendering contract.
    expect(svg).toContain("V_{in}");
  });

  it("escapes XML-significant characters in draft text", () => {
    const document = createEmptyDocument("doc", "Drafting");
    document.drafting = {
      objects: [
        {
          id: "note-2",
          kind: "text",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          content: { runs: [{ kind: "text", value: "a<b>&c" }] },
          alignment: "start",
          rotation: 0,
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain("a&lt;b&gt;&amp;c");
    expect(svg).not.toContain("a<b>&c");
  });

  it("omits the drafting group when there are no drafting objects", () => {
    const document = createEmptyDocument("doc", "Empty");
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).not.toContain('data-layer="drafting"');
  });

  it("never renders guides in formal output", () => {
    const document = createEmptyDocument("doc", "Guides");
    document.drafting = {
      objects: [],
      guides: [
        {
          id: "g1",
          axis: "vertical",
          coordinate: 100,
          locked: false,
          visible: true,
        },
      ],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).not.toContain('data-object-id="g1"');
    expect(svg).not.toContain('data-kind="guide"');
  });

  it("renders a construction-line with dashed style", () => {
    const document = createEmptyDocument("doc", "Drafting");
    document.drafting = {
      objects: [
        {
          id: "cl-1",
          kind: "construction-line",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          lineStyle: "dashed",
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('data-kind="construction-line"');
    expect(svg).toContain("stroke-dasharray");
  });

  it("renders a rotated outline rectangle with drafting stroke style", () => {
    const document = createEmptyDocument("doc", "Rectangle");
    document.drafting = {
      objects: [
        {
          id: "rect-1",
          kind: "rectangle",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 50, y: 50 } },
          center: { x: 50, y: 50 },
          width: 80,
          height: 40,
          rotation: 0,
          lineStyle: "dotted",
          styleOverride: { strokeScale: 1.5 },
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('data-kind="draft-rectangle"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke-dasharray="2 3"');
    expect(svg).toContain('points="10,30 90,30 90,70 10,70"');
  });

  it("renders a draft arrow with a head", () => {
    const document = createEmptyDocument("doc", "Drafting");
    document.drafting = {
      objects: [
        {
          id: "ar-1",
          kind: "arrow",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          from: { kind: "free", position: { x: 0, y: 0 } },
          to: { kind: "free", position: { x: 100, y: 0 } },
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('data-kind="draft-arrow"');
    expect(svg).toContain("<polygon");
    const profile = resolveSchematicStyleProfile(
      document.presentation.styleProfileId,
    );
    expect(svg).toContain(
      `${100 - profile.annotations.arrowHeadLength},${
        -profile.annotations.arrowHeadWidth / 2
      }`,
    );
    expect(svg).toContain(
      `points="0,0 ${100 - profile.annotations.arrowHeadLength},0"`,
    );
  });

  it("honors the constrained arrow-head override", () => {
    const document = createEmptyDocument("doc", "Drafting");
    document.drafting = {
      objects: [
        {
          id: "shaft-only",
          kind: "arrow",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          from: { kind: "free", position: { x: 0, y: 0 } },
          to: { kind: "free", position: { x: 100, y: 0 } },
          styleOverride: { arrowHead: "none" },
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('data-kind="draft-arrow"');
    expect(svg).not.toContain("<polygon");
  });

  it("renders a curved arrow as a path and aims its head along the final tangent", () => {
    const document = createEmptyDocument("doc", "Bent arrow");
    document.drafting = {
      objects: [
        {
          id: "bent-arrow",
          kind: "arrow",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          from: { kind: "free", position: { x: 0, y: 0 } },
          to: { kind: "free", position: { x: 100, y: 0 } },
          curveControls: [{ x: 50, y: 50 }],
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('<path d="M 0 0 Q 50 50');
    // The curve's endpoint tangent is (100,0) - (50,50), not the overall
    // straight chord. The polygon base must therefore leave both x and y;
    // a horizontal head would have both base vertices symmetric about y = 0.
    const polygon = svg.match(/<polygon points="([^"]+)"/)?.[1];
    expect(polygon).toBeDefined();
    const vertices = polygon!
      .split(" ")
      .map((vertex) => vertex.split(",").map(Number));
    expect(vertices[0]).toEqual([100, 0]);
    const baseCenter = {
      x: (vertices[1]![0]! + vertices[2]![0]!) / 2,
      y: (vertices[1]![1]! + vertices[2]![1]!) / 2,
    };
    // Tip − base centre is parallel to the final quadratic tangent (50,-50).
    const headDirection = { x: 100 - baseCenter.x, y: -baseCenter.y };
    expect(headDirection.x).toBeGreaterThan(0);
    expect(headDirection.y).toBeLessThan(0);
    expect(Math.abs(headDirection.x)).toBeCloseTo(Math.abs(headDirection.y), 6);
  });

  it("renders a floating symbol with its primitives", () => {
    const document = createEmptyDocument("doc", "Drafting");
    document.drafting = {
      objects: [
        {
          id: "fs-1",
          kind: "floating-symbol",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 50, y: 50 } },
          symbolId: "resistor",
          transform: { rotation: 0, mirror: "none" },
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('data-kind="draft-floating-symbol"');
    expect(svg).toContain('data-symbol-id="resistor"');
  });

  it("includes drafting bounds in the export viewBox", () => {
    const document = createEmptyDocument("doc", "Bounds");
    document.drafting = {
      objects: [
        {
          id: "cl-1",
          kind: "construction-line",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          points: [
            { x: 50, y: 50 },
            { x: 500, y: 300 },
          ],
          lineStyle: "dashed",
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    // viewBox must cover the line's padded bounds.
    const viewBox = svg.match(
      /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/,
    );
    expect(viewBox).toBeTruthy();
    const numbers = viewBox!.slice(1).map(Number);
    const [x, y, width, height] = numbers as [number, number, number, number];
    expect(x).toBeLessThanOrEqual(44);
    expect(y).toBeLessThanOrEqual(44);
    expect(x + width).toBeGreaterThanOrEqual(512);
    expect(y + height).toBeGreaterThanOrEqual(312);
  });

  it("exports a fallback-anchored object with data-anchor-resolved=false", () => {
    const document = createEmptyDocument("doc", "Fallback");
    document.drafting = {
      objects: [
        {
          id: "t1",
          kind: "text",
          locked: false,
          zIndex: 0,
          anchor: {
            kind: "object",
            objectId: "missing",
            localOffset: { x: 0, y: 0 },
            fallbackPosition: { x: 40, y: 40 },
          },
          content: { runs: [{ kind: "text", value: "lost" }] },
          alignment: "start",
          rotation: 0,
        },
      ],
      guides: [],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('data-anchor-resolved="false"');
    expect(svg).toContain(">lost</text>");
  });
});
