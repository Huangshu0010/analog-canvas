import { executeTransaction } from "@icm/edit-engine";
import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  clipboardPlacementAnchor,
  clipboardPreviewDocument,
  copySelection,
  proposePaste,
} from "./clipboard";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("schematic clipboard", () => {
  it("duplicates selected components, their named electrical Net, and route atomically", () => {
    const document = createEmptyDocument("document-main", "Clipboard");
    document.instances.push(
      {
        id: "R1",
        symbolId: "resistor",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
      {
        id: "R2",
        symbolId: "resistor",
        placement: {
          position: { x: 240, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    );
    document.nets.push({
      id: "net-signal",
      name: "SIGNAL",
      scope: "local",
      terminals: [
        { instanceId: "R1", pinName: "2" },
        { instanceId: "R2", pinName: "1" },
      ],
      ports: [],
    });
    document.routes.push({
      id: "route-signal",
      netId: "net-signal",
      from: { kind: "terminal", instanceId: "R1", pinName: "2" },
      to: { kind: "terminal", instanceId: "R2", pinName: "1" },
      waypoints: [{ x: 100, y: 80 }],
      segmentModes: ["manual", "manual"],
    });

    const copied = copySelection(document, ["R1", "R2"]);
    expect(copied?.routes).toHaveLength(1);
    const proposal = proposePaste(document, copied!, { x: 20, y: 20 }, 1);
    const result = executeTransaction(
      document,
      {
        transactionId: "paste-1",
        documentId: document.id,
        expectedRevision: 0,
        actor: { kind: "human", id: "test" },
        edits: proposal.edits,
      },
      { symbolResolver: resolver },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.instances).toHaveLength(4);
    expect(result.document.routes).toHaveLength(2);
    expect(result.document.nets).toHaveLength(1);
    expect(result.document.nets[0]?.terminals).toHaveLength(4);
    expect(result.document.routes[1]).toMatchObject({
      netId: "net-signal",
      from: { instanceId: "R1-copy-1" },
      to: { instanceId: "R2-copy-1" },
    });
    expect(result.document.routes[1]?.waypoints).toEqual([{ x: 120, y: 100 }]);
  });

  it("creates an isolated translated document for a copy-placement ghost", () => {
    const document = createEmptyDocument("document-main", "Preview");
    document.instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0,
        mirror: "none",
      },
      properties: {},
    });
    const clipboard = copySelection(document, ["R1"]);
    expect(clipboard).not.toBeNull();
    expect(clipboardPlacementAnchor(clipboard!)).toEqual({ x: 100, y: 100 });

    const preview = clipboardPreviewDocument(document, clipboard!, {
      x: 40,
      y: -20,
    });
    expect(preview.instances[0]?.placement?.position).toEqual({
      x: 140,
      y: 80,
    });
    expect(document.instances[0]?.placement?.position).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("remaps an internal NoConnect to the copied instance", () => {
    const document = createEmptyDocument("document-main", "NoConnect copy");
    document.instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0,
        mirror: "none",
      },
      properties: {},
    });
    document.noConnects.push({
      id: "nc-r1-1",
      endpoint: { kind: "terminal", instanceId: "R1", pinName: "1" },
    });

    const copied = copySelection(document, ["R1"]);
    expect(copied?.noConnects).toEqual(document.noConnects);
    const result = executeTransaction(
      document,
      {
        transactionId: "paste-no-connect",
        documentId: document.id,
        expectedRevision: 0,
        actor: { kind: "human", id: "test" },
        edits: proposePaste(document, copied!, { x: 20, y: 0 }, 1).edits,
      },
      { symbolResolver: resolver },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.noConnects).toContainEqual({
      id: "nc-r1-1-copy-1",
      endpoint: { kind: "terminal", instanceId: "R1-copy-1", pinName: "1" },
    });
  });
});
