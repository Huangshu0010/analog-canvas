import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const check = process.argv.includes("--check");
const root = process.cwd();
const reportPath = resolve(
  root,
  "fixtures/agent-layout-eval/skill-and-ablation-structure.json",
);
const skillPath = resolve(root, "skills/circuit-layout/SKILL.md");
const manifestPath = resolve(
  root,
  "skills/circuit-layout/references/manifest.md",
);
const corePaths = [
  "docs/agent/knowledge/circuit-reading.md",
  "docs/agent/knowledge/schematic-expression.md",
  "docs/agent/knowledge/routing-and-diagnostics.md",
];
const targetedPaths = [
  "docs/agent/knowledge/hierarchy-and-large-circuits.md",
  "docs/agent/knowledge/pdk-and-symbols.md",
  "docs/agent/knowledge/patterns/arrays-and-ladders.md",
  "docs/agent/knowledge/patterns/switching-and-sampling.md",
];
const allKnowledgePaths = [
  ...corePaths,
  "docs/agent/knowledge/human-collaboration.md",
  "docs/agent/knowledge/hierarchy-and-large-circuits.md",
  "docs/agent/knowledge/pdk-and-symbols.md",
  "docs/agent/knowledge/patterns/arrays-and-ladders.md",
  "docs/agent/knowledge/patterns/current-mirror.md",
  "docs/agent/knowledge/patterns/differential-pair.md",
  "docs/agent/knowledge/patterns/switching-and-sampling.md",
];

async function bytes(paths) {
  const contents = await Promise.all(
    paths.map((path) => readFile(resolve(root, path))),
  );
  return contents.reduce((total, content) => total + content.byteLength, 0);
}

const skill = await readFile(skillPath, "utf8");
const manifest = await readFile(manifestPath, "utf8");
const markdownLinks = [...manifest.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/gu)].map(
  (match) => match[1],
);
const brokenLinks = [];
for (const link of markdownLinks) {
  try {
    await readFile(resolve(dirname(manifestPath), link));
  } catch {
    brokenLinks.push(link);
  }
}
const knowledgeOwnership = [];
for (const path of allKnowledgePaths) {
  const content = await readFile(resolve(root, path), "utf8");
  knowledgeOwnership.push({
    path,
    owner: content.includes("Owner:"),
    strength: content.includes("Strength:"),
    trigger: content.includes("Trigger:"),
  });
}

const skillBytes = Buffer.byteLength(skill);
const coreBytes = await bytes(corePaths);
const targetedBytes = await bytes(targetedPaths);
const allKnowledgeBytes = await bytes(allKnowledgePaths);
const tiers = [
  { id: "A", guidance: "no Skill", bytes: 0 },
  { id: "B", guidance: "thin Skill", bytes: skillBytes },
  {
    id: "C",
    guidance: "thin Skill + core knowledge",
    bytes: skillBytes + coreBytes,
  },
  {
    id: "D",
    guidance: "thin Skill + CDAC/large-circuit targeted knowledge",
    bytes: skillBytes + coreBytes + targetedBytes,
  },
].map((tier) => ({
  ...tier,
  estimatedTokens: Math.ceil(tier.bytes / 4),
}));
const contractChecks = {
  apiV2: skill.includes("API `2.0`"),
  completeSnapshot: skill.includes("complete read-only circuit Snapshot"),
  noLayoutIntent: skill.includes(
    "Do not produce or require a fixed Layout Intent",
  ),
  legacyQueryOnly: skill.includes("Use v1 `query` only"),
  staleRevisionRecovery: skill.includes("On `STALE_REVISION`"),
  lockProtection: skill.includes("On a lock conflict"),
  optionalHelpersRemainOptional: skill.includes("every helper disabled"),
  finalRefresh: skill.includes("Refresh the Snapshot"),
};
const report = {
  version: "1.0",
  purpose:
    "deterministic package/progressive-loading ablation; layout-quality ablation requires an external Agent runner and blinded human review",
  manifest: {
    linkedKnowledgeDocuments: markdownLinks.length,
    brokenLinks,
  },
  contractChecks,
  knowledgeOwnership,
  tiers,
  progressiveLoading: {
    allKnowledgeBytes,
    targetedTierKnowledgeBytes: coreBytes + targetedBytes,
    targetedLoadsLessThanWholeLibrary:
      coreBytes + targetedBytes < allKnowledgeBytes,
  },
  hardBoundary: {
    sameSnapshotAndTypedEditAPIAtEveryTier: true,
    guidanceCannotBypassModelRevisionOrLocks: true,
  },
  qualityEvaluation: {
    automatedInThisRepository: false,
    blindedHumanReviewRequired: true,
    reason:
      "Static documents cannot honestly measure Agent reasoning quality or blinded schematic readability.",
  },
  deterministicChecksPassed: false,
};
report.deterministicChecksPassed =
  brokenLinks.length === 0 &&
  Object.values(contractChecks).every(Boolean) &&
  knowledgeOwnership.every(
    (entry) => entry.owner && entry.strength && entry.trigger,
  ) &&
  report.progressiveLoading.targetedLoadsLessThanWholeLibrary;

const text = `${JSON.stringify(report, null, 2)}\n`;
if (check) {
  if ((await readFile(reportPath, "utf8")) !== text)
    throw new Error("Phase 9 Skill evaluation report is stale");
} else {
  await writeFile(reportPath, text);
}
process.stdout.write(text);
if (!report.deterministicChecksPassed) process.exitCode = 1;
