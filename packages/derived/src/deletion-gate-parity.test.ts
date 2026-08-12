import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject, type CircuitProject } from "@icm/model";
import { builtInSymbols, createProjectSymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  buildProjectConnectivityIndex,
  deriveFlightlines,
  endpointKey,
  resolveRouteGeometry,
  routePolyline,
} from "./index.js";

// WP-R10 deletion-gate characterization. The roadmap (§10, §13) forbids
// deleting the old production read models (deriveFlightlines, routePolyline)
// until old/new parity is proven on real fixtures. These tests ARE that gate:
// they pin centerline + flightline content parity between the old helpers and
// the new unified read models. The actual production consumer switch + deletion
// remain gated on e2e (Playwright) and resolution of the pre-existing
// instance-label/golden failures on main.

function loadFixtureProject(name: string): CircuitProject {
  return parseProject(
    readFileSync(
      resolve(process.cwd(), `fixtures/projects/${name}/project.icproj.json`),
      "utf8",
    ),
  );
}

function canonical(line: ReturnType<typeof deriveFlightlines>[number]) {
  const swap =
    endpointKey(line.from).localeCompare(endpointKey(line.to), "en") > 0;
  const from = swap ? line.to : line.from;
  const to = swap ? line.from : line.to;
  return {
    endpoints: `${endpointKey(from)}|${endpointKey(to)}`,
    distance: line.distance,
  };
}

const FIXTURES = [
  "phase-1-manual",
  "phase-2-imported-rlc",
  "phase-3-routing",
  "phase-5-dense-analog",
];

describe("WP-R10 deletion-gate parity (old helpers vs unified read models)", () => {
  for (const fixture of FIXTURES) {
    it(`flightline content matches: deriveFlightlines vs index on ${fixture}`, () => {
      const project = loadFixtureProject(fixture);
      const resolver = createProjectSymbolResolver(project, builtInSymbols);
      const index = buildProjectConnectivityIndex(project, resolver);
      for (const document of project.documents) {
        const oldFlightlines = deriveFlightlines(document, resolver)
          .map(canonical)
          .sort(
            (a, b) =>
              a.endpoints.localeCompare(b.endpoints, "en") ||
              a.distance - b.distance,
          );
        const newFlightlines = [
          ...index.documents.get(document.id)!.nets.values(),
        ]
          .flatMap((net) => net.flightlines)
          .map(canonical)
          .sort(
            (a, b) =>
              a.endpoints.localeCompare(b.endpoints, "en") ||
              a.distance - b.distance,
          );
        expect(newFlightlines).toEqual(oldFlightlines);
      }
    });

    it(`route centerline matches: routePolyline vs resolveRouteGeometry on ${fixture}`, () => {
      const project = loadFixtureProject(fixture);
      const resolver = createProjectSymbolResolver(project, builtInSymbols);
      for (const document of project.documents) {
        for (const route of document.routes) {
          const polyline = routePolyline(document, resolver, route);
          const geometry = resolveRouteGeometry(document, resolver, route);
          // Both resolve or both do not.
          expect(polyline === null).toBe(geometry === null);
          if (polyline && geometry) {
            expect(geometry.centerline).toEqual(polyline.points);
          }
        }
      }
    });
  }
});
