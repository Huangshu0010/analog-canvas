import { describe, expect, it } from "vitest";

import { createEmptyDocument } from "@icm/model";
import type { Annotation, DraftingObject } from "@icm/model";

import {
  createTextEditingSession,
  proposeTextEditingCommit,
  resolveTextEditingTarget,
  textDeletionEdit,
  updateTextEditingSession,
} from "./text-editing";

const annotation = (): Annotation => ({
  id: "annotation-1",
  kind: "net-label",
  text: "Vout",
  position: { x: 10, y: 20 },
  offset: { x: 0, y: 0 },
  alignment: "middle",
  rotation: 0,
  locked: false,
});

const draftingText = (): Extract<DraftingObject, { kind: "text" }> => ({
  id: "drafting-1",
  kind: "text",
  locked: false,
  zIndex: 0,
  anchor: { kind: "free", position: { x: 30, y: 40 } },
  content: { runs: [{ kind: "text", value: "Design note" }] },
  alignment: "middle",
  rotation: 0,
  typographyToken: "label",
});

describe("unified text editing", () => {
  it("creates one session shape from semantic annotations and drafting text", () => {
    const annotationSession = createTextEditingSession({
      owner: "annotation",
      object: annotation(),
    });
    expect(annotationSession).toMatchObject({
      owner: "annotation",
      id: "annotation-1",
      sizeScale: 1,
    });
    expect(annotationSession.content.runs.length).toBeGreaterThan(0);

    expect(
      createTextEditingSession({ owner: "drafting", object: draftingText() }),
    ).toEqual({
      owner: "drafting",
      id: "drafting-1",
      content: { runs: [{ kind: "text", value: "Design note" }] },
      sizeScale: 1,
    });
  });

  it("updates session content and size without mutating the original", () => {
    const original = createTextEditingSession({
      owner: "drafting",
      object: draftingText(),
    });
    const next = updateTextEditingSession(original, { sizeScale: 1.4 });
    expect(next.sizeScale).toBe(1.4);
    expect(original.sizeScale).toBe(1);
  });

  it("resolves only the tagged target kind", () => {
    const document = {
      ...createEmptyDocument("text", "Text"),
      annotations: [annotation()],
      drafting: { objects: [draftingText()], guides: [] },
    };
    const annotationSession = createTextEditingSession({
      owner: "annotation",
      object: annotation(),
    });
    expect(resolveTextEditingTarget(document, annotationSession)).toMatchObject(
      {
        owner: "annotation",
        object: { id: "annotation-1" },
      },
    );
    expect(
      resolveTextEditingTarget(document, {
        ...annotationSession,
        owner: "drafting",
      }),
    ).toBeNull();
  });

  it("proposes typed updates for both persistence owners", () => {
    const base = createEmptyDocument("text", "Text");
    const document = {
      ...base,
      annotations: [annotation()],
      drafting: { objects: [draftingText()], guides: [] },
    };
    const annotationSession = updateTextEditingSession(
      createTextEditingSession({ owner: "annotation", object: annotation() }),
      { content: { runs: [{ kind: "text", value: "Vbias" }] } },
    );
    expect(proposeTextEditingCommit(document, annotationSession)).toMatchObject(
      {
        kind: "update",
        edit: {
          kind: "upsert_annotation",
          annotation: { text: "Vbias" },
        },
      },
    );

    const draftingSession = updateTextEditingSession(
      createTextEditingSession({
        owner: "drafting",
        object: draftingText(),
      }),
      { sizeScale: 1.5 },
    );
    expect(proposeTextEditingCommit(document, draftingSession)).toMatchObject({
      kind: "update",
      edit: {
        kind: "upsert_drafting_object",
        object: { styleOverride: { sizeScale: 1.5 } },
      },
    });
  });

  it("distinguishes no-op, blank deletion, locked, and missing outcomes", () => {
    const object = { ...draftingText(), styleOverride: { sizeScale: 1 } };
    const document = {
      ...createEmptyDocument("text", "Text"),
      drafting: { objects: [object], guides: [] },
    };
    const session = createTextEditingSession({ owner: "drafting", object });
    expect(proposeTextEditingCommit(document, session)).toEqual({
      kind: "unchanged",
    });

    const blank = updateTextEditingSession(session, {
      content: { runs: [{ kind: "text", value: "   " }] },
    });
    expect(proposeTextEditingCommit(document, blank)).toEqual({
      kind: "delete",
      edit: { kind: "remove_drafting_object", objectId: "drafting-1" },
      id: "drafting-1",
    });

    expect(
      proposeTextEditingCommit(
        {
          ...document,
          drafting: { objects: [{ ...object, locked: true }], guides: [] },
        },
        updateTextEditingSession(session, { sizeScale: 1.2 }),
      ),
    ).toEqual({ kind: "blocked" });
    expect(
      proposeTextEditingCommit(
        createEmptyDocument("missing", "Missing"),
        session,
      ),
    ).toEqual({ kind: "blocked" });
  });

  it("creates deletion edits from the session owner", () => {
    const session = createTextEditingSession({
      owner: "annotation",
      object: annotation(),
    });
    expect(textDeletionEdit(session)).toEqual({
      kind: "remove_annotation",
      annotationId: "annotation-1",
    });
  });
});
