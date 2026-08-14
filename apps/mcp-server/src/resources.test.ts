import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { agentOperatingKit } from "@icm/agent-adapter/kit";
import { describe, expect, it } from "vitest";
import { mcpResources } from "./resources.generated.js";
import {
  ADVANCED_EDITS_RESOURCE_URI,
  listResourceEntries,
  readResourceContent,
} from "./resources.js";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../../..");

interface ManifestResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  source: { kind: "repo" | "kit"; path: string };
}

/**
 * Contract test (ADR 0020): MCP Resources must project from the exact sources
 * the manifest declares — repository docs and the published Agent operating
 * kit — with no copied or drifting knowledge.
 */
describe("mcp resources single-source projection", () => {
  const manifest = JSON.parse(
    readFileSync(
      resolve(repoRoot, "docs/agent/resource-manifest.json"),
      "utf8",
    ),
  ) as { resources: ManifestResource[] };

  it("matches every manifest entry with identical content from its source", () => {
    expect(mcpResources).toHaveLength(manifest.resources.length);
    const kitFiles = new Map(
      agentOperatingKit.files.map((file) => [file.path, file.content]),
    );
    for (const entry of manifest.resources) {
      const projected = mcpResources.find((r) => r.uri === entry.uri);
      expect(projected, `missing resource ${entry.uri}`).toBeDefined();
      const expectedText =
        entry.source.kind === "repo"
          ? readFileSync(resolve(repoRoot, entry.source.path), "utf8")
          : kitFiles.get(entry.source.path);
      expect(expectedText, `missing source ${entry.source.path}`).toBeDefined();
      expect(projected).toEqual({
        uri: entry.uri,
        name: entry.name,
        description: entry.description,
        mimeType: entry.mimeType,
        text: expectedText,
      });
    }
  });

  it("exposes the reference set and the advanced-edits gate", () => {
    const uris = mcpResources.map((resource) => resource.uri);
    for (const uri of [
      "analog-canvas://reference/quickstart",
      "analog-canvas://reference/authoring",
      "analog-canvas://reference/routing",
      "analog-canvas://reference/razavi-style",
      "analog-canvas://reference/diagnostics",
      "analog-canvas://reference/recovery",
      "analog-canvas://catalog/builtins",
      ADVANCED_EDITS_RESOURCE_URI,
    ]) {
      expect(uris).toContain(uri);
    }
  });

  it("serves declared resources and rejects unknown URIs", () => {
    const quickstart = readResourceContent(
      "analog-canvas://reference/quickstart",
    );
    expect(quickstart.text).toContain(
      "# Interactive Circuit Maker live-session workflow",
    );
    expect(() => readResourceContent("analog-canvas://reference/nope")).toThrow(
      /Unknown resource/,
    );
    expect(listResourceEntries()).toHaveLength(mcpResources.length);
  });
});
