import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CURRENT_PROJECT_SCHEMA_VERSION } from "./schema.js";
import { parseProject, serializeProject } from "./persistence.js";

interface CompatibilityCorpus {
  readonly current: readonly string[];
  readonly migrationInputs: readonly string[];
  readonly rejected: readonly { path: string; error: string }[];
}

const repositoryRoot = process.cwd();
const corpus = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, "fixtures/projects/compatibility-corpus.json"),
    "utf8",
  ),
) as CompatibilityCorpus;

function readProject(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

function trackedProjectPaths(): string[] {
  return execFileSync(
    "git",
    ["ls-files", "--", "fixtures/projects", "netlists"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  )
    .split("\n")
    .filter((path) =>
      /^(?:fixtures\/projects\/.+\/project|netlists\/.+)\.icproj\.json$/u.test(
        path,
      ),
    )
    .sort();
}

function assertCurrentForm(serialized: string): void {
  const project = parseProject(serialized);
  expect(project.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
  expect(serializeProject(project)).toBe(serialized);
  expect(serialized).not.toContain('"spice.');
  expect(serialized).not.toContain('"routeAttachment"');
}

describe("supported Project compatibility corpus", () => {
  it("lists every shipped fixture and saved circuit Project exactly once", () => {
    const listed = [
      ...corpus.current,
      ...corpus.migrationInputs,
      ...corpus.rejected.map((entry) => entry.path),
    ].sort();
    const discovered = trackedProjectPaths();

    expect(listed).toEqual(discovered);
  });

  it("keeps current fixtures canonical schema-v8 Projects", () => {
    for (const path of corpus.current) {
      assertCurrentForm(readProject(path));
    }
  });

  it("sequentially migrates every supported historic Project to a stable current form", () => {
    for (const path of corpus.migrationInputs) {
      const migrated = serializeProject(parseProject(readProject(path)));
      assertCurrentForm(migrated);
      expect(serializeProject(parseProject(migrated))).toBe(migrated);
    }
  });

  it("retains invalid fixture cases as explicit rejected inputs", () => {
    for (const entry of corpus.rejected) {
      expect(() => parseProject(readProject(entry.path))).toThrow(entry.error);
    }
  });
});
