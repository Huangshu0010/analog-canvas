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
    expect(razaviScaled.width).toBe(textbook.width * 2);
  });

  it("uses the profile baseline shift when reserving subscript bounds", () => {
    const metrics = {
      ...richTextMetrics(razaviTextbookProfile),
      subscriptScale: 0.63,
      subscriptBaselineShiftEm: 0.51,
    };
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
    expect(layout.height).toBeCloseTo(
      metrics.fontSize *
        Math.max(
          metrics.lineHeight,
          metrics.subscriptScale + metrics.subscriptBaselineShiftEm,
        ),
    );
  });
});
