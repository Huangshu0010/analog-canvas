import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InsertComponentDialog } from "./insert-component-dialog";

describe("InsertComponentDialog", () => {
  it("renders an expanded picker, device controls, and one authoritative preview", () => {
    const markup = renderToStaticMarkup(
      <InsertComponentDialog
        open
        styleProfileId="razavi-textbook-v1"
        recentSymbolIds={["nmos"]}
        onApply={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="Component search"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-label="Collapse component list"');
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain('class="insert-symbol-artwork"');
    expect(markup).toContain('aria-label="Component w"');
    expect(markup).toContain('aria-label="Component l"');
    expect(markup).toContain('aria-label="Component m"');
    expect(markup).toContain('aria-label="Placement options"');
    expect(markup).toContain('aria-label="Initial rotation"');
    expect(markup).toContain('aria-label="Label name"');
    expect(markup).toContain("W / m");
    expect(markup).toContain("(Channel width)");
    expect(markup).not.toContain("library-component-");
  });

  it("does not render while closed", () => {
    expect(
      renderToStaticMarkup(
        <InsertComponentDialog
          open={false}
          styleProfileId="razavi-textbook-v1"
          recentSymbolIds={[]}
          onApply={() => undefined}
          onCancel={() => undefined}
        />,
      ),
    ).toBe("");
  });
});
