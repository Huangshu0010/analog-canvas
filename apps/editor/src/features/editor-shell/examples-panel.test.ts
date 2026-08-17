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
