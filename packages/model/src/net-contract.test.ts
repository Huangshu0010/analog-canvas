import { createEmptyDocument } from "./factories.js";
import {
  foldNetName,
  netContractIssueKey,
  validateNetContract,
} from "./net-contract.js";
import { describe, expect, it } from "vitest";

describe("Net contract", () => {
  it("folds only the derived comparison key and preserves authored spelling", () => {
    expect(foldNetName("  VdD  ")).toBe("vdd");
  });

  it("reports duplicate authored names after case folding in stable order", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.nets.push(
      { id: "net-z", name: "Bias", scope: "local", terminals: [] },
      { id: "net-a", name: "bias", scope: "global", terminals: [] },
      { id: "net-other", name: "Other", scope: "local", terminals: [] },
    );

    const issues = validateNetContract(document);
    expect(issues).toEqual([
      {
        code: "DUPLICATE_NET_NAME",
        foldedName: "bias",
        netIds: ["net-a", "net-z"],
      },
    ]);
    expect(netContractIssueKey(issues[0]!)).toBe(
      "DUPLICATE_NET_NAME:bias:net-a,net-z",
    );
  });
});
