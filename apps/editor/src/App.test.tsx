import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createEmptyProject } from "@icm/model";
import { serializeProject } from "@icm/model";
import { EditTransactionSchema } from "@icm/edit-engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  App,
  defaultRazaviSymbolVariantId,
  razaviMosPresentationEdits,
} from "./App";
import { createDemoProject } from "./demo-project";
import { createRoutingDemoProject } from "./routing-demo";

describe("editor shell", () => {
  it("uses one canonical Razavi presentation for manually placed MOS", () => {
    expect(defaultRazaviSymbolVariantId("nmos")).toBe("textbook-3terminal");
    expect(defaultRazaviSymbolVariantId("pmos")).toBe("textbook-3terminal");
    expect(defaultRazaviSymbolVariantId("resistor")).toBeUndefined();
  });

  it("migrates only implicit-bulk MOS into the Razavi textbook view", () => {
    const document = createEmptyProject("razavi-migration", "Razavi")
      .documents[0]!;
    document.instances.push(
      {
        id: "Mimplicit",
        symbolId: "nmos",
        placement: null,
        properties: {},
      },
      {
        id: "Msupply",
        symbolId: "pmos",
        placement: null,
        properties: {},
      },
      {
        id: "MbodyBias",
        symbolId: "nmos",
        placement: null,
        properties: {},
      },
    );
    document.nets.push(
      {
        id: "net-vdd",
        name: "VDD",
        scope: "global",
        terminals: [{ instanceId: "Msupply", pinName: "B" }],
        ports: [],
      },
      {
        id: "net-body-bias",
        name: "Vbody",
        scope: "local",
        terminals: [{ instanceId: "MbodyBias", pinName: "B" }],
        ports: [],
      },
    );

    expect(razaviMosPresentationEdits(document)).toEqual([
      {
        kind: "set_instance_symbol",
        instanceId: "Mimplicit",
        symbolId: "nmos",
        symbolVariantId: "textbook-3terminal",
      },
      {
        kind: "set_instance_symbol",
        instanceId: "Msupply",
        symbolId: "pmos",
        symbolVariantId: "textbook-3terminal",
      },
    ]);
  });

  it("renders an empty project without owning model state", () => {
    const project = createEmptyProject("project-smoke", "Smoke Project");
    const markup = renderToStaticMarkup(<App project={project} />);
    expect(markup).toContain("Smoke Project");
    expect(markup).toContain("Schematic canvas");
  });

  it("gives an implicit instance label its own selection surface", () => {
    const project = createEmptyProject("implicit-label", "Implicit label");
    project.documents[0]!.instances.push({
      id: "M1",
      symbolId: "nmos",
      placement: {
        position: { x: 160, y: 160 },
        rotation: 0,
        mirror: "none",
      },
      properties: {},
    });

    const markup = renderToStaticMarkup(<App project={project} />);
    expect(markup).toContain('data-testid="default-label-hit-M1"');
  });

  it("uses the compact four-unit endpoint hit target", () => {
    const project = createEmptyProject("endpoint-hit", "Endpoint Hit");
    project.documents[0]!.instances.push({
      id: "M1",
      symbolId: "nmos",
      placement: {
        position: { x: 160, y: 160 },
        rotation: 0,
        mirror: "none",
      },
      properties: {},
    });

    const markup = renderToStaticMarkup(<App project={project} />);
    expect(markup).toMatch(/data-testid="terminal-M1-D"[^>]*r="4"/u);
  });

  it("accepts a voltage source and its canonical label in one transaction", () => {
    const result = EditTransactionSchema.safeParse({
      transactionId: "place-voltage-source",
      documentId: "document-main",
      expectedRevision: 0,
      actor: { kind: "human", id: "test" },
      edits: [
        {
          kind: "add_instance",
          instance: {
            id: "V1",
            symbolId: "voltage-source",
            placement: {
              position: { x: 100, y: 100 },
              rotation: 0,
              mirror: "none",
            },
            properties: {},
          },
        },
        {
          kind: "upsert_annotation",
          annotation: {
            id: "instance-label-V1",
            kind: "instance-label",
            text: "V1",
            position: { x: 100, y: 148 },
            attachedObjectId: "V1",
            offset: { x: 0, y: 48 },
            alignment: "middle",
            rotation: 0,
            locked: false,
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("keeps the bundled demo equal to the canonical Project fixture", () => {
    const fixture = readFileSync(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-1-manual/project.icproj.json",
      ),
      "utf8",
    );
    expect(serializeProject(createDemoProject())).toBe(fixture);
    expect(fixture).not.toMatch(/selection|viewport|dragPreview/u);
  });

  it("keeps the routing demo equal to its canonical Project fixture", () => {
    const fixture = readFileSync(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-3-routing/project.icproj.json",
      ),
      "utf8",
    );
    expect(serializeProject(createRoutingDemoProject())).toBe(fixture);
  });
});
