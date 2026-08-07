import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createEmptyProject, parseProject } from "@icm/model";
import {
  builtInSymbols,
  createProjectSymbolResolver,
  hierarchicalSymbolId,
  InMemorySymbolResolver,
} from "@icm/symbols";
import {
  diagnoseVisualQuality,
  hasBlockingVisualDiagnostics,
} from "@icm/derived";
import { describe, expect, it } from "vitest";

import {
  buildSvgScene,
  renderDocumentSvg,
  renderSymbolDefinitionBody,
} from "./render.js";

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

  it("renders reviewed variant additions without changing electrical pins", () => {
    const nmos = resolver.resolve("nmos", "textbook-3terminal")!;
    const pmos = resolver.resolve("pmos", "textbook-3terminal")!;
    const nmosBody = renderSymbolDefinitionBody(
      nmos.definition,
      nmos.variant?.hiddenPrimitiveParts,
      nmos.variant?.additionalPrimitives,
    );
    const pmosBody = renderSymbolDefinitionBody(
      pmos.definition,
      pmos.variant?.hiddenPrimitiveParts,
      pmos.variant?.additionalPrimitives,
    );

    expect(nmos.definition.pins.map((pin) => pin.name)).toEqual([
      "D",
      "G",
      "S",
      "B",
    ]);
    for (const [resolved, body] of [
      [nmos, nmosBody],
      [pmos, pmosBody],
    ] as const) {
      const hiddenArrow = resolved.definition.primitives.find(
        (primitive) =>
          primitive.kind === "polygon" && primitive.part === "bulk-lead",
      );
      const visibleArrow = resolved.variant?.additionalPrimitives?.find(
        (primitive) => primitive.kind === "polygon",
      );
      if (hiddenArrow?.kind !== "polygon" || visibleArrow?.kind !== "polygon") {
        throw new Error("MOS variant must replace one decoded Visio arrow");
      }
      const points = (primitive: {
        points: readonly { x: number; y: number }[];
      }) => primitive.points.map((point) => `${point.x},${point.y}`).join(" ");
      expect(body).not.toContain(`points="${points(hiddenArrow)}"`);
      expect(body).toContain(`points="${points(visibleArrow)}"`);
      expect(body).toContain('fill="#000" stroke="none"');
    }
  });

  it("renders upright formal port names for a rotated hierarchy symbol", () => {
    const project = createEmptyProject("project-hierarchy", "Hierarchy");
    const document = project.documents[0]!;
    document.sourceBinding = {
      cellName: "driver_cell",
      sourceRef: {
        fileId: "source-main",
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 1, line: 1, column: 2 },
      },
    };
    document.ports = ["bit", "nbit", "bot", "vss", "vdd"].map(
      (name, index) => ({
        id: `port-${index}`,
        name,
        direction: "passive",
        position: null,
      }),
    );
    document.instances = [
      {
        id: "XDRIVER",
        symbolId: hierarchicalSymbolId("driver_cell"),
        placement: {
          position: { x: 100, y: 100 },
          rotation: 90,
          mirror: "none",
        },
        properties: {},
      },
    ];
    const hierarchyResolver = createProjectSymbolResolver(
      project,
      builtInSymbols,
    );

    const svg = renderDocumentSvg(document, hierarchyResolver);
    for (const pinName of ["bit", "nbit", "bot", "vss", "vdd"]) {
      expect(svg).toContain(`data-pin-name="${pinName}"`);
      expect(svg).toContain(`>${pinName}</text>`);
    }
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
          `<text x="100" y="118" text-anchor="middle">M1</text>`,
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

    project.documents[0]!.presentation.styleProfileId = "razavi-textbook-v1";
    const razaviSvg = renderDocumentSvg(project.documents[0]!, resolver);
    expect(razaviSvg).toContain('<g data-layer="junctions"></g>');
    expect(razaviSvg).not.toMatch(/<circle[^>]*cx="300"[^>]*cy="300"/u);
  });

  it("renders the original dense analog fixture without blocking visual diagnostics", () => {
    const project = parseProject(
      readFileSync(
        resolve(
          process.cwd(),
          "fixtures/projects/phase-5-dense-analog/project.icproj.json",
        ),
        "utf8",
      ),
    );
    const document = project.documents[0]!;
    const diagnostics = diagnoseVisualQuality(document, resolver);
    expect(hasBlockingVisualDiagnostics(diagnostics)).toBe(false);
    expect(diagnostics.map((item) => item.code)).not.toContain(
      "VISUAL_LABEL_OVERLAP",
    );
    const svg = renderDocumentSvg(document, resolver, {
      title: project.name,
    });
    expect(svg).toBe(
      readFileSync(
        resolve(
          process.cwd(),
          "fixtures/visual-golden/phase-5-dense-analog.svg",
        ),
        "utf8",
      ),
    );
    expect(svg).toContain('data-kind="current"');
    expect(svg).toContain('data-kind="figure-caption"');
    expect(svg).not.toMatch(/selection|hit-target|flightline|overlay/u);
  });

  it("applies Razavi stroke roles without non-scaling formal geometry", () => {
    const project = parseProject(
      readFileSync(
        resolve(
          process.cwd(),
          "fixtures/projects/phase-5-dense-analog/project.icproj.json",
        ),
        "utf8",
      ),
    );
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";

    const svg = renderDocumentSvg(document, resolver, { title: "Razavi" });

    expect(svg).toContain('data-style-profile="razavi-textbook-v1"');
    expect(svg).toContain('stroke="#202020" stroke-width="1.6"');
    expect(svg).toContain('stroke-width="2.16"');
    expect(svg).toContain('stroke-linecap="butt"');
    expect(svg).toContain('stroke-miterlimit="4"');
    expect(svg).toContain('r="3" fill="#202020"');
    expect(svg).toContain('<g data-layer="ports">');
    expect([...svg.matchAll(/data-node-kind="port-origin"/gu)].length).toBe(5);
    expect(svg).not.toContain(
      'data-object-id="port-vdd" data-node-kind="port-origin"',
    );
    expect(svg).not.toContain(
      'data-object-id="port-vss" data-node-kind="port-origin"',
    );
    expect(svg).toContain(
      '<line data-role="supply-bar" x1="215" y1="20" x2="235" y2="20"',
    );
    expect(svg).toContain(
      '<line data-role="supply-bar" x1="245" y1="270" x2="265" y2="270"',
    );
    expect(svg).toContain(
      '<circle data-object-id="junction-bias" cx="225" cy="80" r="3" fill="#202020"/>',
    );
    expect(svg).not.toContain('data-node-kind="device-pin"');
    expect([...svg.matchAll(/<circle data-object-id=/gu)].length).toBe(10);
    expect(svg).toContain(
      '<line data-role="current-arrow-shaft" x1="243" y1="260" x2="257" y2="260"',
    );
    expect(svg).toContain(
      '<polygon data-role="current-arrow-head" points="267,260 257,256.5 257,263.5"',
    );
    expect(svg).toContain(
      "font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:16px",
    );
    expect(svg).toContain(
      '<tspan data-text-run="base" style="font-style:italic;font-weight:700">M</tspan><tspan data-text-run="subscript" font-size="68%" baseline-shift="-0.3em" style="font-style:italic;font-weight:700">1</tspan>',
    );
    expect(svg).toContain(
      '<tspan data-text-run="base" style="font-style:italic;font-weight:700">V</tspan><tspan data-text-run="subscript" font-size="68%" baseline-shift="-0.3em" style="font-style:italic;font-weight:700">DD</tspan>',
    );
    expect(svg).toContain(
      '<tspan data-text-run="base" style="font-style:italic;font-weight:700">I</tspan><tspan data-text-run="subscript" font-size="68%" baseline-shift="-0.3em" style="font-style:italic;font-weight:700">tail</tspan>',
    );
    expect(svg).toMatch(
      /data-kind="figure-caption"[^>]*>Original matched differential stage<\/text>/u,
    );
    const widths = new Set(
      [...svg.matchAll(/stroke-width="([^"]+)"/gu)].map((match) => match[1]),
    );
    expect([...widths].sort()).toEqual(["1.2", "1.6", "1.8", "2.16"]);
    expect(svg).not.toContain("vector-effect");
  });

  it("renders Razavi voltage polarity positions while keeping glyphs upright", () => {
    const project = createEmptyProject("project-voltage", "Voltage Polarity");
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";
    document.annotations = [
      {
        id: "voltage-x",
        kind: "voltage",
        text: "V_X",
        position: { x: 100, y: 100 },
        offset: { x: 0, y: 0 },
        alignment: "start",
        rotation: 90,
        locked: false,
      },
    ];

    const svg = renderDocumentSvg(document, resolver);

    expect(svg).toContain(
      '<text data-role="polarity-positive" x="108" y="92" text-anchor="middle" font-size="14" style="font-style:normal;font-weight:400">+</text>',
    );
    expect(svg).toContain(
      '<text data-role="polarity-negative" x="92" y="92" text-anchor="middle" font-size="14" style="font-style:normal;font-weight:400">−</text>',
    );
    expect(svg).toContain(
      '<text x="100" y="100" text-anchor="start" font-size="16"><tspan',
    );
    expect(svg).not.toContain('transform="rotate(90 100 100)"><tspan');
  });

  it("rejects an unknown persisted style profile", () => {
    const project = createEmptyProject("project-style", "Unknown Style");
    project.documents[0]!.presentation.styleProfileId = "not-installed";
    expect(() => renderDocumentSvg(project.documents[0]!, resolver)).toThrow(
      "Unknown schematic style profile: not-installed",
    );
  });
});
