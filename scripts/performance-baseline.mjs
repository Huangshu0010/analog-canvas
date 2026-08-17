import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { createAgentCircuitService } from "../packages/agent-adapter/dist/index.js";
import {
  CircuitProjectSchema,
  createEmptyProject,
} from "../packages/model/dist/index.js";
import {
  saveProject,
  serializeProject,
} from "../packages/project-protocol/dist/index.js";
import { RootedProjectStorage } from "../packages/platform-node/dist/index.js";
import { renderDocumentSvg } from "../packages/render-svg/dist/index.js";
import { importSpiceSources } from "../packages/spice/dist/index.js";
import {
  InMemorySymbolResolver,
  builtInSymbols,
} from "../packages/symbols/dist/index.js";

const budgets = {
  generateProject: 2000,
  serialize: 1000,
  renderSvg: 2000,
  agentSnapshot: 1000,
  editTransaction: 1000,
  spiceImport: 2000,
  atomicSave: 1000,
};

async function measure(action) {
  const started = performance.now();
  const result = await action();
  return { result, milliseconds: performance.now() - started };
}

const generated = await measure(() => {
  const base = createEmptyProject("phase-7-large", "Phase 7 Large Project");
  return CircuitProjectSchema.parse({
    ...base,
    documents: [
      {
        ...base.documents[0],
        instances: Array.from({ length: 500 }, (_, index) => ({
          id: `R${index + 1}`,
          symbolId: "resistor",
          placement: {
            position: {
              x: 60 + (index % 25) * 80,
              y: 60 + Math.floor(index / 25) * 80,
            },
            rotation: index % 2 === 0 ? 0 : 90,
            mirror: "none",
          },
          properties: { value: `${index + 1}k` },
        })),
      },
    ],
  });
});
const project = generated.result;
let document = project.documents[0];
const resolver = new InMemorySymbolResolver(builtInSymbols);

const serialized = await measure(() => serializeProject(project));
const rendered = await measure(() =>
  renderDocumentSvg(document, resolver, { title: project.name }),
);
const service = createAgentCircuitService({
  agentId: "performance-agent",
  store: {
    getDocument: () => document,
    commitDocument: (next) => {
      document = next;
    },
  },
  resolver,
  permissions: {
    snapshot: true,
    render: true,
    sourceSpans: false,
    edit: { geometry: true, connectivity: false, presentation: false },
  },
});
const snapshot = await measure(() =>
  service.handle({
    apiVersion: "2.0",
    requestId: "performance-snapshot",
    operation: "snapshot",
    documentId: document.id,
  }),
);
const edit = await measure(() =>
  service.handle({
    apiVersion: "2.0",
    requestId: "performance-edit",
    operation: "transact",
    documentId: document.id,
    transactionId: "performance-edit-1",
    expectedRevision: document.revision,
    edits: [
      { kind: "move_instance", instanceId: "R1", position: { x: 80, y: 80 } },
    ],
  }),
);
const sourcePath = resolve("fixtures/spice-baseline/core.cir");
const modelPath = resolve("fixtures/spice-baseline/models.lib");
const imported = await measure(async () =>
  importSpiceSources(
    [
      { path: "core.cir", bytes: await readFile(sourcePath) },
      { path: "models.lib", bytes: await readFile(modelPath) },
    ],
    "core.cir",
  ),
);
const storageRoot = await mkdtemp(resolve(tmpdir(), "icm-performance-"));
const saved = await measure(() =>
  saveProject(
    new RootedProjectStorage(storageRoot),
    "large.icproj.json",
    project,
  ),
);

const measurements = {
  generateProject: generated.milliseconds,
  serialize: serialized.milliseconds,
  renderSvg: rendered.milliseconds,
  agentSnapshot: snapshot.milliseconds,
  editTransaction: edit.milliseconds,
  spiceImport: imported.milliseconds,
  atomicSave: saved.milliseconds,
};
const failures = Object.entries(measurements).filter(
  ([name, value]) => value > budgets[name],
);
const report = {
  version: "0.1.0",
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  fixture: {
    instances: 500,
    serializedBytes: Buffer.byteLength(serialized.result),
    svgBytes: Buffer.byteLength(rendered.result),
  },
  measurements: Object.fromEntries(
    Object.entries(measurements).map(([name, value]) => [
      name,
      Number(value.toFixed(3)),
    ]),
  ),
  budgets,
  passed: failures.length === 0,
};
await mkdir(resolve("output/performance"), { recursive: true });
await writeFile(
  resolve("output/performance/phase-7-baseline.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
