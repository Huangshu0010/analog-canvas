// Production smoke: build the editor, serve the dist with vite preview, open
// it in a real browser, and assert React mounts with zero console errors and
// no node:crypto externalization warning. This complements the dev-server E2E
// (playwright.config uses `vite`, not `vite preview`).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const editorDist = resolve(process.cwd(), "apps/editor/dist");
const reportPath = resolve(
  process.cwd(),
  "fixtures/editor-production-smoke/report.json",
);

async function main() {
  const { createServer: createViteServer } = await import("vite");
  const server = await createViteServer({
    root: editorDist,
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 4174, strictPort: true },
    preview: { host: "127.0.0.1", port: 4174, strictPort: true },
    appType: "spa",
  });
  await server.listen();
  const browser = await chromium.launch({
    channel: process.env.CI ? undefined : "chrome",
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("http://127.0.0.1:4174/");
  await page.waitForSelector('[data-testid="schematic-canvas"]', {
    timeout: 10_000,
  });
  const html = await page.content();
  const nodeCryptoExternalized = html.includes(
    "node:crypto has been externalized",
  );
  await browser.close();
  await server.close();

  const report = {
    mounted: true,
    consoleErrors,
    nodeCryptoExternalized,
  };
  await mkdir(resolve(process.cwd(), "fixtures/editor-production-smoke"), {
    recursive: true,
  });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const check = process.argv.includes("--check");
  if (check) {
    const expected = JSON.parse(await readFile(reportPath, "utf8"));
    if (JSON.stringify(expected) !== JSON.stringify(report)) {
      throw new Error("Production smoke report is stale");
    }
  }
  if (report.consoleErrors.length > 0) {
    throw new Error(
      `Production smoke console errors:\n${report.consoleErrors.join("\n")}`,
    );
  }
  if (report.nodeCryptoExternalized) {
    throw new Error("node:crypto has been externalized in the production build");
  }
  console.log("Editor production smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
