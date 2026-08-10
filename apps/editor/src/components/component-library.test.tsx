import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComponentLibrary } from "./component-library";

describe("Razavi-only Component Library", () => {
  it("shows only approved Razavi product symbols", () => {
    const markup = renderToStaticMarkup(
      <ComponentLibrary onPlace={() => {}} />,
    );
    for (const symbolId of [
      "capacitor",
      "current-source",
      "ground",
      "nmos",
      "pmos",
      "port",
      "port-filled",
      "resistor",
      "voltage-source",
      "vdd",
    ]) {
      expect(markup).toContain(`data-testid="library-component-${symbolId}"`);
    }
    for (const symbolId of [
      "diode",
      "inductor",
      "npn",
      "pnp",
      "opamp",
      "generic-block",
    ]) {
      expect(markup).not.toContain(
        `data-testid="library-component-${symbolId}"`,
      );
    }
  });
});
