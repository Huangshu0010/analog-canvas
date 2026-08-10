import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { startLocalHost } from "../output/release/interactive-circuit-maker-v0.1.0/host/index.js";

const releaseRoot = resolve("output/release/interactive-circuit-maker-v0.1.0");
const metadata = JSON.parse(
  await readFile(resolve(releaseRoot, "release.json"), "utf8"),
);
if (metadata.version !== "0.1.0")
  throw new Error("Release metadata version mismatch");
const running = await startLocalHost({
  editorRoot: resolve(releaseRoot, "editor"),
});
try {
  const [health, manifest, serviceWorker, index] = await Promise.all([
    fetch(`${running.origin}/healthz`),
    fetch(`${running.origin}/manifest.webmanifest`),
    fetch(`${running.origin}/sw.js`),
    fetch(running.origin),
  ]);
  if (!health.ok || (await health.json()).version !== "0.1.0")
    throw new Error("Release health check failed");
  const manifestData = await manifest.json();
  if (manifestData.icons.length < 2 || manifestData.display !== "standalone")
    throw new Error("PWA manifest is incomplete");
  const serviceWorkerSource = await serviceWorker.text();
  if (
    !serviceWorker.ok ||
    serviceWorker.headers.get("content-type") !==
      "text/javascript; charset=utf-8" ||
    serviceWorker.headers.get("cache-control") !== "no-cache" ||
    !serviceWorkerSource.includes('self.addEventListener("install"') ||
    !serviceWorkerSource.includes("caches.open(")
  )
    throw new Error("Service worker shell contract is incomplete");
  if (!index.ok || !(await index.text()).includes("Interactive Circuit Maker"))
    throw new Error("Editor shell is missing");
  process.stdout.write(`Release smoke passed at ${running.origin}.\n`);
} finally {
  await running.close();
}
