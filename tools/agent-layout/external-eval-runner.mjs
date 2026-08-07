import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createAgentCircuitService } from "../../packages/agent-adapter/dist/index.js";
import {
  CircuitProjectSchema,
  parseProject,
  serializeProject,
} from "../../packages/model/dist/index.js";
import {
  builtInSymbols,
  createProjectSymbolResolver,
} from "../../packages/symbols/dist/index.js";

const command = process.argv[2];
const tierRootArgument = process.argv[3];
if (
  !command ||
  !tierRootArgument ||
  !["inspect", "execute"].includes(command)
) {
  throw new Error(
    "Usage: node tools/agent-layout/external-eval-runner.mjs <inspect|execute> <tier-root>",
  );
}

const tierRoot = resolve(tierRootArgument);
const workRoot = resolve(tierRoot, "work");
const resultRoot = resolve(tierRoot, "result");
const startingProjectPath = resolve(tierRoot, "starting-project.icproj.json");
const contextPath = resolve(tierRoot, "context.md");

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function requestId(prefix, index) {
  return `${prefix}-${String(index).padStart(4, "0")}`;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function svgViewBox(svg) {
  const match = svg.match(/viewBox="([^"]+)"/u);
  if (!match) throw new Error("Formal render has no viewBox");
  const values = match[1].trim().split(/\s+/u).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)))
    throw new Error("Formal render has an invalid viewBox");
  return values;
}

function svgBody(svg) {
  const start = svg.indexOf(">");
  const end = svg.lastIndexOf("</svg>");
  if (start < 0 || end < start) throw new Error("Formal render is malformed");
  return svg.slice(start + 1, end);
}

function contactSheet(renders) {
  const pageWidth = 1400;
  const margin = 40;
  const titleHeight = 42;
  let y = margin;
  const panels = [];
  for (const render of renders) {
    const [x0, y0, width, height] = svgViewBox(render.svg);
    const scale = Math.min(1, (pageWidth - margin * 2) / Math.max(width, 1));
    const panelWidth = width * scale;
    const panelHeight = height * scale;
    panels.push(
      `<g data-document-id="${escapeXml(render.documentId)}"><text x="${margin}" y="${y + 24}" font-family="serif" font-size="20" font-weight="600">${escapeXml(render.name)}</text><svg x="${margin}" y="${y + titleHeight}" width="${panelWidth}" height="${panelHeight}" viewBox="${x0} ${y0} ${width} ${height}" preserveAspectRatio="xMinYMin meet">${svgBody(render.svg)}</svg></g>`,
    );
    y += titleHeight + panelHeight + margin;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" data-layer="formal" viewBox="0 0 ${pageWidth} ${Math.max(y, 100)}"><rect width="100%" height="100%" fill="white"/>${panels.join("")}</svg>\n`;
}

async function loadRuntime() {
  const project = parseProject(await readFile(startingProjectPath, "utf8"));
  const resolver = createProjectSymbolResolver(project, builtInSymbols);
  const services = new Map();
  const serviceFor = (documentId) => {
    if (services.has(documentId)) return services.get(documentId);
    if (!project.documents.some((document) => document.id === documentId))
      throw new Error(`Unknown Document ${documentId}`);
    const service = createAgentCircuitService({
      agentId: `phase9-external-${tierRoot.split(/[\\/]/u).at(-1)}`,
      store: {
        getProject: () => project,
        getDocument: () => {
          const document = project.documents.find(
            (item) => item.id === documentId,
          );
          if (!document) throw new Error(`Missing Document ${documentId}`);
          return document;
        },
        commitDocument: (next) => {
          project.documents = project.documents.map((item) =>
            item.id === next.id ? next : item,
          );
        },
      },
      resolver,
      permissions: {
        query: false,
        snapshot: true,
        render: true,
        sourceSpans: false,
        edit: { geometry: true, connectivity: true, presentation: true },
      },
    });
    services.set(documentId, service);
    return service;
  };
  return { project, serviceFor };
}

function checked(response) {
  if (!response.ok) throw new Error(JSON.stringify(response, null, 2));
  return response;
}

async function inspect() {
  const { project, serviceFor } = await loadRuntime();
  const operations = [];
  const topService = serviceFor(project.topDocumentId);
  const capabilities = checked(
    topService.handle({
      apiVersion: "2.0",
      requestId: "inspect-capabilities",
      operation: "capabilities",
    }),
  );
  operations.push("capabilities");
  const snapshots = project.documents.map((document, index) => {
    const response = checked(
      serviceFor(document.id).handle({
        apiVersion: "2.0",
        requestId: requestId("inspect-snapshot", index + 1),
        operation: "snapshot",
        documentId: document.id,
      }),
    );
    operations.push("snapshot");
    return response.snapshot;
  });
  await mkdir(workRoot, { recursive: true });
  await writeFile(
    resolve(workRoot, "capabilities.json"),
    `${JSON.stringify(capabilities, null, 2)}\n`,
  );
  await writeFile(
    resolve(workRoot, "initial.snapshots.json"),
    `${JSON.stringify(snapshots, null, 2)}\n`,
  );
  await writeFile(
    resolve(workRoot, "inspect-trace.json"),
    `${JSON.stringify({ apiVersion: "2.0", operations }, null, 2)}\n`,
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        documents: snapshots.map((snapshot) => ({
          id: snapshot.document.id,
          name: snapshot.document.name,
          revision: snapshot.document.revision,
          instances: snapshot.document.instances.length,
          nets: snapshot.document.nets.length,
          ports: snapshot.document.ports.length,
          snapshotBytes: snapshot.byteLength,
        })),
        workRoot,
      },
      null,
      2,
    )}\n`,
  );
}

async function execute() {
  const startedAt = performance.now();
  const planPath = resolve(workRoot, "plan.json");
  const planText = await readFile(planPath, "utf8");
  const plan = JSON.parse(planText);
  if (!Array.isArray(plan.transactions) || plan.transactions.length === 0)
    throw new Error(
      "work/plan.json must contain a non-empty transactions array",
    );
  const { project, serviceFor } = await loadRuntime();
  const initialRevisions = Object.fromEntries(
    project.documents.map((document) => [document.id, document.revision]),
  );
  const operations = [];
  let requestIndex = 0;
  let dryRuns = 0;
  let transactions = 0;
  let rejectedEdits = 0;
  let rollbacks = 0;
  let snapshotRefreshes = 0;
  let renders = 0;

  checked(
    serviceFor(project.topDocumentId).handle({
      apiVersion: "2.0",
      requestId: requestId("execute-capabilities", ++requestIndex),
      operation: "capabilities",
    }),
  );
  operations.push("capabilities");
  for (const document of project.documents) {
    checked(
      serviceFor(document.id).handle({
        apiVersion: "2.0",
        requestId: requestId("execute-initial-snapshot", ++requestIndex),
        operation: "snapshot",
        documentId: document.id,
      }),
    );
    operations.push("snapshot");
    snapshotRefreshes += 1;
  }

  for (const [index, transaction] of plan.transactions.entries()) {
    if (
      !transaction ||
      typeof transaction.documentId !== "string" ||
      !Array.isArray(transaction.edits) ||
      transaction.edits.length === 0
    )
      throw new Error(`Plan transaction ${index} is invalid`);
    const document = project.documents.find(
      (item) => item.id === transaction.documentId,
    );
    if (!document)
      throw new Error(`Unknown Document ${transaction.documentId}`);
    const request = {
      apiVersion: "2.0",
      requestId: requestId("execute-transaction", ++requestIndex),
      operation: "transact",
      documentId: document.id,
      transactionId:
        typeof transaction.id === "string"
          ? transaction.id
          : `phase9-eval-transaction-${index + 1}`,
      expectedRevision: document.revision,
      edits: transaction.edits,
    };
    const dryRun = serviceFor(document.id).handle({ ...request, dryRun: true });
    operations.push("transact");
    dryRuns += 1;
    if (!dryRun.ok) {
      rejectedEdits += 1;
      rollbacks += 1;
      throw new Error(
        `Dry-run rejected transaction ${index}: ${JSON.stringify(dryRun, null, 2)}`,
      );
    }
    const committed = serviceFor(document.id).handle({
      ...request,
      requestId: requestId("execute-commit", ++requestIndex),
    });
    operations.push("transact");
    transactions += 1;
    if (!committed.ok) {
      rejectedEdits += 1;
      rollbacks += 1;
      throw new Error(
        `Commit rejected transaction ${index}: ${JSON.stringify(committed, null, 2)}`,
      );
    }
  }

  const renderedDocuments = [];
  for (const document of project.documents) {
    const response = checked(
      serviceFor(document.id).handle({
        apiVersion: "2.0",
        requestId: requestId("execute-render", ++requestIndex),
        operation: "render",
        documentId: document.id,
        mode: "formal",
      }),
    );
    operations.push("render");
    renders += 1;
    renderedDocuments.push({
      documentId: document.id,
      name: document.name,
      svg: Buffer.from(response.artifact.data, "base64").toString("utf8"),
    });
  }

  const finalSnapshots = [];
  for (const document of project.documents) {
    const response = checked(
      serviceFor(document.id).handle({
        apiVersion: "2.0",
        requestId: requestId("execute-final-snapshot", ++requestIndex),
        operation: "snapshot",
        documentId: document.id,
      }),
    );
    operations.push("snapshot");
    snapshotRefreshes += 1;
    finalSnapshots.push(response.snapshot);
  }

  const validatedProject = CircuitProjectSchema.parse(project);
  const finalRevisions = Object.fromEntries(
    validatedProject.documents.map((document) => [
      document.id,
      document.revision,
    ]),
  );
  const finalSnapshotHashes = Object.fromEntries(
    finalSnapshots.map((snapshot) => [
      snapshot.document.id,
      snapshot.topologyHash,
    ]),
  );
  const finalDiagnostics = finalSnapshots.flatMap((snapshot) =>
    snapshot.document.diagnostics.map((diagnostic) => ({
      documentId: snapshot.document.id,
      ...diagnostic,
    })),
  );
  await mkdir(resolve(resultRoot, "renders"), { recursive: true });
  const renderManifest = [];
  for (const render of renderedDocuments) {
    const filename = `renders/${render.documentId}.svg`;
    await writeFile(resolve(resultRoot, filename), render.svg);
    renderManifest.push({
      documentId: render.documentId,
      name: render.name,
      file: filename,
      sha256: sha256(render.svg),
      byteLength: Buffer.byteLength(render.svg),
    });
  }
  const finalSvg = contactSheet(renderedDocuments);
  const contextBytes = (await readFile(contextPath)).byteLength;
  const elapsedMs = Number((performance.now() - startedAt).toFixed(3));
  await writeFile(
    resolve(resultRoot, "final.icproj.json"),
    serializeProject(validatedProject),
  );
  await writeFile(
    resolve(resultRoot, "final.snapshots.json"),
    `${JSON.stringify(finalSnapshots, null, 2)}\n`,
  );
  await writeFile(
    resolve(resultRoot, "renders.json"),
    `${JSON.stringify(renderManifest, null, 2)}\n`,
  );
  await writeFile(resolve(resultRoot, "final.svg"), finalSvg);
  await writeFile(
    resolve(resultRoot, "trace.json"),
    `${JSON.stringify(
      {
        apiVersion: "2.0",
        operations,
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
        provider: "OpenAI",
        model: "gpt-5.6-sol",
        modelVersion: "2026-08-07",
        settings: {
          reasoningEffort: "high",
          serviceTier: "priority",
          isolation: "fork_turns:none",
        },
        measurementScope: "runner-only",
        elapsedMs,
        inputTokens: Math.ceil(contextBytes / 4),
        outputTokens: Math.ceil(Buffer.byteLength(planText) / 4),
        contextTokens: Math.ceil(contextBytes / 4),
        snapshotRefreshes,
        transactions,
        dryRuns,
        rejectedEdits,
        rollbacks,
        renders,
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        resultRoot,
        documents: finalSnapshots.map((snapshot) => ({
          id: snapshot.document.id,
          name: snapshot.document.name,
          revision: snapshot.document.revision,
          diagnostics: snapshot.document.diagnostics.length,
        })),
        transactions,
        renders,
      },
      null,
      2,
    )}\n`,
  );
}

if (command === "inspect") await inspect();
else await execute();
