import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function trackedProjectPaths() {
  return execFileSync(
    "git",
    ["ls-files", "--", "fixtures/projects", "netlists", "apps/editor/src/examples"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((path) => path.endsWith(".icproj.json"))
    .sort();
}

const records = [];
for (const path of trackedProjectPaths()) {
  const project = JSON.parse(readFileSync(path, "utf8"));
  for (const document of project.documents ?? []) {
    for (const instance of document.instances ?? []) {
      const properties = instance.properties ?? {};
      const keys = Object.keys(properties).sort();
      if (keys.length === 0) continue;
      records.push({
        path,
        documentId: document.id,
        instanceId: instance.id,
        properties: Object.fromEntries(keys.map((key) => [key, properties[key]])),
      });
    }
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      auditedProjectCount: trackedProjectPaths().length,
      nonEmptyInstanceProperties: records,
    },
    null,
    2,
  )}\n`,
);
