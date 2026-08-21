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

  it("drops the passphrase row for a signed-in admin session", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishGalleryDialog, {
        defaultName: "Ring Oscillator",
        session: { displayName: "Token Zhang", isAdmin: true },
        publish: () => Promise.resolve({ status: "unauthorized" as const }),
        onPublished: () => undefined,
        onClose: () => undefined,
      }),
    );
    expect(markup).not.toContain("Owner passphrase");
    expect(markup).toContain("Signed in as Token Zhang");
    // Publish is enabled without any passphrase.
    expect(markup).not.toMatch(/disabled=""[^>]*>Publish</u);
    // The account display name prefills the author byline.
    expect(markup).toContain('value="Token Zhang"');
  });

  it("keeps the passphrase row for an ordinary signed-in user", () => {
    const markup = renderToStaticMarkup(
      createElement(PublishGalleryDialog, {
        defaultName: "Ring Oscillator",
        session: { displayName: "Visitor", isAdmin: false },
        publish: () => Promise.resolve({ status: "unauthorized" as const }),
        onPublished: () => undefined,
        onClose: () => undefined,
      }),
    );
    expect(markup).toContain("Owner passphrase");
    expect(markup).toMatch(/disabled=""[^>]*>Publish</u);
  });
});
