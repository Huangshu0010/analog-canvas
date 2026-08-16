import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SchematicEditSchema } from "./transaction.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("Edit Engine protocol documentation", () => {
  it("lists every executable typed edit kind exactly once", () => {
    const documentation = readFileSync(
      resolve(repositoryRoot, "docs/specs/edit-engine.md"),
      "utf8",
    );
    const section = documentation.match(
      /<!-- schematic-edit-kinds:start -->([\s\S]*?)<!-- schematic-edit-kinds:end -->/u,
    )?.[1];
    expect(section).toBeDefined();

    const documentedKinds = [...section!.matchAll(/`([a-z]+(?:_[a-z]+)*)`/gu)]
      .map((match) => match[1]!)
      .sort();
    const executableKinds = SchematicEditSchema.options
      .map((option) => option.shape.kind.value)
      .sort();

    expect(documentedKinds).toEqual(executableKinds);
  });
});
