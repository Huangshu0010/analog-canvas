import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { customSymbolId } from "@icm/symbols";
import type { SymbolDefinition } from "@icm/symbols";

import { quickCustomSymbolRequest, ShapesPanel } from "./shapes-panel";

function customSymbol(name: string): SymbolDefinition {
  return {
    schemaVersion: 1,
    id: customSymbolId(`custom-symbol-def-${name.toLowerCase()}`),
    name,
    viewBox: { x: -20, y: -10, width: 40, height: 20 },
    pins: [
      {
        name: "1",
        role: "passive",
        at: { x: -20, y: 0 },
        direction: "west",
        presentation: { visibility: "visible" },
      },
      {
        name: "2",
        role: "passive",
        at: { x: 20, y: 0 },
        direction: "east",
        presentation: { visibility: "visible" },
      },
    ],
    primitives: [{ kind: "line", from: { x: -10, y: 0 }, to: { x: 10, y: 0 } }],
    variants: [],
  };
}

describe("ShapesPanel custom symbols (ADR 0047)", () => {
  it("renders imported symbols in their own fold", () => {
    const symbol = customSymbol("My Block");
    const markup = renderToStaticMarkup(
      <ShapesPanel
        styleProfileId="razavi-textbook-v1"
        open
        customSymbols={[symbol]}
        onManageCustomSymbols={() => undefined}
        onStartInsert={() => undefined}
      />,
    );

    expect(markup).toContain("Custom symbols");
    expect(markup).toContain(`data-testid="shapes-chip-${symbol.id}"`);
    expect(markup).toContain("Place My Block");
    expect(markup).toContain('data-testid="shapes-custom-manage"');
    expect(markup).toContain("Manage custom symbols");
  });

  it("points an empty custom library at the File-menu import entry", () => {
    const markup = renderToStaticMarkup(
      <ShapesPanel
        styleProfileId="razavi-textbook-v1"
        open
        customSymbols={[]}
        onStartInsert={() => undefined}
      />,
    );

    expect(markup).toContain("Import a Symbol DSL .json file");
  });

  it("quick-places a custom symbol as a manual-only device", () => {
    const symbol = customSymbol("My Block");
    expect(quickCustomSymbolRequest(symbol)).toEqual({
      kind: "symbol",
      symbolId: symbol.id,
      symbolName: "My Block",
      parameters: {},
      initialRotation: 0,
      showReference: true,
      referenceText: null,
      showValue: false,
    });
  });
});
