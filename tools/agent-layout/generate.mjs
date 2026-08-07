import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createAgentCircuitService } from "../../packages/agent-adapter/dist/index.js";
import { createFormalExportSource } from "../../packages/exporters/dist/index.js";
import { exportFormalArtifacts } from "../../packages/exporters/dist/node.js";
import {
  serializeProject,
  validateProject,
} from "../../packages/model/dist/index.js";
import { importSpiceSources } from "../../packages/spice/dist/index.js";
import {
  builtInSymbols,
  createProjectSymbolResolver,
} from "../../packages/symbols/dist/index.js";

const recipePath = process.argv[2];
if (!recipePath) {
  throw new Error("Usage: node tools/agent-layout/generate.mjs <recipe.mjs>");
}

const recipe = (await import(pathToFileURL(resolve(recipePath)).href)).default;
const sourceRoot = resolve(recipe.sourceRoot);
const sourceFiles = await Promise.all(
  (recipe.sourceFiles ?? [recipe.entry]).map(async (path) => ({
    path,
    bytes: await readFile(resolve(sourceRoot, path)),
  })),
);
const imported = await importSpiceSources(sourceFiles, recipe.entry);
if (!imported.successful || !imported.project) {
  throw new Error(
    imported.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
  );
}

const project = imported.project;
project.name = recipe.projectName ?? project.name;
if (recipe.prepareProject) {
  await recipe.prepareProject({ project });
}
let document = recipe.documentName
  ? project.documents.find(
      (candidate) => candidate.name === recipe.documentName,
    )
  : project.documents.find(
      (candidate) => candidate.id === project.topDocumentId,
    );
if (!document) throw new Error("Recipe target Document is missing");
project.topDocumentId = document.id;
document.name = recipe.outputDocumentName ?? document.name;

const resolver = createProjectSymbolResolver(project, builtInSymbols);
const helpersFor = (targetDocument) => {
  const net = (name) => {
    const candidate = targetDocument.nets.find((item) => item.name === name);
    if (!candidate) throw new Error(`Missing Net ${name}`);
    return candidate;
  };
  const portObject = (name) => {
    const candidate = targetDocument.ports.find((item) => item.name === name);
    if (!candidate) throw new Error(`Missing port ${name}`);
    return candidate;
  };
  return {
    net,
    netId: (name) => net(name).id,
    portId: (name) => portObject(name).id,
    terminal: (instanceId, pinName) => ({
      kind: "terminal",
      instanceId,
      pinName,
    }),
    junction: (junctionId) => ({ kind: "junction", junctionId }),
    port: (name) => ({ kind: "port", portId: portObject(name).id }),
  };
};
const helpers = helpersFor(document);

if (recipe.prepareModel) {
  recipe.prepareModel({ project, document, ...helpers });
}
validateProject(project);

let transactionCount = 0;
const layoutTargets = [
  {
    document,
    buildEditPhases: recipe.buildEditPhases,
    outputBase: recipe.outputBase,
  },
  ...(recipe.additionalDocuments ?? []).map((target) => {
    const targetDocument = project.documents.find(
      (candidate) => candidate.name === target.documentName,
    );
    if (!targetDocument) {
      throw new Error(
        `Recipe target Document ${target.documentName} is missing`,
      );
    }
    if (target.outputDocumentName) {
      targetDocument.name = target.outputDocumentName;
    }
    return {
      document: targetDocument,
      buildEditPhases: target.buildEditPhases,
      outputBase: target.outputBase,
    };
  }),
];

for (const target of layoutTargets) {
  let targetDocument = target.document;
  const store = {
    getDocument: () => targetDocument,
    commitDocument: (next) => {
      targetDocument = next;
    },
  };
  const service = createAgentCircuitService({
    agentId: recipe.agentId ?? "layout-recipe-agent",
    store,
    resolver,
    permissions: {
      query: true,
      render: true,
      sourceSpans: true,
      edit: { geometry: true, connectivity: true, presentation: true },
    },
  });
  const phases = target.buildEditPhases({
    project,
    document: targetDocument,
    resolver,
    ...helpersFor(targetDocument),
  });
  for (const phase of phases) {
    for (
      let offset = 0;
      offset < phase.edits.length;
      offset += service.limits.maxTransactionEdits
    ) {
      const edits = phase.edits.slice(
        offset,
        offset + service.limits.maxTransactionEdits,
      );
      transactionCount += 1;
      const request = {
        apiVersion: "1.0",
        requestId: `${recipe.id}-${transactionCount}`,
        operation: "transact",
        documentId: targetDocument.id,
        transactionId: `${recipe.id}-${phase.id}-${transactionCount}`,
        expectedRevision: targetDocument.revision,
        edits,
      };
      const dryRun = service.handle({ ...request, dryRun: true });
      if (!dryRun.ok) throw new Error(JSON.stringify(dryRun, null, 2));
      const committed = service.handle(request);
      if (!committed.ok) throw new Error(JSON.stringify(committed, null, 2));
    }
  }
  project.documents = project.documents.map((candidate) =>
    candidate.id === targetDocument.id ? targetDocument : candidate,
  );
  if (target.document.id === document.id) document = targetDocument;
}

const validated = validateProject(project);
const outputRoot = resolve(recipe.outputRoot ?? sourceRoot);
const outputBase = recipe.outputBase;
await mkdir(dirname(resolve(outputRoot, outputBase)), { recursive: true });
await writeFile(
  resolve(outputRoot, `${outputBase}.icproj.json`),
  serializeProject(validated),
  "utf8",
);
const exported = [];
for (const target of layoutTargets.filter((item) => item.outputBase)) {
  const exportedDocument = validated.documents.find(
    (candidate) => candidate.id === target.document.id,
  );
  if (!exportedDocument) throw new Error("Export target Document is missing");
  const exportSource = createFormalExportSource(exportedDocument, resolver, {
    title: validated.name,
    margin: recipe.exportMargin ?? 30,
  });
  const artifacts = await exportFormalArtifacts(
    exportSource,
    recipe.exportScale ?? 3,
  );
  await writeFile(
    resolve(outputRoot, `${target.outputBase}.svg`),
    artifacts.svg,
  );
  await writeFile(
    resolve(outputRoot, `${target.outputBase}.png`),
    artifacts.png.bytes,
  );
  await writeFile(
    resolve(outputRoot, `${target.outputBase}.pdf`),
    artifacts.pdf,
  );
  exported.push({
    document: exportedDocument.name,
    outputBase: resolve(outputRoot, target.outputBase),
    bounds: exportSource.bounds,
  });
}

process.stdout.write(
  `${JSON.stringify(
    {
      recipe: recipe.id,
      revision: document.revision,
      transactions: transactionCount,
      documents: project.documents.map((item) => ({
        name: item.name,
        revision: item.revision,
        instances: item.instances.length,
        routes: item.routes.length,
        junctions: item.junctions.length,
        annotations: item.annotations.length,
        unplaced: item.instances.filter(
          (instance) => instance.placement === null,
        ).length,
      })),
      instances: document.instances.length,
      nets: document.nets.length,
      routes: document.routes.length,
      junctions: document.junctions.length,
      annotations: document.annotations.length,
      unplaced: document.instances.filter((item) => item.placement === null)
        .length,
      remainingGenericInstances: project.documents
        .flatMap((item) => item.instances)
        .filter((instance) => instance.symbolId.startsWith("generic-block-"))
        .length,
      importWarnings: imported.diagnostics.filter(
        (diagnostic) => diagnostic.severity === "warning",
      ).length,
      exports: exported,
    },
    null,
    2,
  )}\n`,
);
