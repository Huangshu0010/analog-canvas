const testFile = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/u;
const implementationFile = /\.(?:[cm]?[jt]sx?)$/u;

function normalized(path) {
  return path.replaceAll("\\", "/");
}

export function testPathKind(path) {
  const value = normalized(path);
  if (testFile.test(value) || value.startsWith("apps/editor/e2e/")) {
    return "test";
  }
  if (
    ((value.startsWith("apps/") || value.startsWith("packages/")) &&
      value.includes("/src/") &&
      implementationFile.test(value)) ||
    (value.startsWith("worker/") && implementationFile.test(value)) ||
    (value.startsWith("scripts/") && implementationFile.test(value))
  ) {
    return "implementation";
  }
  if (/^plan\/[^/]+\/plan\.md$/u.test(value)) return "plan";
  return "other";
}

export function readTestImpact(text) {
  const section = text.match(
    /^## Test Impact\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  );
  if (!section) return null;
  const body = section[1];
  const decision = body.match(
    /^-\s*Decision:\s*(tests-updated|no-test-change)\s*$/mu,
  )?.[1];
  if (!decision) return { valid: false, reason: "missing Decision" };
  if (
    decision === "no-test-change" &&
    !/^-\s*(Reason|Existing protection):\s*\S/mu.test(body)
  ) {
    return {
      valid: false,
      reason: "no-test-change requires Reason or Existing protection",
    };
  }
  return { valid: true, decision };
}

/**
 * Decide whether a production-code diff records an auditable test decision.
 * This intentionally does not require a changed test file for cosmetic or
 * proven behavior-neutral work; it requires the plan to say why instead.
 */
export function assessTestImpact(paths, planDocuments) {
  const implementationPaths = paths.filter(
    (path) => testPathKind(path) === "implementation",
  );
  if (implementationPaths.length === 0) {
    return { ok: true, message: "No implementation paths changed." };
  }

  const testPaths = paths.filter((path) => testPathKind(path) === "test");
  const impacts = planDocuments.map(({ path, text }) => ({
    path,
    impact: readTestImpact(text),
  }));
  const invalid = impacts.find(({ impact }) => impact && !impact.valid);
  if (invalid) {
    return {
      ok: false,
      message: `${invalid.path}: invalid Test Impact (${invalid.impact.reason}).`,
    };
  }
  const decisions = impacts
    .filter(({ impact }) => impact?.valid)
    .map(({ impact }) => impact.decision);
  if (decisions.length === 0) {
    return {
      ok: false,
      message:
        "Implementation changes require a changed target plan with a Test Impact section.",
    };
  }
  if (testPaths.length > 0 && decisions.includes("tests-updated")) {
    return { ok: true, message: "Tests changed and the plan records them." };
  }
  if (testPaths.length === 0 && decisions.includes("no-test-change")) {
    return {
      ok: true,
      message: "No tests changed; the plan records the evidence-based reason.",
    };
  }
  return {
    ok: false,
    message:
      testPaths.length > 0
        ? "Changed tests require Test Impact Decision: tests-updated."
        : "Implementation changes without tests require Test Impact Decision: no-test-change plus evidence.",
  };
}
