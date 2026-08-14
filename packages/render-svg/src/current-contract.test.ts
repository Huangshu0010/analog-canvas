import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";

import { renderDocumentSvg } from "./render.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("current rendering contract", () => {
  it("renders both Port assets as symbols and labels only from annotations", () => {
    const document = createEmptyDocument("doc", "Ports");
    document.instances.push(
      {
        id: "VIN",
        symbolId: "port",
        properties: {},
        placement: {
          position: { x: 40, y: 80 },
          rotation: 0,
          mirror: "none",
        },
      },
      {
        id: "VOUT",
        symbolId: "port-filled",
        properties: {},
        placement: {
          position: { x: 180, y: 80 },
          rotation: 180,
          mirror: "none",
        },
      },
    );
    document.nets.push({
      id: "signal",
      scope: "local",
      terminals: [
        { instanceId: "VIN", pinName: "P" },
        { instanceId: "VOUT", pinName: "P" },
      ],
    });
    document.annotations.push({
      id: "label-vin",
      kind: "instance-label",
      content: { runs: [{ kind: "text", value: "V_in" }] },
      anchor: {
        kind: "object",
        objectId: "VIN",
        localOffset: { x: -20, y: -10 },
        fallbackPosition: { x: 20, y: 70 },
      },
      alignment: "end",
      rotation: 0,
      locked: false,
    });

    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('data-symbol-id="port"');
    expect(svg).toContain('data-symbol-id="port-filled"');
    expect(svg).toContain("V_in");
    expect(svg).not.toContain(">VOUT<");
  });
});
