import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "output/release/interactive-circuit-maker-v0.1.0");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "apps/editor/dist"), resolve(output, "editor"), {
  recursive: true,
});
await cp(resolve(root, "apps/local-host/dist"), resolve(output, "host"), {
  recursive: true,
});
await writeFile(
  resolve(output, "start.mjs"),
  `import { resolve } from "node:path";\nimport { startLocalHost } from "./host/index.js";\nconst running = await startLocalHost({ editorRoot: resolve(import.meta.dirname, "editor"), port: 4173 });\nprocess.stdout.write(\`Interactive Circuit Maker v0.1.0: \${running.origin}\\n\`);\n`,
);
const manifest = JSON.parse(
  await readFile(
    resolve(root, "apps/editor/public/manifest.webmanifest"),
    "utf8",
  ),
);
await writeFile(
  resolve(output, "release.json"),
  `${JSON.stringify({ name: "interactive-circuit-maker", version: "0.1.0", node: ">=24.0.0", pwa: manifest.name }, null, 2)}\n`,
);
process.stdout.write(`${output}\n`);
