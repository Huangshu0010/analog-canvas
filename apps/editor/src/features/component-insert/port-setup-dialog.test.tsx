import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PortSetupDialog } from "./port-setup-dialog";

describe("PortSetupDialog", () => {
  it("keeps the top-level Net Port setup compact and independent of Insert", () => {
    const markup = renderToStaticMarkup(
      <PortSetupDialog
        open
        symbolId="port"
        allowFormalPort={false}
        onApply={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(markup).toContain('class="port-setup-dialog"');
    expect(markup).toContain("Place Net Port");
    expect(markup).toContain('aria-label="Net name"');
    expect(markup).toContain("Optional — creates NET1, NET2…");
    expect(markup).not.toContain("Port type");
    expect(markup).not.toContain("insert-component-dialog");
  });

  it("exposes both explicit Port roles with a configurable default", () => {
    const markup = renderToStaticMarkup(
      <PortSetupDialog
        open
        symbolId="port-filled"
        allowFormalPort
        onApply={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(markup).toContain("Place Cell Pin");
    expect(markup).toContain("Port type");
    expect(markup).toContain('aria-label="Terminal name"');
    expect(markup).toContain('aria-label="Cell Pin direction"');
  });

  it("keeps Free Net Port as the top-Document default while exposing Formal Pin", () => {
    const markup = renderToStaticMarkup(
      <PortSetupDialog
        open
        symbolId="port"
        allowFormalPort
        defaultRole="net-port"
        onApply={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(markup).toContain("Place Net Port");
    expect(markup).toContain('aria-label="Net name"');
    expect(markup).toContain("Formal Cell Pin");
    expect(markup).toContain("Free Net Port");
  });
});
