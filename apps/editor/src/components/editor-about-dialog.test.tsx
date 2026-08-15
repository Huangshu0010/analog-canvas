import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EditorAboutDialog } from "./editor-about-dialog";

describe("EditorAboutDialog", () => {
  it("identifies the editor, package version, and repository", () => {
    const markup = renderToStaticMarkup(
      <EditorAboutDialog
        closeButtonRef={{ current: null }}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-labelledby="about-title"');
    expect(markup).toContain("Analog Canvas");
    expect(markup).not.toContain("in the browser");
    expect(markup).toContain("Version <strong>0.1.0</strong>");
    expect(markup).toContain(
      'href="https://github.com/chenzc24/Analog-Canvas"',
    );
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer"');
  });
});
