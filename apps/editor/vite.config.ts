import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function pageBasePath(value = process.env.ICM_PAGE_BASE_PATH): string {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

function versionStaticServiceWorker() {
  return {
    name: "version-static-service-worker",
    apply: "build" as const,
    async closeBundle() {
      const indexPath = new URL("./dist/index.html", import.meta.url);
      const workerPath = new URL("./dist/sw.js", import.meta.url);
      const index = await readFile(indexPath);
      const buildId = createHash("sha256")
        .update(index)
        .digest("hex")
        .slice(0, 12);
      const worker = await readFile(workerPath, "utf8");
      if (!worker.includes("__ICM_BUILD_ID__")) {
        throw new Error("Static service worker cache placeholder is missing");
      }
      await writeFile(workerPath, worker.replace("__ICM_BUILD_ID__", buildId));
    },
  };
}

export default defineConfig({
  // A repository Pages deployment sets ICM_PAGE_BASE_PATH=<repository-name>.
  // Root-domain and local deployments intentionally retain the default `/`.
  base: pageBasePath(),
  plugins: [react(), versionStaticServiceWorker()],
});
