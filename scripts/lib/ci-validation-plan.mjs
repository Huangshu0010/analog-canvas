function unique(values) {
  return [...new Set(values)];
}

function implementationPaths(plan) {
  const documentation = new Set(plan.groupPaths.documentation ?? []);
  return plan.paths.filter((path) => !documentation.has(path));
}

function e2eArgs(plan) {
  return unique(plan.gates.flatMap((gate) => gate.ci?.e2eArgs ?? [])).sort();
}

function e2eCoveredPaths(plan) {
  return new Set(
    plan.gates
      .filter((gate) => (gate.ci?.e2eArgs?.length ?? 0) > 0)
      .flatMap((gate) =>
        (gate.groups ?? []).flatMap((group) => plan.groupPaths[group] ?? []),
      ),
  );
}

/**
 * Convert the repository gate plan into the intentionally smaller CI choice.
 * Static, unit, and release jobs still run for every implementation change;
 * this plan controls only whether browser coverage is focused or complete.
 */
export function planCiValidation(plan, { forceFull = false } = {}) {
  if (forceFull) {
    return {
      heavy: true,
      mode: "full",
      e2eArgs: [],
      reasons: ["full validation was requested by the workflow event"],
    };
  }

  const finalGates = plan.gates.filter((gate) => gate.stage === "final");
  if (plan.requiresFull || finalGates.length > 0) {
    return {
      heavy: true,
      mode: "full",
      e2eArgs: [],
      reasons:
        plan.fullReasons.length > 0
          ? plan.fullReasons
          : finalGates.map((gate) => `full gate selected: ${gate.id}`),
    };
  }

  const changedImplementationPaths = implementationPaths(plan);
  if (changedImplementationPaths.length === 0) {
    return {
      heavy: false,
      mode: "documentation",
      e2eArgs: [],
      reasons: ["the change contains no implementation paths"],
    };
  }

  const focusedArgs = e2eArgs(plan);
  const coveredPaths = e2eCoveredPaths(plan);
  const uncoveredPaths = changedImplementationPaths.filter(
    (path) => !coveredPaths.has(path),
  );
  if (focusedArgs.length === 0 || uncoveredPaths.length > 0) {
    return {
      heavy: true,
      mode: "full",
      e2eArgs: [],
      reasons: [
        "no focused browser contract covers every changed implementation path",
        ...uncoveredPaths.map((path) => `uncovered browser impact: ${path}`),
      ],
    };
  }

  return {
    heavy: true,
    mode: "focused",
    e2eArgs: focusedArgs,
    reasons: focusedArgs.map((arg) => `focused browser contract: ${arg}`),
  };
}

export function formatCiValidationPlan(plan) {
  const lines = [
    "CI validation plan",
    `Mode: ${plan.mode}`,
    `Implementation jobs: ${plan.heavy ? "enabled" : "skipped"}`,
    `Browser selection: ${plan.e2eArgs.length > 0 ? plan.e2eArgs.join(" ") : plan.mode === "full" ? "all specs" : "none"}`,
    ...plan.reasons.map((reason) => `  - ${reason}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function formatCiValidationPlanMarkdown(plan) {
  const browserSelection =
    plan.e2eArgs.length > 0
      ? plan.e2eArgs.map((arg) => `\`${arg}\``).join(", ")
      : plan.mode === "full"
        ? "all specs"
        : "none";
  return [
    "## CI execution plan",
    "",
    `- Mode: **${plan.mode}**`,
    `- Implementation jobs: ${plan.heavy ? "enabled" : "skipped"}`,
    `- Browser selection: ${browserSelection}`,
    "",
    ...plan.reasons.map((reason) => `- ${reason}`),
    "",
  ].join("\n");
}
