import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { resolveDocumentLogicalNets } from "./logical-net.js";

describe("resolved logical Nets", () => {
  it("unions scoped names, source identity, and explicit equivalence deterministically", () => {
    const document = createEmptyDocument("document", "Document");
    document.nets.push(
      { id: "net-d", scope: "local", terminals: [] },
      { id: "net-a", scope: "local", terminals: [] },
      { id: "net-c", scope: "local", terminals: [] },
      { id: "net-b", scope: "local", terminals: [] },
    );
    document.connectivityEvidence.push(
      {
        id: "claim-a",
        kind: "name-claim",
        netId: "net-a",
        name: "Bias",
        owner: { kind: "explicit-net-property" },
        scope: "local",
      },
      {
        id: "claim-b",
        kind: "name-claim",
        netId: "net-b",
        name: "BIAS",
        owner: { kind: "explicit-net-property" },
        scope: "local",
      },
      {
        id: "source-b",
        kind: "spice-source",
        netId: "net-b",
        sourceNetId: "source-shared",
      },
      {
        id: "source-c",
        kind: "spice-source",
        netId: "net-c",
        sourceNetId: "source-shared",
      },
      {
        id: "equivalence-cd",
        kind: "explicit-equivalence",
        memberNetIds: ["net-c", "net-d"],
      },
    );

    const resolved = resolveDocumentLogicalNets(document);
    expect(resolved.groups).toEqual([
      expect.objectContaining({
        id: "net-a",
        baseNetIds: ["net-a", "net-b", "net-c", "net-d"],
        name: "Bias",
        scope: "local",
        sourceNetIds: ["source-shared"],
        conflicts: [],
      }),
    ]);
    expect(resolved.byBaseNetId.get("net-d")?.id).toBe("net-a");
  });

  it("keeps conflicting explicit equivalence inspectable without choosing a name", () => {
    const document = createEmptyDocument("document", "Document");
    document.nets.push(
      { id: "net-a", scope: "local", terminals: [] },
      { id: "net-b", scope: "global", terminals: [] },
    );
    document.connectivityEvidence.push(
      {
        id: "claim-a",
        kind: "name-claim",
        netId: "net-a",
        name: "A",
        owner: { kind: "explicit-net-property" },
        scope: "local",
      },
      {
        id: "claim-b",
        kind: "name-claim",
        netId: "net-b",
        name: "B",
        owner: { kind: "explicit-net-property" },
        scope: "global",
      },
      {
        id: "equivalence",
        kind: "explicit-equivalence",
        memberNetIds: ["net-a", "net-b"],
      },
    );
    expect(resolveDocumentLogicalNets(document).groups[0]).toMatchObject({
      baseNetIds: ["net-a", "net-b"],
      conflicts: ["name-conflict", "scope-conflict"],
    });
    expect(resolveDocumentLogicalNets(document).groups[0]).not.toHaveProperty(
      "name",
    );
  });
});
