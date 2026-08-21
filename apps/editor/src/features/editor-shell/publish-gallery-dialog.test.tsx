import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublishGalleryDialog } from "./publish-gallery-dialog";

describe("PublishGalleryDialog", () => {
  it("prefills the Project name and gates Publish on the passphrase", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishGalleryDialog, {
        defaultName: "Ring Oscillator",
        publish: () => Promise.resolve({ status: "unauthorized" as const }),
        onPublished: () => undefined,
        onClose: () => undefined,
      }),
    );
    expect(markup).toContain('data-testid="publish-gallery-dialog"');
    expect(markup).toContain('value="Ring Oscillator"');
    expect(markup).toContain('aria-label="Owner passphrase"');
    expect(markup).toContain('type="password"');
    // Empty passphrase (no session memory in this render) disables Publish.
    expect(markup).toMatch(/disabled=""[^>]*>Publish</u);
    expect(markup).toContain("owner&#x27;s passphrase");
    // The modern single-column card: stacked full-width fields, a primary
    // Publish action, and the author byline placeholder.
    expect(markup).toContain('class="publish-gallery-fields"');
    expect(markup).toContain('class="publish-gallery-primary"');
    expect(markup).toContain('placeholder="Shown on your tile"');
    expect(markup).not.toContain("insert-component-dialog");
  });
});
