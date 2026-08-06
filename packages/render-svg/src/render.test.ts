import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { buildSvgScene, renderDocumentSvg } from "./render.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("textbook monochrome SVG renderer", () => {
  it("renders formal symbols deterministically without editor overlays", () => {
    const project = parseProject(
      readFileSync(
        resolve(
          process.cwd(),
          "fixtures/projects/phase-1-rendered/project.icproj.json",
        ),
        "utf8",
      ),
    );
    const svg = renderDocumentSvg(project.documents[0]!, resolver);
    const golden = readFileSync(
      resolve(process.cwd(), "fixtures/visual-golden/phase-1-manual.svg"),
      "utf8",
    );
    expect(svg).toBe(golden);
    expect(svg).toContain('data-layer="formal"');
    expect(svg).not.toMatch(/selection|hit-target|flightline|overlay/u);
  });

  it("produces identical bounds after repeated rendering", () => {
    const project = parseProject(
      readFileSync(
        resolve(
          process.cwd(),
          "fixtures/projects/phase-1-rendered/project.icproj.json",
        ),
        "utf8",
      ),
    );
    const first = buildSvgScene(project.documents[0]!, resolver);
    const second = buildSvgScene(project.documents[0]!, resolver);
    expect(first).toEqual(second);
  });

  it("uses the model mirror-then-rotate transform for every orientation", () => {
    const project = parseProject(
      readFileSync(
        resolve(
          process.cwd(),
          "fixtures/projects/phase-1-manual/project.icproj.json",
        ),
        "utf8",
      ),
    );
    const instance = project.documents[0]!.instances[0]!;
    for (const rotation of [0, 90, 180, 270] as const) {
      for (const mirror of ["none", "x"] as const) {
        instance.placement = {
          position: { x: 100, y: 80 },
          rotation,
          mirror,
        };
        const scene = buildSvgScene(project.documents[0]!, resolver);
        const expectedMirror = mirror === "x" ? " scale(-1 1)" : "";
        expect(scene.formalBody).toContain(
          `transform="translate(100 80) rotate(${rotation})${expectedMirror}"`,
        );
        expect(scene.formalBody).toContain(
          `<text x="100" y="124" text-anchor="middle">M1</text>`,
        );
        expect(scene.viewBox.width).toBeGreaterThan(0);
        expect(scene.viewBox.height).toBeGreaterThan(0);
      }
    }
  });

  it("renders two crossing routes without inventing a Junction dot", () => {
    const project = parseProject(
      readFileSync(
        resolve(
          process.cwd(),
          "fixtures/projects/phase-3-routing/project.icproj.json",
        ),
        "utf8",
      ),
    );
    const terminal = (instanceId: string) => ({
      kind: "terminal" as const,
      instanceId,
      pinName: "P1",
    });
    project.documents[0]!.routes = [
      {
        id: "route-h",
        netId: "net-h",
        from: terminal("A"),
        to: terminal("B"),
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-v",
        netId: "net-v",
        from: terminal("C"),
        to: terminal("D"),
        waypoints: [],
        segmentModes: ["manual"],
      },
    ];
    const svg = renderDocumentSvg(project.documents[0]!, resolver, {
      title: "Phase 3 Crossing",
    });
    expect(svg).toBe(
      readFileSync(
        resolve(process.cwd(), "fixtures/visual-golden/phase-3-crossing.svg"),
        "utf8",
      ),
    );
    expect(svg).toContain('<g data-layer="junctions"></g>');
    expect(svg).not.toContain("flightline");
  });
});
