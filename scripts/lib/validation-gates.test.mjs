import { describe, expect, it } from "vitest";

import {
  globPattern,
  loadGateCatalog,
  matchesAny,
  planValidation,
  renderCommand,
  windowsCommandLine,
} from "./validation-gates.mjs";

const catalog = await loadGateCatalog();

function ids(paths) {
  return planValidation(paths, catalog).gates.map((gate) => gate.id);
}

describe("validation gate planning", () => {
  it("matches repository globs without treating a single star as a slash", () => {
    expect(
      globPattern("apps/**/src/**").test("apps/editor/src/app/App.tsx"),
    ).toBe(true);
    expect(matchesAny("docs/testing/README.md", ["**/*.md"])).toBe(true);
    expect(
      globPattern("scripts/package-*.mjs").test("scripts/package-mcp.mjs"),
    ).toBe(true);
  });

  it("keeps documentation-only work on the cheap link gate", () => {
    const plan = planValidation(["docs/user/getting-started.md"], catalog);
    expect(plan.docsOnly).toBe(true);
    expect(plan.requiresFull).toBe(false);
    expect(ids(["docs/user/getting-started.md"])).toEqual([
      "documentation-links",
    ]);
  });

  it("selects focused component placement browser coverage", () => {
    expect(
      ids([
        "apps/editor/src/features/component-insert/placement-connectivity.ts",
      ]),
    ).toEqual([
      "gate-review",
      "static-contracts",
      "test-impact",
      "workspace-unit",
      "component-insert-browser",
      "full-delivery",
    ]);
  });

  it("expands shared protocol changes to hierarchy and persistence", () => {
    const selected = ids(["packages/project-protocol/src/persistence.ts"]);
    expect(selected).toContain("gate-review");
    expect(selected).toContain("workspace-unit");
    expect(selected).toContain("hierarchy-browser");
    expect(selected).toContain("project-file-browser");
    expect(selected).toContain("full-delivery");
  });

  it("selects release verification for package scripts", () => {
    expect(ids(["scripts/package-mcp.mjs"])).toContain("release-verification");
  });

  it("forces a conservative branch and full gate for gate policy changes", () => {
    const plan = planValidation([".github/workflows/ci.yml"], catalog);
    expect(plan.requiresFull).toBe(true);
    expect(plan.fullReasons).toContain(
      "gate contract changed: .github/workflows/ci.yml",
    );
    expect(plan.gates.map((gate) => gate.id)).toContain("branch-verification");
    expect(plan.gates.map((gate) => gate.id)).toContain("full-delivery");
    expect(plan.gates.map((gate) => gate.id)).toContain("gate-review");
  });

  it("requires a review for documentation that defines the gate contract", () => {
    const plan = planValidation(["docs/testing/README.md"], catalog);
    expect(plan.docsOnly).toBe(true);
    expect(plan.requiresFull).toBe(true);
    expect(plan.gates.map((gate) => gate.id)).toContain("gate-review");
  });

  it("treats the Gate Review checker itself as gate policy", () => {
    const plan = planValidation(["scripts/check-gate-review.mjs"], catalog);
    expect(plan.requiresFull).toBe(true);
    expect(plan.gates.map((gate) => gate.id)).toContain("branch-verification");
  });

  it("forces a full fallback for an unclassified implementation path", () => {
    const plan = planValidation(["tooling/new-runner.toml"], catalog);
    expect(plan.unknownPaths).toEqual(["tooling/new-runner.toml"]);
    expect(plan.requiresFull).toBe(true);
    expect(plan.gates.map((gate) => gate.id)).toContain("gate-review");
    expect(plan.gates.map((gate) => gate.id)).toContain("branch-verification");
  });

  it("ignores local stores and renders the selected base", () => {
    expect(planValidation([".pnpm-store/cache.bin"], catalog).paths).toEqual(
      [],
    );
    expect(
      renderCommand(
        ["pnpm", "test:impact", "--", "--base", "{base}"],
        "origin/trunk",
      ),
    ).toEqual(["pnpm", "test:impact", "--", "--base", "origin/trunk"]);
  });

  it("builds a constrained Windows command line without shell metacharacters", () => {
    expect(
      windowsCommandLine([
        "pnpm",
        "test:impact",
        "--",
        "--base",
        "origin/main",
      ]),
    ).toBe("pnpm test:impact -- --base origin/main");
    expect(() => windowsCommandLine(["pnpm", "test", "main & whoami"])).toThrow(
      "unsafe validation-gate argument",
    );
  });
});
