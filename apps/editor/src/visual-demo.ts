import { CircuitProjectSchema } from "@icm/model";
import type { CircuitProject } from "@icm/model";

import denseAnalogProject from "../../../fixtures/projects/phase-5-dense-analog/project.icproj.json";

export function createVisualDemoProject(): CircuitProject {
  return CircuitProjectSchema.parse(structuredClone(denseAnalogProject));
}
