import { createHash, randomBytes } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import {
  AgentSessionSnapshotSchema,
  buildAgentSessionSnapshot,
} from "../packages/agent-adapter/dist/index.js";
import {
  CircuitProjectSchema,
  parseProject,
  serializeProject,
} from "../packages/model/dist/index.js";
import {
  builtInSymbols,
  createProjectSymbolResolver,
} from "../packages/symbols/dist/index.js";

const TIERS = ["A", "B", "C", "D"];
const SCORE_CATEGORIES = [
  "functionalStructure",
  "powerBiasControlSeparation",
  "hierarchyRepetitionClarity",
  "crossingJunctionLabelReadability",
  "textbookUsefulness",
];
const DEFAULT_CORE = [
  "docs/agent/knowledge/circuit-reading.md",
  "docs/agent/knowledge/schematic-expression.md",
  "docs/agent/knowledge/routing-and-diagnostics.md",
];
const COMMON_API_SOURCES = [
  "docs/specs/agent-api.md",
  "docs/specs/edit-engine.md",
  "fixtures/agent-api/agent-circuit-request.schema.json",
  "tools/agent-layout/external-eval-runner.md",
];

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function stable(input) {
  if (Array.isArray(input)) return input.map(stable);
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, value]) => [key, stable(value)]),
    );
  }
  return input;
}

function electricalSignature(project) {
  const byId = (left, right) => left.id.localeCompare(right.id, "en");
  return sha256(
    JSON.stringify(
      stable({
        schemaVersion: project.schemaVersion,
        projectId: project.id,
        source: project.source,
        symbolLibrary: project.symbolLibrary,
        topDocumentId: project.topDocumentId,
        documents: [...project.documents].sort(byId).map((document) => ({
          id: document.id,
          sourceBinding: document.sourceBinding ?? null,
          ports: [...document.ports]
            .sort(byId)
            .map(({ id, name, direction }) => ({ id, name, direction })),
          instances: [...document.instances].sort(byId).map((instance) => ({
            id: instance.id,
            symbolId: instance.symbolId,
            properties: Object.fromEntries(
              Object.entries(instance.properties).filter(
                ([key]) =>
                  key === "value" ||
                  key.startsWith("spice.") ||
                  key.startsWith("symbol.mapping."),
              ),
            ),
          })),
          nets: [...document.nets]
            .sort(byId)
            .map(({ id, scope, terminals, ports }) => ({
              id,
              scope,
              terminals: [...terminals].sort((left, right) =>
                `${left.instanceId}\u0000${left.pinName}`.localeCompare(
                  `${right.instanceId}\u0000${right.pinName}`,
                  "en",
                ),
              ),
              ports: [...ports].sort((left, right) =>
                left.localeCompare(right, "en"),
              ),
            })),
        })),
      }),
    ),
  );
}

function objectById(document, id) {
  return [
    ...document.ports,
    ...document.instances,
    ...document.nets,
    ...document.routes,
    ...document.junctions,
    ...document.annotations,
    ...document.layoutGroups,
    ...document.constraints,
  ].find((item) => item.id === id);
}

function lockedState(project) {
  const records = [];
  for (const document of project.documents) {
    for (const annotation of document.annotations.filter(
      (item) => item.locked,
    )) {
      records.push({
        documentId: document.id,
        kind: "annotation",
        value: annotation,
      });
    }
    for (const owner of [
      ...document.layoutGroups.filter((item) => item.locked),
      ...document.constraints.filter((item) => item.locked),
    ]) {
      records.push({
        documentId: document.id,
        kind: "owner-and-members",
        value: {
          owner,
          members: owner.objectIds.map((id) => ({
            id,
            object: objectById(document, id),
          })),
        },
      });
    }
  }
  return JSON.stringify(
    stable(
      records.sort((left, right) =>
        JSON.stringify(stable(left)).localeCompare(
          JSON.stringify(stable(right)),
          "en",
        ),
      ),
    ),
  );
}

async function readUtf8(path) {
  return readFile(resolve(path), "utf8");
}

async function contextSection(path) {
  const content = await readUtf8(path);
  return `\n\n--- BEGIN ${path} ---\n\n${content}\n--- END ${path} ---`;
}

async function buildContext(tier, task, targeted) {
  let result = `# Isolated Phase 9 evaluation tier ${tier}\n\n${task}\n\nUse Agent Circuit API v2 only. Start from the supplied Project, keep optional helpers disabled, preserve electrical topology and locks, use typed transactions, and finish with refreshed complete Snapshots plus a formal render for every Document. Do not inspect another tier's directory.`;
  for (const path of COMMON_API_SOURCES) result += await contextSection(path);
  if (tier === "A") return result;
  result += await contextSection("skills/circuit-layout/SKILL.md");
  if (tier === "B") return result;
  for (const path of DEFAULT_CORE) result += await contextSection(path);
  if (tier === "C") return result;
  for (const path of targeted) result += await contextSection(path);
  return result;
}

function guidanceSources(tier, targeted) {
  if (tier === "A") return [];
  if (tier === "B") return ["skills/circuit-layout/SKILL.md"];
  if (tier === "C") return ["skills/circuit-layout/SKILL.md", ...DEFAULT_CORE];
  return ["skills/circuit-layout/SKILL.md", ...DEFAULT_CORE, ...targeted];
}

function resultContract(initialRevisions) {
  return {
    requiredFiles: [
      "result/final.icproj.json",
      "result/final.snapshots.json",
      "result/renders.json",
      "result/final.svg",
      "result/trace.json",
      "result/metrics.json",
    ],
    trace: {
      apiVersion: "2.0",
      operations: [
        "capabilities",
        "snapshot",
        "transact",
        "render",
        "snapshot",
      ],
      initialRevisions,
      finalRevisions: "documentId -> integer >= initial revision",
      finalSnapshotHashes: "documentId -> 64 lowercase hex characters",
      finalRefresh: true,
      queryCalls: 0,
      optionalHelpersEnabled: false,
      lockViolations: 0,
      validationErrors: 0,
      silentRejectedEdits: 0,
      finalDiagnostics: [],
    },
    metrics: {
      provider: "string",
      model: "string",
      modelVersion: "string",
      settings: {},
      measurementScope: "end-to-end or runner-only",
      elapsedMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      contextTokens: 0,
      snapshotRefreshes: 0,
      transactions: 0,
      dryRuns: 0,
      rejectedEdits: 0,
      rollbacks: 0,
      renders: 0,
    },
  };
}

async function prepare({ projectPath, taskPath, out, targeted }) {
  try {
    await readFile(resolve(out, "manifest.json"));
    throw new Error(
      `Evaluation output already exists at ${resolve(out)}; choose a new directory`,
    );
  } catch (error) {
    if (!String(error).includes("ENOENT")) throw error;
  }
  const projectText = await readUtf8(projectPath);
  const project = parseProject(projectText);
  const task = await readUtf8(taskPath);
  const canonicalProject = serializeProject(project);
  const initialRevisions = Object.fromEntries(
    project.documents.map((document) => [document.id, document.revision]),
  );
  const manifest = {
    version: "1.0",
    status: "prepared",
    createdAt: new Date().toISOString(),
    commonApiSources: COMMON_API_SOURCES,
    input: {
      projectSha256: sha256(canonicalProject),
      electricalSignature: electricalSignature(project),
      lockedStateSha256: sha256(lockedState(project)),
      taskSha256: sha256(task),
      topDocumentId: project.topDocumentId,
      initialRevisions,
    },
    tiers: {},
  };
  await mkdir(resolve(out, "input"), { recursive: true });
  await writeFile(resolve(out, "input/project.icproj.json"), canonicalProject);
  await writeFile(resolve(out, "input/task.md"), task);
  for (const tier of TIERS) {
    const context = await buildContext(tier, task, targeted);
    const tierRoot = resolve(out, "tiers", tier);
    await mkdir(resolve(tierRoot, "result"), { recursive: true });
    await writeFile(resolve(tierRoot, "context.md"), context);
    await writeFile(
      resolve(tierRoot, "result-contract.json"),
      `${JSON.stringify(resultContract(initialRevisions), null, 2)}\n`,
    );
    await copyFile(
      resolve(out, "input/project.icproj.json"),
      resolve(tierRoot, "starting-project.icproj.json"),
    );
    manifest.tiers[tier] = {
      guidanceSources: guidanceSources(tier, targeted),
      contextSha256: sha256(context),
      contextBytes: Buffer.byteLength(context),
      startingProjectSha256: sha256(canonicalProject),
    };
  }
  await writeFile(
    resolve(out, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

function requireNumber(record, key) {
  if (!Number.isFinite(record[key]) || record[key] < 0)
    throw new Error(`metrics.${key} must be a non-negative number`);
}

async function validateTier(root, tier, initialProject, manifest) {
  const resultRoot = resolve(root, "tiers", tier, "result");
  const finalProject = parseProject(
    await readFile(resolve(resultRoot, "final.icproj.json"), "utf8"),
  );
  if (electricalSignature(finalProject) !== manifest.input.electricalSignature)
    throw new Error(`Tier ${tier} changed the electrical signature`);
  if (sha256(lockedState(finalProject)) !== manifest.input.lockedStateSha256)
    throw new Error(`Tier ${tier} changed locked state`);
  const suppliedSnapshots = JSON.parse(
    await readFile(resolve(resultRoot, "final.snapshots.json"), "utf8"),
  );
  if (!Array.isArray(suppliedSnapshots))
    throw new Error(`Tier ${tier} final.snapshots.json must be an array`);
  const renderManifest = JSON.parse(
    await readFile(resolve(resultRoot, "renders.json"), "utf8"),
  );
  const finalSvg = await readFile(resolve(resultRoot, "final.svg"), "utf8");
  const trace = JSON.parse(
    await readFile(resolve(resultRoot, "trace.json"), "utf8"),
  );
  const metrics = JSON.parse(
    await readFile(resolve(resultRoot, "metrics.json"), "utf8"),
  );
  const resolver = createProjectSymbolResolver(finalProject, builtInSymbols);
  const expectedSnapshots = finalProject.documents.map((document) =>
    buildAgentSessionSnapshot({ project: finalProject, document, resolver }),
  );
  const suppliedByDocument = new Map(
    suppliedSnapshots.map((snapshot) => {
      const parsed = AgentSessionSnapshotSchema.parse(snapshot);
      return [parsed.document.id, parsed];
    }),
  );
  if (
    suppliedByDocument.size !== expectedSnapshots.length ||
    expectedSnapshots.some(
      (snapshot) =>
        JSON.stringify(suppliedByDocument.get(snapshot.document.id)) !==
        JSON.stringify(snapshot),
    )
  )
    throw new Error(
      `Tier ${tier} final Snapshots do not match every final Project Document`,
    );
  if (
    finalProject.documents.some(
      (document) =>
        document.instances.some((instance) => instance.placement === null) ||
        document.ports.some((port) => port.position === null),
    )
  )
    throw new Error(`Tier ${tier} left an instance or port unplaced`);
  if (
    !Array.isArray(renderManifest) ||
    renderManifest.length !== finalProject.documents.length ||
    new Set(renderManifest.map((item) => item.documentId)).size !==
      finalProject.documents.length
  )
    throw new Error(`Tier ${tier} lacks one formal render per Document`);
  for (const document of finalProject.documents) {
    const entry = renderManifest.find(
      (item) => item.documentId === document.id,
    );
    if (
      !entry ||
      typeof entry.file !== "string" ||
      typeof entry.sha256 !== "string" ||
      !Number.isInteger(entry.byteLength)
    )
      throw new Error(`Tier ${tier} has an invalid render manifest entry`);
    const renderPath = resolve(resultRoot, entry.file);
    const normalizedRoot = `${resultRoot.replaceAll("/", "\\")}\\`;
    if (
      !renderPath.replaceAll("/", "\\").startsWith(normalizedRoot) ||
      !entry.file.startsWith("renders/")
    )
      throw new Error(`Tier ${tier} render path escapes its result directory`);
    const svg = await readFile(renderPath, "utf8");
    if (
      sha256(svg) !== entry.sha256 ||
      Buffer.byteLength(svg) !== entry.byteLength ||
      !svg.includes('data-layer="formal"') ||
      /editor-overlay|route-hit|selection-overlay/u.test(svg)
    )
      throw new Error(`Tier ${tier} has an invalid Document render`);
    if (!finalSvg.includes(`data-document-id="${document.id}"`))
      throw new Error(
        `Tier ${tier} contact sheet omits Document ${document.id}`,
      );
  }
  if (trace.apiVersion !== "2.0" || trace.queryCalls !== 0)
    throw new Error(`Tier ${tier} did not use the v2 Snapshot-only read path`);
  const allowedOperations = new Set([
    "capabilities",
    "snapshot",
    "transact",
    "render",
  ]);
  if (
    !Array.isArray(trace.operations) ||
    trace.operations.length === 0 ||
    trace.operations.some((operation) => !allowedOperations.has(operation)) ||
    trace.operations.at(-1) !== "snapshot" ||
    !trace.operations.includes("transact") ||
    !trace.operations.includes("render")
  )
    throw new Error(`Tier ${tier} has an invalid operation trace`);
  if (trace.optionalHelpersEnabled !== false)
    throw new Error(`Tier ${tier} enabled an optional helper`);
  if (
    trace.finalRefresh !== true ||
    JSON.stringify(Object.keys(trace.finalSnapshotHashes ?? {}).sort()) !==
      JSON.stringify(
        expectedSnapshots.map((snapshot) => snapshot.document.id).sort(),
      ) ||
    expectedSnapshots.some(
      (snapshot) =>
        !/^[a-f0-9]{64}$/u.test(
          trace.finalSnapshotHashes?.[snapshot.document.id] ?? "",
        ) ||
        trace.finalSnapshotHashes[snapshot.document.id] !==
          snapshot.electricalTopologyHash,
    )
  )
    throw new Error(`Tier ${tier} lacks a valid final Snapshot refresh`);
  for (const key of [
    "lockViolations",
    "validationErrors",
    "silentRejectedEdits",
  ]) {
    if (trace[key] !== 0) throw new Error(`Tier ${tier} has ${key}`);
  }
  if (
    !Array.isArray(trace.finalDiagnostics) ||
    trace.finalDiagnostics.some((item) => item.severity === "error")
  )
    throw new Error(`Tier ${tier} has blocking final diagnostics`);
  const expectedDiagnostics = expectedSnapshots.flatMap((snapshot) =>
    snapshot.document.diagnostics.map((diagnostic) => ({
      documentId: snapshot.document.id,
      ...diagnostic,
    })),
  );
  if (
    JSON.stringify(stable(trace.finalDiagnostics)) !==
    JSON.stringify(stable(expectedDiagnostics))
  )
    throw new Error(`Tier ${tier} final diagnostics are not derived evidence`);
  const initialRevisions = Object.fromEntries(
    initialProject.documents.map((document) => [
      document.id,
      document.revision,
    ]),
  );
  const finalRevisions = Object.fromEntries(
    finalProject.documents.map((document) => [document.id, document.revision]),
  );
  if (
    JSON.stringify(stable(trace.initialRevisions)) !==
      JSON.stringify(stable(initialRevisions)) ||
    JSON.stringify(stable(trace.finalRevisions)) !==
      JSON.stringify(stable(finalRevisions)) ||
    Object.entries(finalRevisions).some(
      ([documentId, revision]) => revision <= initialRevisions[documentId],
    )
  )
    throw new Error(`Tier ${tier} revision evidence is inconsistent`);
  if (
    !finalSvg.includes('data-layer="formal"') ||
    /editor-overlay|route-hit|selection-overlay/u.test(finalSvg)
  )
    throw new Error(`Tier ${tier} render is not a clean formal artifact`);
  for (const key of [
    "elapsedMs",
    "inputTokens",
    "outputTokens",
    "contextTokens",
    "snapshotRefreshes",
    "transactions",
    "dryRuns",
    "rejectedEdits",
    "rollbacks",
    "renders",
  ])
    requireNumber(metrics, key);
  for (const key of ["provider", "model", "modelVersion"]) {
    if (typeof metrics[key] !== "string" || metrics[key].length === 0)
      throw new Error(`Tier ${tier} metrics.${key} is required`);
  }
  if (!new Set(["end-to-end", "runner-only"]).has(metrics.measurementScope))
    throw new Error(`Tier ${tier} metrics.measurementScope is invalid`);
  if (
    metrics.snapshotRefreshes < expectedSnapshots.length ||
    metrics.renders < expectedSnapshots.length ||
    metrics.dryRuns !== metrics.transactions
  )
    throw new Error(
      `Tier ${tier} did not refresh every Document Snapshot or render the result`,
    );
  return {
    tier,
    finalProjectSha256: sha256(serializeProject(finalProject)),
    finalSvgSha256: sha256(finalSvg),
    finalSnapshotHashes: trace.finalSnapshotHashes,
    finalRevisions,
    diagnostics: trace.finalDiagnostics,
    metrics,
  };
}

async function finalize(root) {
  const manifestPath = resolve(root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!["prepared", "awaiting-blind-review"].includes(manifest.status))
    throw new Error(`Evaluation status ${manifest.status} cannot be finalized`);
  const initialProjectText = await readFile(
    resolve(root, "input/project.icproj.json"),
    "utf8",
  );
  const task = await readFile(resolve(root, "input/task.md"), "utf8");
  if (
    sha256(initialProjectText) !== manifest.input.projectSha256 ||
    sha256(task) !== manifest.input.taskSha256
  )
    throw new Error("Prepared Project or task file was modified");
  const initialProject = parseProject(initialProjectText);
  if (
    electricalSignature(initialProject) !== manifest.input.electricalSignature
  )
    throw new Error(
      "Prepared input no longer matches its electrical signature",
    );
  const tiers = [];
  for (const tier of TIERS) {
    const context = await readFile(resolve(root, "tiers", tier, "context.md"));
    const startingProject = await readFile(
      resolve(root, "tiers", tier, "starting-project.icproj.json"),
    );
    const preparedContract = JSON.parse(
      await readFile(
        resolve(root, "tiers", tier, "result-contract.json"),
        "utf8",
      ),
    );
    if (
      sha256(context) !== manifest.tiers[tier].contextSha256 ||
      sha256(startingProject) !== manifest.tiers[tier].startingProjectSha256 ||
      JSON.stringify(stable(preparedContract)) !==
        JSON.stringify(stable(resultContract(manifest.input.initialRevisions)))
    )
      throw new Error(`Tier ${tier} prepared inputs were modified`);
    tiers.push(await validateTier(root, tier, initialProject, manifest));
  }
  const modelSettings = tiers.map((item) =>
    JSON.stringify(
      stable({
        provider: item.metrics.provider,
        model: item.metrics.model,
        modelVersion: item.metrics.modelVersion,
        settings: item.metrics.settings,
      }),
    ),
  );
  if (new Set(modelSettings).size !== 1)
    throw new Error(
      "All four tiers must use identical model/provider/settings",
    );

  let candidates;
  try {
    candidates = JSON.parse(
      await readFile(resolve(root, "private/tier-map.json"), "utf8"),
    ).candidates;
    if (
      candidates.length !== TIERS.length ||
      new Set(candidates.map((item) => item.tier)).size !== TIERS.length
    )
      throw new Error("Existing private tier map is invalid");
  } catch (error) {
    if (!String(error).includes("ENOENT")) throw error;
    candidates = TIERS.map((tier) => ({
      tier,
      candidateId: `candidate-${randomBytes(4).toString("hex").toUpperCase()}`,
    }));
  }
  await mkdir(resolve(root, "private"), { recursive: true });
  await mkdir(resolve(root, "blind"), { recursive: true });
  await writeFile(
    resolve(root, "private/tier-map.json"),
    `${JSON.stringify({ version: "1.0", candidates }, null, 2)}\n`,
  );
  const reviewCandidates = [];
  for (const candidate of candidates.sort((left, right) =>
    left.candidateId.localeCompare(right.candidateId, "en"),
  )) {
    const filename = `${candidate.candidateId}.svg`;
    await copyFile(
      resolve(root, "tiers", candidate.tier, "result/final.svg"),
      resolve(root, "blind", filename),
    );
    reviewCandidates.push({
      candidateId: candidate.candidateId,
      render: filename,
      scores: Object.fromEntries(SCORE_CATEGORIES.map((key) => [key, null])),
      comments: "",
    });
  }
  await writeFile(
    resolve(root, "blind/review-form.json"),
    `${JSON.stringify(
      {
        version: "1.0",
        reviewerId: "",
        scale: { minimum: 1, maximum: 5 },
        candidates: reviewCandidates,
      },
      null,
      2,
    )}\n`,
  );
  manifest.status = "awaiting-blind-review";
  manifest.validatedTiers = tiers;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, candidates: reviewCandidates };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function score(root, responsePath) {
  const manifest = JSON.parse(
    await readFile(resolve(root, "manifest.json"), "utf8"),
  );
  if (manifest.status !== "awaiting-blind-review")
    throw new Error(`Evaluation status ${manifest.status} cannot be scored`);
  const mapping = JSON.parse(
    await readFile(resolve(root, "private/tier-map.json"), "utf8"),
  );
  const response = JSON.parse(await readFile(resolve(responsePath), "utf8"));
  if (
    typeof response.reviewerId !== "string" ||
    response.reviewerId.length === 0
  )
    throw new Error("reviewerId is required before scoring");
  const tierByCandidate = new Map(
    mapping.candidates.map((item) => [item.candidateId, item.tier]),
  );
  if (
    !Array.isArray(response.candidates) ||
    response.candidates.length !== TIERS.length ||
    new Set(response.candidates.map((item) => item.candidateId)).size !==
      TIERS.length
  )
    throw new Error("Exactly four distinct anonymous candidates are required");
  const readability = {};
  for (const candidate of response.candidates ?? []) {
    const tier = tierByCandidate.get(candidate.candidateId);
    if (!tier) throw new Error(`Unknown candidate ${candidate.candidateId}`);
    const values = SCORE_CATEGORIES.map((key) => candidate.scores?.[key]);
    if (
      values.some((value) => !Number.isInteger(value) || value < 1 || value > 5)
    )
      throw new Error(
        `Candidate ${candidate.candidateId} has an invalid score`,
      );
    readability[tier] = {
      mean: Number(average(values).toFixed(3)),
      scores: candidate.scores,
      comments: candidate.comments ?? "",
    };
  }
  if (TIERS.some((tier) => !readability[tier]))
    throw new Error("Every anonymous candidate must be scored exactly once");
  const metricsByTier = Object.fromEntries(
    manifest.validatedTiers.map((item) => [item.tier, item.metrics]),
  );
  const baseline = readability.A.mean;
  const primaryNonRegression = ["B", "C", "D"].every(
    (tier) => readability[tier].mean >= baseline,
  );
  const endToEndEfficiencyComparable = TIERS.every(
    (tier) => metricsByTier[tier].measurementScope === "end-to-end",
  );
  const efficiencyOrReadabilityImprovement = ["B", "C", "D"].some(
    (tier) =>
      readability[tier].mean > baseline ||
      (endToEndEfficiencyComparable &&
        (metricsByTier[tier].transactions < metricsByTier.A.transactions ||
          metricsByTier[tier].rejectedEdits < metricsByTier.A.rejectedEdits ||
          metricsByTier[tier].rollbacks < metricsByTier.A.rollbacks ||
          metricsByTier[tier].elapsedMs < metricsByTier.A.elapsedMs)),
  );
  const report = {
    version: "1.0",
    reviewerId: response.reviewerId,
    hardInvariantsPassed: true,
    readability,
    primaryNonRegression,
    endToEndEfficiencyComparable,
    efficiencyOrReadabilityImprovement,
    passed: primaryNonRegression && efficiencyOrReadabilityImprovement,
  };
  const reportText = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(resolve(root, "quality-gate-report.json"), reportText);
  manifest.status = report.passed
    ? "quality-gate-passed"
    : "quality-gate-failed";
  manifest.qualityGateReportSha256 = sha256(reportText);
  await writeFile(
    resolve(root, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return report;
}

async function selfTest() {
  const root = await mkdtemp(resolve(tmpdir(), "icm-phase9-external-eval-"));
  try {
    const taskPath = resolve(root, "task.md");
    await writeFile(
      taskPath,
      "Improve schematic readability without changing topology.\n",
    );
    await prepare({
      projectPath: "fixtures/projects/phase-5-dense-analog/project.icproj.json",
      taskPath,
      out: root,
      targeted: [
        "docs/agent/knowledge/patterns/differential-pair.md",
        "docs/agent/knowledge/human-collaboration.md",
      ],
    });
    let incompleteRejected = false;
    try {
      await finalize(root);
    } catch (error) {
      incompleteRejected = /ENOENT|final\.icproj\.json/u.test(String(error));
    }
    if (!incompleteRejected)
      throw new Error(
        "External evaluation self-test accepted incomplete tiers",
      );
    const initial = parseProject(
      await readFile(resolve(root, "input/project.icproj.json"), "utf8"),
    );
    const top = initial.documents.find(
      (item) => item.id === initial.topDocumentId,
    );
    top.revision += 1;
    const finalProject = serializeProject(CircuitProjectSchema.parse(initial));
    const finalParsedProject = parseProject(finalProject);
    const finalResolver = createProjectSymbolResolver(
      finalParsedProject,
      builtInSymbols,
    );
    const finalSnapshots = finalParsedProject.documents.map((document) =>
      buildAgentSessionSnapshot({
        project: finalParsedProject,
        document,
        resolver: finalResolver,
      }),
    );
    const initialRevisions = JSON.parse(
      await readFile(resolve(root, "manifest.json"), "utf8"),
    ).input.initialRevisions;
    const finalRevisions = Object.fromEntries(
      finalParsedProject.documents.map((document) => [
        document.id,
        document.revision,
      ]),
    );
    const finalSnapshotHashes = Object.fromEntries(
      finalSnapshots.map((snapshot) => [
        snapshot.document.id,
        snapshot.electricalTopologyHash,
      ]),
    );
    const svg = await readFile(
      "fixtures/exports/phase-7-dense-analog/schematic.svg",
      "utf8",
    );
    const finalDiagnostics = finalSnapshots.flatMap((snapshot) =>
      snapshot.document.diagnostics.map((diagnostic) => ({
        documentId: snapshot.document.id,
        ...diagnostic,
      })),
    );
    for (const [index, tier] of TIERS.entries()) {
      const resultRoot = resolve(root, "tiers", tier, "result");
      await writeFile(resolve(resultRoot, "final.icproj.json"), finalProject);
      await writeFile(
        resolve(resultRoot, "final.snapshots.json"),
        `${JSON.stringify(finalSnapshots, null, 2)}\n`,
      );
      await mkdir(resolve(resultRoot, "renders"), { recursive: true });
      const renderManifest = [];
      for (const document of finalParsedProject.documents) {
        const filename = `renders/${document.id}.svg`;
        await writeFile(resolve(resultRoot, filename), svg);
        renderManifest.push({
          documentId: document.id,
          name: document.name,
          file: filename,
          sha256: sha256(svg),
          byteLength: Buffer.byteLength(svg),
        });
      }
      await writeFile(
        resolve(resultRoot, "renders.json"),
        `${JSON.stringify(renderManifest, null, 2)}\n`,
      );
      await writeFile(
        resolve(resultRoot, "final.svg"),
        `<svg xmlns="http://www.w3.org/2000/svg" data-layer="formal">${finalParsedProject.documents.map((document) => `<g data-document-id="${document.id}">${svg}</g>`).join("")}</svg>`,
      );
      await writeFile(
        resolve(resultRoot, "trace.json"),
        `${JSON.stringify(
          {
            apiVersion: "2.0",
            operations: [
              "capabilities",
              "snapshot",
              "transact",
              "render",
              "snapshot",
            ],
            initialRevisions,
            finalRevisions,
            finalSnapshotHashes,
            finalRefresh: true,
            queryCalls: 0,
            optionalHelpersEnabled: false,
            lockViolations: 0,
            validationErrors: 0,
            silentRejectedEdits: 0,
            finalDiagnostics,
          },
          null,
          2,
        )}\n`,
      );
      await writeFile(
        resolve(resultRoot, "metrics.json"),
        `${JSON.stringify(
          {
            provider: "self-test",
            model: "fixture",
            modelVersion: "1",
            settings: {},
            measurementScope: "end-to-end",
            elapsedMs: 100 - index,
            inputTokens: 1000 + index,
            outputTokens: 100,
            contextTokens: 1000 + index,
            snapshotRefreshes: 2,
            transactions: 2,
            dryRuns: 2,
            rejectedEdits: 0,
            rollbacks: 0,
            renders: finalParsedProject.documents.length,
          },
          null,
          2,
        )}\n`,
      );
    }
    const finalized = await finalize(root);
    const response = {
      version: "1.0",
      reviewerId: "self-test-reviewer",
      candidates: finalized.candidates.map((candidate) => ({
        ...candidate,
        scores: Object.fromEntries(SCORE_CATEGORIES.map((key) => [key, 5])),
        comments: "self-test only",
      })),
    };
    const responsePath = resolve(root, "blind/review-response.json");
    await writeFile(responsePath, `${JSON.stringify(response, null, 2)}\n`);
    const report = await score(root, responsePath);
    if (!report.passed)
      throw new Error("External evaluation self-test did not pass");

    const tampered = parseProject(finalProject);
    const document = tampered.documents.find(
      (item) => item.id === tampered.topDocumentId,
    );
    const instance = document.instances.find((item) => item.id === "M1");
    instance.properties["spice.param.w"] = "tampered";
    const tamperedProject = serializeProject(
      CircuitProjectSchema.parse(tampered),
    );
    await writeFile(
      resolve(root, "tiers/A/result/final.icproj.json"),
      tamperedProject,
    );
    let rejected = false;
    try {
      await validateTier(
        root,
        "A",
        parseProject(
          await readFile(resolve(root, "input/project.icproj.json"), "utf8"),
        ),
        JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8")),
      );
    } catch (error) {
      rejected = String(error).includes("electrical signature");
    }
    if (!rejected)
      throw new Error("Self-test accepted an electrically changed result");
  } finally {
    const resolvedRoot = resolve(root);
    if (!resolvedRoot.startsWith(resolve(tmpdir())))
      throw new Error("Refusing to clean a non-temporary self-test directory");
    await rm(resolvedRoot, { recursive: true, force: true });
  }
  process.stdout.write(
    "Phase 9 external quality evaluation pipeline self-test passed.\n",
  );
}

const command = process.argv[2];
if (command === "prepare") {
  const projectPath = argument("project");
  const taskPath = argument("task");
  const out = argument("out");
  const targeted = (argument("targeted") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!projectPath || !taskPath || !out || targeted.length === 0)
    throw new Error(
      "prepare requires --project, --task, --out, and comma-separated --targeted paths",
    );
  const manifest = await prepare({ projectPath, taskPath, out, targeted });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} else if (command === "finalize") {
  const root = argument("root");
  if (!root) throw new Error("finalize requires --root");
  const result = await finalize(root);
  process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`);
} else if (command === "score") {
  const root = argument("root");
  const response = argument("response");
  if (!root || !response)
    throw new Error("score requires --root and --response");
  process.stdout.write(
    `${JSON.stringify(await score(root, response), null, 2)}\n`,
  );
} else if (command === "self-test") {
  await selfTest();
} else {
  throw new Error("Use prepare, finalize, score, or self-test");
}
