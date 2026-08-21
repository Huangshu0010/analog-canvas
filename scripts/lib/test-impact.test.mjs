import { describe, expect, it } from "vitest";

import {
  assessGateReview,
  assessTestImpact,
  readGateReview,
  readTestImpact,
  testPathKind,
} from "./test-impact.mjs";

const gateReview = `## Gate Review

- Decision: affected
- Early gates: typecheck and focused unit contracts
- Affected gates: package unit and browser contracts
- Final gates: complete delivery gate
`;

const updatedPlan = `${gateReview}

## Test Impact

- Decision: tests-updated
- Contracts: example
`;

const noTestPlan = `${gateReview}

## Test Impact

- Decision: no-test-change
- Reason: formatting only; existing contract tests exercise unchanged behavior
`;

describe("test-impact governance", () => {
  it("classifies co-located, browser, script, and plan paths", () => {
    expect(testPathKind("packages/model/src/schema.ts")).toBe("implementation");
    expect(testPathKind("apps/editor/e2e/project-file.spec.ts")).toBe("test");
    expect(testPathKind("scripts/check-test-impact.mjs")).toBe(
      "implementation",
    );
    expect(testPathKind("plan/2026-08-17-example/plan.md")).toBe("plan");
  });

  it("requires evidence when production code changes without a test file", () => {
    expect(
      assessTestImpact(
        ["packages/model/src/schema.ts"],
        [{ path: "plan/x/plan.md", text: noTestPlan }],
      ),
    ).toMatchObject({ ok: true });
    expect(
      assessTestImpact(
        ["packages/model/src/schema.ts"],
        [{ path: "plan/x/plan.md", text: updatedPlan }],
      ),
    ).toMatchObject({ ok: false });
  });

  it("requires a tests-updated decision when test files changed", () => {
    const paths = [
      "packages/model/src/schema.ts",
      "packages/model/src/schema.test.ts",
    ];
    expect(
      assessTestImpact(paths, [{ path: "plan/x/plan.md", text: updatedPlan }]),
    ).toMatchObject({ ok: true });
    expect(
      assessTestImpact(paths, [{ path: "plan/x/plan.md", text: noTestPlan }]),
    ).toMatchObject({ ok: false });
  });

  it("rejects incomplete no-test declarations", () => {
    expect(
      readTestImpact("## Test Impact\n\n- Decision: no-test-change\n"),
    ).toEqual({
      valid: false,
      reason: "no-test-change requires Reason or Existing protection",
    });
  });

  it("requires an explicit gate decision with early and final gates", () => {
    expect(readGateReview(gateReview)).toEqual({
      valid: true,
      decision: "affected",
    });
    expect(
      readGateReview(
        "## Gate Review\n\n- Decision: affected\n- Affected gates: unit\n- Final gates: full\n",
      ),
    ).toEqual({ valid: false, reason: "missing Early gates" });
    expect(
      readGateReview(
        "## Gate Review\n\n- Decision: affected\n- Early gates: static\n- Final gates: full\n",
      ),
    ).toEqual({ valid: false, reason: "missing Affected gates" });
    expect(
      assessGateReview([
        {
          path: "plan/x/plan.md",
          text: "## Test Impact\n\n- Decision: no-test-change\n- Reason: formatting only\n",
        },
      ]),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("Gate Review"),
    });
    expect(
      assessGateReview([{ path: "plan/x/plan.md", text: updatedPlan }]),
    ).toMatchObject({ ok: true });
  });
});
