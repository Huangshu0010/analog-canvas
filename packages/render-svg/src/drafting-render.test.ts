import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { renderDocumentSvg } from "./render.js";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("drafting layer rendering (WP-A1b)", () => {
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
    // rendering is WP-A2.
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
        { id: "g1", axis: "vertical", coordinate: 100, locked: false, visible: true },
      ],
    };
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).not.toContain('data-object-id="g1"');
    expect(svg).not.toContain('data-kind="guide"');
  });

  it("renders a construction-line with dashed style (WP-A4)", () => {
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

  it("renders a draft arrow with a head (WP-A4)", () => {
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
  });

  it("renders a floating symbol with its primitives (WP-A4)", () => {
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
});
