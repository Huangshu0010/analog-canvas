import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ShapesPanel,
  STARTER_SYMBOL_IDS,
  quickPlaceRequest,
} from "./shapes-panel";

describe("shapes quick-place", () => {
  it("exposes starter chips without persisting parameter placeholders", () => {
    expect(STARTER_SYMBOL_IDS).toContain("resistor");
    expect(STARTER_SYMBOL_IDS).toContain("nmos");

    const request = quickPlaceRequest("razavi", "resistor");
    expect(request).toMatchObject({
      symbolId: "resistor",
      symbolName: "Resistor",
      initialRotation: 0,
      showReference: true,
      referenceText: null,
    });
    expect(request?.properties.value).toBe("");
  });

  it("returns null for unknown symbols", () => {
    expect(quickPlaceRequest("razavi", "not-a-symbol")).toBeNull();
  });

  it("offers a first-class Port rather than a legacy Symbol palette entry", () => {
    expect(STARTER_SYMBOL_IDS).not.toContain("port");
    const markup = renderToStaticMarkup(
      createElement(ShapesPanel, {
        styleProfileId: "razavi-textbook-v1",
        recentSymbolIds: [],
        open: true,
        onOpenInsert: () => undefined,
        onCreatePort: () => undefined,
        onQuickPlace: () => undefined,
      }),
    );
    expect(markup).toContain('data-testid="shapes-chip-port"');
    expect(markup).not.toContain('data-testid="shapes-chip-port-filled"');
  });
});
