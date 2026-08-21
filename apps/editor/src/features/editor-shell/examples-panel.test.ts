import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { libraryProjectExamples } from "../../examples/library-examples";
import { ExamplesPanel } from "./examples-panel";

describe("ExamplesPanel", () => {
  it("presents every bundled example outside the Library device panel", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamplesPanel, {
        open: true,
        onOpenExample: () => undefined,
      }),
    );

    expect(markup).toContain('data-testid="examples-panel"');
    expect(markup).not.toContain('data-testid="shapes-fold-library"');
    expect(markup.match(/data-testid="shapes-example-/g)).toHaveLength(
      libraryProjectExamples.length,
    );
    for (const example of libraryProjectExamples) {
      expect(markup).toContain(`data-testid="shapes-example-${example.id}"`);
      expect(markup).toContain(example.name);
    }
  });
});

describe("user examples section", () => {
  it("renders saved snapshots with open, export, and delete actions", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamplesPanel, {
        open: true,
        onOpenExample: () => undefined,
        userExamples: [
          {
            id: "ex-1",
            name: "My Inverter",
            savedAt: "2026-08-21T10:00:00.000Z",
            schemaVersion: 21,
          },
        ],
      }),
    );
    expect(markup).toContain('data-testid="user-examples-section"');
    expect(markup).toContain("My examples");
    expect(markup).toContain('data-testid="user-example-ex-1"');
    expect(markup).toContain('aria-label="Open my example My Inverter"');
    expect(markup).toContain('aria-label="Export my example My Inverter"');
    expect(markup).toContain('aria-label="Delete my example My Inverter"');
  });

  it("hides the section entirely without saved snapshots", () => {
    const markup = renderToStaticMarkup(
      createElement(ExamplesPanel, {
        open: true,
        onOpenExample: () => undefined,
        userExamples: [],
      }),
    );
    expect(markup).not.toContain('data-testid="user-examples-section"');
  });
});
