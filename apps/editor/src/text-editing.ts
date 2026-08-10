import type { SchematicEdit } from "@icm/edit-engine";
import { flattenRichText } from "@icm/model";
import type {
  Annotation,
  DraftingObject,
  RichTextDocument,
  SchematicDocument,
} from "@icm/model";
import { schematicTextDocument } from "@icm/render-svg";

export type DraftingTextObject = Extract<DraftingObject, { kind: "text" }>;

export type EditableTextTarget =
  | { owner: "annotation"; object: Annotation }
  | { owner: "drafting"; object: DraftingTextObject };

export interface TextEditingSession {
  owner: EditableTextTarget["owner"];
  id: string;
  content: RichTextDocument;
  sizeScale: number;
}

export type TextEditingCommitProposal =
  | { kind: "update"; edit: SchematicEdit; id: string }
  | { kind: "delete"; edit: SchematicEdit; id: string }
  | { kind: "unchanged" }
  | { kind: "blocked" };

export function createTextEditingSession(
  target: EditableTextTarget,
): TextEditingSession {
  if (target.owner === "annotation") {
    const annotation = target.object;
    return {
      owner: "annotation",
      id: annotation.id,
      content:
        annotation.content ??
        schematicTextDocument(annotation.text, annotation.kind),
      sizeScale: annotation.sizeScale ?? 1,
    };
  }
  return {
    owner: "drafting",
    id: target.object.id,
    content: target.object.content as unknown as RichTextDocument,
    sizeScale: target.object.styleOverride?.sizeScale ?? 1,
  };
}

export function updateTextEditingSession(
  session: TextEditingSession,
  change: Partial<Pick<TextEditingSession, "content" | "sizeScale">>,
): TextEditingSession {
  return { ...session, ...change };
}

export function resolveTextEditingTarget(
  document: SchematicDocument,
  session: TextEditingSession,
): EditableTextTarget | null {
  if (session.owner === "annotation") {
    const object = document.annotations.find(
      (candidate) => candidate.id === session.id,
    );
    return object ? { owner: "annotation", object } : null;
  }
  const object = document.drafting?.objects.find(
    (candidate): candidate is DraftingTextObject =>
      candidate.id === session.id && candidate.kind === "text",
  );
  return object ? { owner: "drafting", object } : null;
}

export function textDeletionEdit(session: TextEditingSession): SchematicEdit {
  return session.owner === "annotation"
    ? { kind: "remove_annotation", annotationId: session.id }
    : { kind: "remove_drafting_object", objectId: session.id };
}

function richTextEqual(
  left: { runs: unknown[] },
  right: { runs: unknown[] },
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

// Persist the exact rich-text AST and suppress revisions when both that AST
// and its presentation scale are unchanged.
export function proposeTextEditingCommit(
  document: SchematicDocument,
  session: TextEditingSession,
): TextEditingCommitProposal {
  const plainText = flattenRichText(
    session.content as unknown as Parameters<typeof flattenRichText>[0],
  ).trim();
  if (!plainText) {
    return {
      kind: "delete",
      edit: textDeletionEdit(session),
      id: session.id,
    };
  }

  const target = resolveTextEditingTarget(document, session);
  if (!target || target.object.locked) return { kind: "blocked" };

  if (target.owner === "annotation") {
    const annotation = target.object;
    const next = {
      ...annotation,
      text: plainText,
      content: session.content,
      sizeScale: session.sizeScale,
    };
    if (
      annotation.text === next.text &&
      annotation.sizeScale === next.sizeScale &&
      annotation.content &&
      richTextEqual(annotation.content, next.content)
    ) {
      return { kind: "unchanged" };
    }
    return {
      kind: "update",
      edit: { kind: "upsert_annotation", annotation: next },
      id: annotation.id,
    };
  }

  const object = target.object;
  const next = {
    ...object,
    content: session.content,
    styleOverride: {
      ...object.styleOverride,
      sizeScale: session.sizeScale,
    },
  };
  if (
    object.styleOverride?.sizeScale === next.styleOverride.sizeScale &&
    richTextEqual(object.content, next.content)
  ) {
    return { kind: "unchanged" };
  }
  return {
    kind: "update",
    edit: { kind: "upsert_drafting_object", object: next },
    id: object.id,
  };
}
