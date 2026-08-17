import type { CircuitProject } from "@icm/model";
import { parseProject } from "@icm/project-protocol";

import commonSourceAmplifier from "./common-source-amplifier.icproj.json";
import twoStageOpAmp from "./two-stage-op-amp.icproj.json";

export interface LibraryProjectExample {
  id: string;
  name: string;
  description: string;
  project: CircuitProject;
}

function bundledProject(source: unknown): CircuitProject {
  return parseProject(JSON.stringify(source));
}

/**
 * Curated, browser-bundled Projects shown in the left Library. Each asset is
 * parsed at module initialization so an invalid example fails during the
 * editor build rather than replacing a user's live Project at runtime.
 */
export const libraryProjectExamples: readonly LibraryProjectExample[] = [
  {
    id: "common-source-amplifier",
    name: "Common-Source Amplifier",
    description: "Small-signal NMOS gain stage",
    project: bundledProject(commonSourceAmplifier),
  },
  {
    id: "two-stage-op-amp",
    name: "Two-Stage Op Amp",
    description: "Miller-compensated amplifier",
    project: bundledProject(twoStageOpAmp),
  },
];

export function createLibraryExampleProject(
  exampleId: string,
): CircuitProject | null {
  const example = libraryProjectExamples.find(
    (candidate) => candidate.id === exampleId,
  );
  return example ? structuredClone(example.project) : null;
}
