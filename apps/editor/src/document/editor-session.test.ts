import { createEmptyProject } from "@icm/model";
import { describe, expect, it } from "vitest";

import {
  referencedDocumentId,
  replaceProjectDocument,
  resolveActiveDocument,
} from "./editor-session";

describe("editor session project helpers", () => {
  it("replaces only the matching document and validates the project", () => {
    const project = createEmptyProject("session", "Session");
    const original = project.documents[0]!;
    const child = { ...original, id: "child", name: "Child" };
    project.documents.push(child);

    const replacement = { ...child, name: "Renamed child", revision: 1 };
    const next = replaceProjectDocument(project, replacement);

    expect(next).not.toBe(project);
    expect(next.documents[0]).toEqual(original);
    expect(next.documents[1]).toEqual(replacement);
  });

  it("falls back to the top document for a stale active id", () => {
    const project = createEmptyProject("session", "Session");
    expect(resolveActiveDocument(project, "missing").id).toBe(
      project.topDocumentId,
    );
  });

  it("prefers a stable child id and supports legacy SPICE targets", () => {
    const project = createEmptyProject("session", "Session");
    const top = project.documents[0]!;
    const child = { ...top, id: "child", name: "GainCell" };
    project.documents.push(child);

    expect(
      referencedDocumentId(project, {
        id: "Xstable",
        symbolId: "generic-block-2",
        placement: null,
        properties: { "spice.childDocumentId": child.id },
      }),
    ).toBe(child.id);
    expect(
      referencedDocumentId(project, {
        id: "Xlegacy",
        symbolId: "generic-block-2",
        placement: null,
        properties: { "spice.target": "subcircuit:gaincell" },
      }),
    ).toBe(child.id);
  });
});
