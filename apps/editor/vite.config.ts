import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function pageBasePath(value = process.env.ICM_PAGE_BASE_PATH): string {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig({
  // A repository Pages deployment sets ICM_PAGE_BASE_PATH=<repository-name>.
  // Root-domain and local deployments intentionally retain the default `/`.
  base: pageBasePath(),
  plugins: [react()],
});
