import { z } from "zod";

export type RichTextStyle = "italic" | "bold" | "subscript" | "superscript";

export type RichTextRun =
  | { kind: "text"; value: string }
  | { kind: "line-break" }
  | { kind: "span"; style: RichTextStyle; children: RichTextRun[] }
  | {
      kind: "fraction";
      numerator: RichTextDocument;
      denominator: RichTextDocument;
    };

export interface RichTextDocument {
  runs: RichTextRun[];
}

const RICH_TEXT_MAX_DEPTH = 4;
const RICH_TEXT_MAX_RUNS = 64;
const RICH_TEXT_MAX_TEXT_LENGTH = 256;

function richTextRunSchema(depth: number): z.ZodTypeAny {
  const text = z.strictObject({
    kind: z.literal("text"),
    value: z.string().min(1).max(RICH_TEXT_MAX_TEXT_LENGTH),
  });
  const lineBreak = z.strictObject({ kind: z.literal("line-break") });
  if (depth >= RICH_TEXT_MAX_DEPTH) return z.union([text, lineBreak]);
  return z.union([
    text,
    lineBreak,
    z.strictObject({
      kind: z.literal("span"),
      style: z.enum(["italic", "bold", "subscript", "superscript"]),
      children: z
        .array(richTextRunSchema(depth + 1))
        .min(1)
        .max(RICH_TEXT_MAX_RUNS),
    }),
    z.strictObject({
      kind: z.literal("fraction"),
      numerator: richTextDocumentSchema(depth + 1),
      denominator: richTextDocumentSchema(depth + 1),
    }),
  ]);
}

function richTextDocumentSchema(depth: number): z.ZodTypeAny {
  return z.strictObject({
    runs: z.array(richTextRunSchema(depth)).min(1).max(RICH_TEXT_MAX_RUNS),
  });
}

export const RichTextDocumentSchema = richTextDocumentSchema(
  0,
) as z.ZodType<RichTextDocument>;
export const RichTextRunSchema = richTextRunSchema(0) as z.ZodType<RichTextRun>;
