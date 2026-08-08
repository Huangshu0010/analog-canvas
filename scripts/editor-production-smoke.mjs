// Production smoke: serve the already-built editor through Vite's real
// preview server and inspect it in Chromium. --check is intentionally
// read-only; normal mode refreshes the committed report.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const workspace = process.cwd();
const editorRoot = resolve(workspace, "apps/editor");
const editorDist = resolve(editorRoot, "dist");
const reportPath = resolve(
  workspace,
  "fixtures/editor-production-smoke/report.json",
);
const check = process.argv.includes("--check");

async function builtJavaScriptContains(needle) {
  const entries = await readdir(editorDist, { recursive: true });
  const scripts = entries.filter((entry) => entry.endsWith(".js"));
  const contents = await Promise.all(
    scripts.map((entry) => readFile(resolve(editorDist, entry), "utf8")),
  );
  return contents.some((content) => content.includes(needle));
}

async function main() {
  const expected = check
    ? JSON.parse(await readFile(reportPath, "utf8"))
    : null;
  const { preview } = await import("vite");
  let server;
  let browser;
  const consoleErrors = [];
  let mounted = false;
  try {
    server = await preview({
      root: editorRoot,
      logLevel: "silent",
      preview: { host: "127.0.0.1", port: 4174, strictPort: true },
    });
    const url = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:4174/";
    browser = await chromium.launch({
      channel: process.env.CI ? undefined : "chrome",
    });
    const page = await browser.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="schematic-canvas"]', {
      timeout: 10_000,
    });
    mounted = true;
  } finally {
    await browser?.close();
    await server?.close();
  }

  const nodeCryptoExternalized = await builtJavaScriptContains(
    "node:crypto has been externalized",
  );
  const report = { mounted, consoleErrors, nodeCryptoExternalized };

  if (check) {
    if (JSON.stringify(expected) !== JSON.stringify(report)) {
      throw new Error(
        `Production smoke report is stale:\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(report)}`,
      );
    }
  } else {
    await mkdir(resolve(workspace, "fixtures/editor-production-smoke"), {
      recursive: true,
    });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (!report.mounted) throw new Error("Production editor did not mount");
  if (report.consoleErrors.length > 0) {
    throw new Error(
      `Production smoke console errors:\n${report.consoleErrors.join("\n")}`,
    );
  }
  if (report.nodeCryptoExternalized) {
    throw new Error("node:crypto was externalized in the production build");
  }
  console.log("Editor production preview smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
