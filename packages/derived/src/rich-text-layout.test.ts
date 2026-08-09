import { describe, expect, it } from "vitest";

import type { RichTextDocument } from "@icm/model";

import {
  measureRichTextDocument,
  richTextMetrics,
} from "./rich-text-layout.js";
import {
  razaviTextbookProfile,
  textbookMonochromeProfile,
} from "./style-profile.js";

describe("shared rich-text layout", () => {
  it("uses the longest line instead of accumulating line widths", () => {
    const content = {
      runs: [
        { kind: "text", value: "longest line" },
        { kind: "line-break" },
        { kind: "text", value: "short" },
      ],
    } as RichTextDocument;
    const layout = measureRichTextDocument(
      content,
      richTextMetrics(razaviTextbookProfile),
    );
    expect(layout.lineWidths).toHaveLength(2);
    expect(layout.width).toBe(layout.lineWidths[0]);
    expect(layout.width).toBeLessThan(
      layout.lineWidths[0]! + layout.lineWidths[1]!,
    );
  });

  it("measures fractions from their real operands and vertical stack", () => {
    const content = {
      runs: [
        {
          kind: "fraction",
          numerator: { runs: [{ kind: "text", value: "VERY_LONG_NUMERATOR" }] },
          denominator: { runs: [{ kind: "text", value: "2" }] },
        },
      ],
    } as RichTextDocument;
    const metrics = richTextMetrics(razaviTextbookProfile);
    const layout = measureRichTextDocument(content, metrics);
    expect(layout.width).toBeGreaterThan(metrics.fontSize * 6);
    expect(layout.height).toBeGreaterThan(metrics.fontSize);
  });

  it("takes exact profile and size override metrics", () => {
    const content = {
      runs: [{ kind: "text", value: "caption" }],
    } as RichTextDocument;
    const textbook = measureRichTextDocument(
      content,
      richTextMetrics(textbookMonochromeProfile, "caption"),
    );
    const razaviScaled = measureRichTextDocument(
      content,
      richTextMetrics(razaviTextbookProfile, "caption", 2),
    );
    expect(razaviScaled.width).toBeGreaterThan(textbook.width * 2);
  });

  it("uses the profile baseline shift when reserving subscript bounds", () => {
    const metrics = richTextMetrics(razaviTextbookProfile);
    const content = {
      runs: [
        {
          kind: "span",
          style: "subscript",
          children: [{ kind: "text", value: "DD" }],
        },
      ],
    } as RichTextDocument;
    const layout = measureRichTextDocument(content, metrics);
    expect(metrics.subscriptScale).toBe(0.84);
    expect(metrics.subscriptBaselineShiftEm).toBe(0.28);
    expect(layout.height).toBeCloseTo(
      metrics.fontSize *
        (metrics.subscriptScale + metrics.subscriptBaselineShiftEm),
    );
  });
});
