import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CustomSymbolDefinition } from "@icm/model";
import { customSymbolId } from "@icm/symbols";
import type { SymbolDefinition } from "@icm/symbols";

import { CustomSymbolManagerDialog } from "./custom-symbol-manager-dialog";

function entry(
  definitionId: string,
  name: string,
  usageCount: number,
): {
  definition: CustomSymbolDefinition;
  symbol: SymbolDefinition;
  usageCount: number;
} {
  const symbol: SymbolDefinition = {
    schemaVersion: 1,
    id: customSymbolId(definitionId),
    name,
    viewBox: { x: -20, y: -10, width: 40, height: 20 },
    pins: [],
    primitives: [{ kind: "line", from: { x: -10, y: 0 }, to: { x: 10, y: 0 } }],
    variants: [],
  };
  return {
    definition: { id: definitionId, symbol },
    symbol,
    usageCount,
  };
}

describe("CustomSymbolManagerDialog", () => {
  it("lists entries with usage and pins per symbol", () => {
    const used = entry("custom-symbol-def-1", "My Block", 3);
    const free = entry("custom-symbol-def-2", "Spare", 0);
    const markup = renderToStaticMarkup(
      <CustomSymbolManagerDialog
        open
        entries={[used, free]}
        onClose={() => undefined}
        onRename={() => undefined}
        onRemove={() => undefined}
      />,
    );

    expect(markup).toContain("Custom Symbols");
    expect(markup).toContain(">My Block</strong>");
    expect(markup).toContain("3 placed");
    expect(markup).toContain("0 placed");
    // The placed symbol's Remove button is disabled until its instances go.
    expect(markup).toContain(
      'data-testid="custom-symbol-remove-custom-symbol-def-1"',
    );
    expect(markup).toContain("Still placed 3 times in this project");
  });

  it("shows an import hint when the library is empty", () => {
    const markup = renderToStaticMarkup(
      <CustomSymbolManagerDialog
        open
        entries={[]}
        onClose={() => undefined}
        onRename={() => undefined}
        onRemove={() => undefined}
      />,
    );

    expect(markup).toContain("No imported symbols yet");
    expect(markup).toContain("File → Import Symbol");
  });

  it("does not render while closed", () => {
    expect(
      renderToStaticMarkup(
        <CustomSymbolManagerDialog
          open={false}
          entries={[]}
          onClose={() => undefined}
          onRename={() => undefined}
          onRemove={() => undefined}
        />,
      ),
    ).toBe("");
  });

  it("renders the remove and rename affordances for a free entry", () => {
    const free = entry("custom-symbol-def-2", "Spare", 0);
    const rename = vi.fn();
    const remove = vi.fn();
    const markup = renderToStaticMarkup(
      <CustomSymbolManagerDialog
        open
        entries={[free]}
        onClose={() => undefined}
        onRename={rename}
        onRemove={remove}
      />,
    );

    // Server rendering cannot open the action dialogs, but both entry points
    // exist and the unused Remove button is enabled.
    expect(markup).toContain(
      'data-testid="custom-symbol-rename-custom-symbol-def-2"',
    );
    expect(markup).toContain(
      'data-testid="custom-symbol-remove-custom-symbol-def-2"',
    );
    expect(rename).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
