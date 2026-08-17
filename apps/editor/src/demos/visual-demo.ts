import { parseProject } from "@icm/project-protocol";
import type { CircuitProject } from "@icm/model";

import denseAnalogProject from "../../../../fixtures/projects/phase-5-dense-analog/project.icproj.json";

export function createVisualDemoProject(): CircuitProject {
  // The checked-in visual fixture intentionally remains a migration input.
  // Route it through the versioned parser instead of rejecting it against the
  // latest schema when the GUI command is clicked.
  return parseProject(JSON.stringify(denseAnalogProject));
}
