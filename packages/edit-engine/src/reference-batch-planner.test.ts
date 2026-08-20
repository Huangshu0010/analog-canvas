import { createEmptyDocument, createEmptyProject } from "@icm/model";
import { describe, expect, it } from "vitest";

import { planReferenceRenumber } from "./reference-batch-planner.js";

function nmos(id: string, reference: string) {
  return {
    id,
    symbolId: "nmos",
    placement: null,
    netlist: { reference, parameters: {} },
  };
}

describe("planReferenceRenumber", () => {
  it("repairs selected duplicates per Cell without elaborating reused definitions", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("child", "Child");
    project.documents.push(child);
    project.documents[0]!.instances.push(nmos("M1", "M1"), nmos("M2", "M1"));
    child.instances.push(nmos("M1", "M1"));

    const preview = planReferenceRenumber(
      project,
      [
        { documentId: project.topDocumentId, instanceId: "M1" },
        { documentId: project.topDocumentId, instanceId: "M2" },
        { documentId: child.id, instanceId: "M1" },
      ],
      { policy: "fill-gaps" },
    );

    expect(preview.preserved).toEqual([
      { documentId: project.topDocumentId, instanceId: "M1", reference: "M1" },
      { documentId: child.id, instanceId: "M1", reference: "M1" },
    ]);
    expect(preview.reassigned).toEqual([
      {
        documentId: project.topDocumentId,
        instanceId: "M2",
        previous: "M1",
        reference: "M2",
      },
    ]);
    expect(preview.edits).toEqual([
      {
        kind: "transact_document",
        documentId: project.topDocumentId,
        expectedRevision: 0,
        edits: [
          {
            kind: "bulk_patch_instance_netlist",
            assignments: [{ instanceId: "M2", reference: "M2" }],
          },
        ],
      },
    ]);
  });

  it("continuously renumbers selected references while reserving unselected ones", () => {
    const project = createEmptyProject("project", "Project");
    project.documents[0]!.instances.push(
      nmos("M1", "M9"),
      nmos("M2", "M8"),
      nmos("M3", "M1"),
    );

    const preview = planReferenceRenumber(
      project,
      [
        { documentId: project.topDocumentId, instanceId: "M1" },
        { documentId: project.topDocumentId, instanceId: "M2" },
      ],
      { policy: "continuous", startAt: 1 },
    );

    expect(preview.reassigned).toEqual([
      {
        documentId: project.topDocumentId,
        instanceId: "M1",
        previous: "M9",
        reference: "M2",
      },
      {
        documentId: project.topDocumentId,
        instanceId: "M2",
        previous: "M8",
        reference: "M3",
      },
    ]);
  });
});
