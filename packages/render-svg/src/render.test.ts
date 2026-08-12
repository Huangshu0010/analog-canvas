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
import { razaviTextbookProfile } from "./style-profile.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("textbook monochrome SVG renderer", () => {
  it("renders a bulk Route with the canonical wire geometry and Razavi dash", () => {
    const document = createEmptyProject("bulk-route", "Bulk route")
      .documents[0]!;
    document.instances.push({
      id: "M1",
      symbolId: "nmos",
      symbolVariantId: "textbook-3terminal",
      placement: { position: { x: 40, y: 40 }, rotation: 0, mirror: "none" },
      properties: {},
    });
    document.ports.push({
      id: "VB",
      name: "VB",
      direction: "input",
      position: { x: 100, y: 40 },
    });
    document.nets.push({
      id: "net-vb",
      scope: "local",
      terminals: [{ instanceId: "M1", pinName: "B" }],
      ports: ["VB"],
    });
    document.routes.push({
      id: "route-bulk",
      netId: "net-vb",
      from: { kind: "terminal", instanceId: "M1", pinName: "B" },
      to: { kind: "port", portId: "VB" },
      waypoints: [],
      segmentModes: ["manual"],
      presentation: "bulk-dashed",
    });
    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain('data-route-presentation="bulk-dashed"');
    expect(svg).toContain('stroke-dasharray="3 3"');
  });
  it("preserves a manually formatted multi-character semantic subscript", () => {
    const document = createEmptyProject("project-rich-label", "Rich label")
      .documents[0]!;
    document.annotations.push({
      id: "label-vin",
      kind: "net-label",
      text: "VOUT",
      content: {
        runs: [
          {
            kind: "span",
            style: "italic",
            children: [
              {
                kind: "span",
                style: "bold",
                children: [{ kind: "text", value: "V" }],
              },
            ],
          },
          {
            kind: "span",
            style: "subscript",
            children: [
              {
                kind: "span",
                style: "bold",
                children: [{ kind: "text", value: "out" }],
              },
            ],
          },
        ],
      },
      position: { x: 100, y: 100 },
      offset: { x: 0, y: 0 },
      alignment: "start",
      rotation: 0,
      locked: false,
    });

    document.presentation.styleProfileId = "razavi-textbook-v1";
    const svg = renderDocumentSvg(document, resolver);

    expect(svg).toContain('data-object-id="label-vin"');
    expect(svg).toContain('data-text-run="subscript"');
    expect(svg).toContain(">out</tspan>");
    expect(svg).not.toContain(">OUT</tspan>");
    expect(svg).toContain("font-style:italic;font-weight:700");
    expect(svg).toContain("font-style:normal;font-weight:700");
  });

  it("renders the Razavi palette port as a hollow endpoint", () => {
    const port = builtInSymbols.find((symbol) => symbol.id === "port");
    expect(port).toBeDefined();

    const body = renderSymbolDefinitionBody(
      port!,
      [],
      [],
      razaviTextbookProfile,
    );

    expect(body).toContain(
      'r="2.47907" fill="none" stroke="#000" stroke-width="1.6"',
    );
    expect(body).toContain('x2="-4.607544"');
  });

  it("preserves the resistor's sharp miter override", () => {
    const resistor = builtInSymbols.find((symbol) => symbol.id === "resistor");
    expect(resistor).toBeDefined();

    const body = renderSymbolDefinitionBody(
      resistor!,
      [],
      [],
      razaviTextbookProfile,
    );

    expect(body).toContain('stroke-linejoin="miter"');
    expect(body).toContain('stroke-miterlimit="12"');
  });

  it("renders only physical branch Junctions as connection dots", () => {
    const project = createEmptyProject("project-junction-roles", "Roles");
    const document = project.documents[0]!;
    document.nets.push({
      id: "net-a",
      scope: "local",
      terminals: [],
      ports: [],
    });
    document.junctions.push(
      {
        id: "junction-branch",
        netId: "net-a",
        position: { x: 100, y: 100 },
        role: "branch",
      },
      {
        id: "junction-label",
        netId: "net-a",
        position: { x: 140, y: 100 },
        role: "label-anchor",
      },
      {
        id: "junction-route",
        netId: "net-a",
        position: { x: 180, y: 100 },
        role: "route-anchor",
      },
      {
        id: "junction-branch-east",
        netId: "net-a",
        position: { x: 120, y: 100 },
        role: "route-anchor",
      },
      {
        id: "junction-branch-south",
        netId: "net-a",
        position: { x: 100, y: 120 },
        role: "route-anchor",
      },
      {
        id: "junction-legacy-loose",
        netId: "net-a",
        position: { x: 200, y: 100 },
        role: "branch",
      },
    );
    document.routes.push(
      {
        id: "route-branch-west",
        netId: "net-a",
        from: { kind: "junction", junctionId: "junction-branch" },
        to: { kind: "junction", junctionId: "junction-route" },
        waypoints: [],
        segmentModes: ["auto"],
      },
      {
        id: "route-branch-east",
        netId: "net-a",
        from: { kind: "junction", junctionId: "junction-branch" },
        to: { kind: "junction", junctionId: "junction-branch-east" },
        waypoints: [],
        segmentModes: ["auto"],
      },
      {
        id: "route-branch-south",
        netId: "net-a",
        from: { kind: "junction", junctionId: "junction-branch" },
        to: { kind: "junction", junctionId: "junction-branch-south" },
        waypoints: [],
        segmentModes: ["auto"],
      },
      {
        id: "route-legacy-loose",
        netId: "net-a",
        from: { kind: "junction", junctionId: "junction-legacy-loose" },
        to: { kind: "junction", junctionId: "junction-label" },
        waypoints: [],
        segmentModes: ["auto"],
      },
    );

    const svg = renderDocumentSvg(document, resolver);

    expect(svg).toContain('data-object-id="junction-branch"');
    expect(svg).not.toContain('data-object-id="junction-label"');
    expect(svg).not.toContain('data-object-id="junction-route"');
    expect(svg).not.toContain('data-object-id="junction-legacy-loose"');
  });

  it("renders terminal and port No Connect declarations in the formal scene", () => {
    const project = createEmptyProject("project-no-connect", "No Connect");
    const document = project.documents[0]!;
    document.instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0,
        mirror: "none",
      },
      properties: {},
    });
    document.ports.push({
      id: "port-a",
      name: "A",
      direction: "passive",
      position: { x: 180, y: 100 },
    });
    document.noConnects.push(
      {
        id: "nc-terminal",
        endpoint: { kind: "terminal", instanceId: "R1", pinName: "1" },
      },
      {
        id: "nc-port",
        endpoint: { kind: "port", portId: "port-a" },
      },
    );

    const scene = buildSvgScene(document, resolver);

    expect(scene.formalBody).toContain('data-layer="no-connects"');
    expect(scene.formalBody).toContain('data-object-id="nc-terminal"');
    expect(scene.formalBody).toContain('data-object-id="nc-port"');
    expect(scene.formalBody.match(/data-role="no-connect"/g)).toHaveLength(2);
  });

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
        expect(scene.formalBody).toContain('data-text-run="subscript"');
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
      pinName: "P",
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

  it("renders a Razavi current arrow attached to, and moving with, one wire segment", () => {
    const project = createEmptyProject(
      "project-current-arrow",
      "Current arrow",
    );
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";
    document.ports.push(
      {
        id: "port-left",
        name: "LEFT",
        direction: "passive",
        position: { x: 40, y: 60 },
      },
      {
        id: "port-right",
        name: "RIGHT",
        direction: "passive",
        position: { x: 160, y: 60 },
      },
    );
    document.nets.push({
      id: "net-current",
      scope: "local",
      terminals: [],
      ports: ["port-left", "port-right"],
    });
    document.routes.push({
      id: "route-current",
      netId: "net-current",
      from: { kind: "port", portId: "port-left" },
      to: { kind: "port", portId: "port-right" },
      waypoints: [],
      segmentModes: ["manual"],
    });
    document.annotations.push({
      id: "current-arrow",
      kind: "route-marker",
      markerKind: "current",
      text: "I_x",
      // This is a persistence fallback only. The route anchor drives the
      // rendered position.
      position: { x: 0, y: 0 },
      anchor: {
        kind: "route",
        routeId: "route-current",
        segmentIndex: 0,
        t: 0.25,
        direction: "reverse",
        normalOffset: -14,
        orientation: "follow",
        fallbackPosition: { x: 0, y: 0 },
      },
      offset: { x: 0, y: 0 },
      alignment: "middle",
      rotation: 0,
      locked: false,
      sizeScale: 1.5,
    });

    const first = renderDocumentSvg(document, resolver);
    expect(first).toContain('transform="rotate(180 70 60)"');
    expect(first).toContain('<text x="70" y="46" text-anchor="middle"');
    expect(first).toContain('text-anchor="middle" font-size="22.67"');
    expect(first).toContain('data-role="current-arrow-head"');
    expect(first).not.toContain('data-role="current-arrow-shaft"');
    expect(first).toContain('data-text-run="subscript"');
    expect(first).toContain(
      'style="font-style:normal;font-weight:700">x</tspan>',
    );

    document.ports[1]!.position = { x: 280, y: 60 };
    const stretched = renderDocumentSvg(document, resolver);
    expect(stretched).toContain('transform="rotate(180 100 60)"');
    expect(stretched).toContain('<text x="100" y="46" text-anchor="middle"');
  });

  it("renders a Razavi formal Port as a hollow node with a junction-sized outside radius", () => {
    const project = createEmptyProject("project-hollow-port", "Hollow port");
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";
    document.ports.push({
      id: "port-vin",
      name: "Vin",
      direction: "passive",
      position: { x: 40, y: 60 },
    });

    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toContain(
      '<circle data-object-id="port-vin" data-node-kind="port-origin" cx="40" cy="60" r="2.47907" fill="#fff" stroke="#000" stroke-width="1.6"/>',
    );
  });

  it("bridges direct terminal corners without changing route topology", () => {
    const project = createEmptyProject("project-terminal-overlap", "Overlap");
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";
    document.nets.push({
      id: "net-supply",
      scope: "local",
      terminals: [
        { instanceId: "VDD1", pinName: "P" },
        { instanceId: "GND1", pinName: "0" },
      ],
      ports: [],
    });
    document.instances.push(
      {
        id: "VDD1",
        symbolId: "vdd",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
      {
        id: "GND1",
        symbolId: "ground",
        placement: {
          position: { x: 100, y: 200 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    );
    document.routes.push({
      id: "route-supply",
      netId: "net-supply",
      from: { kind: "terminal", instanceId: "VDD1", pinName: "P" },
      to: { kind: "terminal", instanceId: "GND1", pinName: "0" },
      waypoints: [
        { x: 130, y: 120 },
        { x: 130, y: 190 },
      ],
      segmentModes: ["manual", "manual", "manual"],
    });

    const svg = renderDocumentSvg(document, resolver);

    expect(svg).toContain(
      'data-object-id="route-supply" data-net-id="net-supply" points="100,120 130,120 130,190 100,190"',
    );
    expect(svg).toContain(
      'data-role="terminal-miter-bridge" data-route-id="route-supply" d="M 100 118.8 L 100 120 L 101.2 120"',
    );
    expect(svg).toContain(
      'data-role="terminal-miter-bridge" data-route-id="route-supply" d="M 100 191.2 L 100 190 L 101.2 190"',
    );
    expect(document.routes[0]!.waypoints).toEqual([
      { x: 130, y: 120 },
      { x: 130, y: 190 },
    ]);
  });

  it("bridges a reconnected dotless route-anchor without changing route endpoints", () => {
    const project = createEmptyProject("project-route-anchor", "Route anchor");
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";
    document.nets.push({
      id: "net-anchor",
      scope: "local",
      terminals: [],
      ports: [],
    });
    document.junctions.push(
      {
        id: "anchor",
        netId: "net-anchor",
        position: { x: 100, y: 100 },
        role: "route-anchor",
      },
      {
        id: "left",
        netId: "net-anchor",
        position: { x: 60, y: 100 },
        role: "route-anchor",
      },
      {
        id: "down",
        netId: "net-anchor",
        position: { x: 100, y: 140 },
        role: "route-anchor",
      },
    );
    document.routes.push(
      {
        id: "route-left",
        netId: "net-anchor",
        from: { kind: "junction", junctionId: "anchor" },
        to: { kind: "junction", junctionId: "left" },
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-down",
        netId: "net-anchor",
        from: { kind: "junction", junctionId: "anchor" },
        to: { kind: "junction", junctionId: "down" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    );

    const svg = renderDocumentSvg(document, resolver);

    expect(svg).toContain(
      'data-role="route-anchor-miter-bridge" data-junction-id="anchor" d="M 98.8 100 L 100 100 L 100 101.2"',
    );
    expect(svg).not.toContain('data-object-id="anchor"');
    expect(document.routes.map((route) => route.waypoints)).toEqual([[], []]);
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
    // After the schema-2 migration the phase-5 fixture's legacy current marker
    // and figure caption render as route-marker / draft-text respectively.
    expect(svg).toContain('data-kind="route-marker"');
    expect(svg).toContain('data-kind="draft-text"');
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
    expect(svg).toContain('stroke="#000" stroke-width="1.6"');
    expect(svg).toContain(
      '<polygon points="-11.802326,-9.593023 -11.802326,9.593023 -8.895349,9.593023 -8.895349,-9.593023" fill="#000" stroke="none"/>',
    );
    expect(svg).toContain('stroke-linecap="butt"');
    expect(svg).toContain('stroke-miterlimit="4"');
    expect(svg).toContain('data-node-kind="port-origin"');
    expect(svg).toContain(
      'r="2.47907" fill="#fff" stroke="#000" stroke-width="1.6"',
    );
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
      '<circle data-object-id="junction-bias" cx="225" cy="80" r="3.77907" fill="#000"/>',
    );
    expect(svg).not.toContain('data-node-kind="device-pin"');
    expect([...svg.matchAll(/<circle data-object-id=/gu)].length).toBe(10);
    // A route-marker contributes a head; its attached route remains the shaft.
    expect(svg).not.toContain('data-role="current-arrow-shaft"');
    expect(svg).toContain('data-kind="route-marker"');
    expect(svg).toContain(
      "font-family:'DejaVu Sans',Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:15.116px",
    );
    expect(svg).toContain('data-text-run="subscript"');
    expect(svg).toContain(
      'style="font-style:normal;font-weight:700">1</tspan>',
    );
    expect(svg).toContain(
      'style="font-style:normal;font-weight:700">DD</tspan>',
    );
    // The migrated route-marker (current) renders I_tail into Razavi tspans.
    expect(svg).toContain(
      'style="font-style:normal;font-weight:700">tail</tspan>',
    );
    expect(svg).toMatch(
      /data-kind="draft-text"[^>]*>Original matched differential stage<\/text>/u,
    );
    const widths = new Set(
      [...svg.matchAll(/stroke-width="([^"]+)"/gu)].map((match) => match[1]),
    );
    expect([...widths].sort()).toEqual(["1.6", "1.8"]);
    expect(svg).not.toContain("vector-effect");
  });

  it("renders Razavi voltage polarity positions while keeping glyphs upright", () => {
    const project = createEmptyProject("project-voltage", "Voltage Polarity");
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";
    document.annotations = [
      {
        id: "voltage-x",
        kind: "route-marker",
        markerKind: "voltage",
        text: "V_X",
        position: { x: 100, y: 100 },
        anchor: {
          kind: "free",
          position: { x: 100, y: 100 },
        },
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
      '<text x="100" y="100" text-anchor="start" font-size="15.116"><tspan',
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

  it("hides the default instance label for label-hidden symbols", () => {
    const project = createEmptyProject("project-label-hidden", "Hidden Label");
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";
    document.instances = [
      {
        id: "GND1",
        symbolId: "ground",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    ];

    const svg = renderDocumentSvg(document, resolver);

    expect(svg).toContain('data-object-id="GND1"');
    expect(resolver.resolve("ground")?.definition.labelVisibility).toBe(
      "hidden",
    );
    expect(svg).not.toContain(">GND1</text>");
  });

  it("renders VDD through the shared semantic power-label typography", () => {
    const project = createEmptyProject("project-vdd-label", "VDD Label");
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";
    document.instances = [
      {
        id: "VDD1",
        symbolId: "vdd",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    ];
    document.annotations = [
      {
        id: "label-VDD1",
        kind: "power-label",
        text: "VDD",
        position: { x: 114, y: 105 },
        attachedObjectId: "VDD1",
        offset: { x: 14, y: 5 },
        alignment: "start",
        rotation: 0,
        locked: false,
      },
    ];

    const svg = renderDocumentSvg(document, resolver);

    expect(resolver.resolve("vdd")?.definition.labelVisibility).toBe("hidden");
    expect(svg).toContain('data-object-id="label-VDD1"');
    expect(svg).toContain('data-text-run="subscript"');
    expect(svg).toContain(">DD</tspan>");
    expect(svg).not.toContain(">VDD1</text>");
  });

  it("renders drafting text at its typography-token size", () => {
    const project = createEmptyProject("project-text-scale", "Text Scale");
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "razavi-textbook-v1";
    document.drafting = {
      objects: [
        {
          id: "note-1",
          kind: "text",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 100, y: 100 } },
          content: { runs: [{ kind: "text", value: "Note" }] },
          alignment: "middle",
          rotation: 0,
          typographyToken: "caption",
        },
      ],
      guides: [],
    };

    const svg = renderDocumentSvg(document, resolver);
    expect(svg).toMatch(/data-kind="draft-text"[^>]*font-size="14"/);
  });

  it("renders explicit subscript and italic markup as drafting rich text", () => {
    const project = createEmptyProject("project-markup", "Text Markup");
    const document = project.documents[0]!;
    document.drafting = {
      objects: [
        {
          id: "math-note",
          kind: "text",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 80, y: 80 } },
          content: {
            runs: [
              { kind: "text", value: "M" },
              {
                kind: "span",
                style: "subscript",
                children: [{ kind: "text", value: "1" }],
              },
            ],
          },
          alignment: "start",
          rotation: 0,
        },
        {
          id: "italic-note",
          kind: "text",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 80, y: 110 } },
          content: {
            runs: [
              {
                kind: "span",
                style: "italic",
                children: [{ kind: "text", value: "gain" }],
              },
            ],
          },
          alignment: "start",
          rotation: 0,
        },
      ],
      guides: [],
    };

    const svg = renderDocumentSvg(document, resolver);

    expect(svg).toContain('data-text-run="subscript"');
    expect(svg).toContain("font-style:italic");
  });

  it("renders drafting text as flat escaped text in the textbook-monochrome profile", () => {
    const project = createEmptyProject("project-mono-text-scale", "Mono Text");
    const document = project.documents[0]!;
    document.presentation.styleProfileId = "textbook-monochrome-v1";
    document.drafting = {
      objects: [
        {
          id: "note-1",
          kind: "text",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 100, y: 100 } },
          content: { runs: [{ kind: "text", value: "Note" }] },
          alignment: "middle",
          rotation: 0,
        },
      ],
      guides: [],
    };

    const scene = buildSvgScene(document, resolver);

    expect(scene.formalBody).toContain(">Note</text>");
    expect(scene.formalBody).toContain('data-layer="drafting"');
  });
});
