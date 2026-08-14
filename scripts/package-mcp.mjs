import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");
const version = "0.1.0";
const packageName = `analog-canvas-mcp-v${version}`;
const outputRoot = resolve(root, "output/mcp");
const output = resolve(outputRoot, packageName);
const binDirectory = resolve(output, "bin");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(binDirectory, { recursive: true });
await build({
  root,
  configFile: false,
  logLevel: "warn",
  build: {
    ssr: resolve(root, "apps/mcp-server/src/main.ts"),
    outDir: binDirectory,
    emptyOutDir: true,
    target: "node24",
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: "analog-canvas-mcp.mjs",
      },
    },
  },
  ssr: { noExternal: true },
});

const executable = resolve(binDirectory, "analog-canvas-mcp.mjs");
const source = await readFile(executable, "utf8");
await writeFile(
  executable,
  source.startsWith("#!") ? source : `#!/usr/bin/env node\n${source}`,
);
await chmod(executable, 0o755).catch(() => undefined);

await writeFile(
  resolve(output, "package.json"),
  `${JSON.stringify(
    {
      name: "@analog-canvas/mcp-server",
      version,
      description: "Local MCP adapter for the Analog Canvas browser editor",
      type: "module",
      bin: { "analog-canvas-mcp": "bin/analog-canvas-mcp.mjs" },
      files: ["bin", "README.md"],
      engines: { node: ">=24.0.0" },
      license: "UNLICENSED",
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  resolve(output, "README.md"),
  `# Analog Canvas MCP\n\nLocal stdio MCP adapter for Analog Canvas. It keeps the revocable connector in the user's profile and never exposes the short-lived bearer to the model.\n\nRun with \`npx --yes @analog-canvas/mcp-server\` after publishing, or configure your MCP host to execute \`node bin/analog-canvas-mcp.mjs\` from this package. Set \`ANALOG_CANVAS_API_URL\` only for a non-production deployment.\n`,
);

const packCommand =
  process.platform === "win32"
    ? {
        file: process.env.ComSpec ?? "cmd.exe",
        args: ["/d", "/s", "/c", "npm pack . --pack-destination .."],
      }
    : { file: "npm", args: ["pack", ".", "--pack-destination", ".."] };
execFileSync(packCommand.file, packCommand.args, {
  cwd: output,
  stdio: "inherit",
});
process.stdout.write(`${output}\n`);
