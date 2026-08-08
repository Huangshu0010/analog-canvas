// ADR 0010 import-shorthand parser: a restricted markup string -> RichText
// AST. This is the parse-on-submit convenience for the editor and Agent; the
// persisted truth is always the canonical AST. The parser is deliberately
// small (no arbitrary LaTeX, no scripts): it supports subscripts `_{...}`,
// superscripts `^{...}`, italic `\it{...}`, bold `\bf{...}`, and fractions
// `\frac{num}{den}`, plus literal text and line breaks via `\\`.
//
// Unparseable input is returned as a single literal text run (never dropped).

export interface MarkupRun {
  kind: "text" | "line-break" | "span" | "fraction";
  value?: string;
  style?: "italic" | "bold" | "subscript" | "superscript";
  children?: MarkupRun[];
  numerator?: { runs: MarkupRun[] };
  denominator?: { runs: MarkupRun[] };
}

export interface MarkupDocument {
  runs: MarkupRun[];
}

// Command bodies may contain one level of braces (e.g. V_{DD} inside
// \it{...} or a fraction parameter), so the body matches plain text or one
// nested {...} group.
const NESTED_BODY = "(?:[^{}]|\\{[^{}]*\\})*";
const SUBSCRIPT_RE = new RegExp(`^_{(${NESTED_BODY})}`);
const SUPERSCRIPT_RE = new RegExp(`^\\^\\{(${NESTED_BODY})\\}`);
const ITALIC_RE = new RegExp(`^\\\\it\\{(${NESTED_BODY})\\}`);
const BOLD_RE = new RegExp(`^\\\\bf\\{(${NESTED_BODY})\\}`);
const FRACTION_RE = new RegExp(
  `^\\\\frac\\{(${NESTED_BODY})\\}\\{(${NESTED_BODY})\\}`,
);
const LINEBREAK_RE = /^\\\\/;

/**
 * Parse a markup string into a RichText AST document. The parser is
 * deterministic; any input it cannot consume is preserved as literal text.
 */
export function parseMarkup(markup: string): MarkupDocument {
  const runs: MarkupRun[] = [];
  let index = 0;
  let literal = "";

  const flushLiteral = (): void => {
    if (literal.length > 0) {
      runs.push({ kind: "text", value: literal });
      literal = "";
    }
  };

  while (index < markup.length) {
    const rest = markup.slice(index);

    const fraction = FRACTION_RE.exec(rest);
    if (fraction) {
      flushLiteral();
      runs.push({
        kind: "fraction",
        numerator: { runs: parseMarkup(fraction[1]!).runs },
        denominator: { runs: parseMarkup(fraction[2]!).runs },
      });
      index += fraction[0].length;
      continue;
    }

    const italic = ITALIC_RE.exec(rest);
    if (italic) {
      flushLiteral();
      runs.push({
        kind: "span",
        style: "italic",
        children: parseMarkup(italic[1]!).runs,
      });
      index += italic[0].length;
      continue;
    }

    const bold = BOLD_RE.exec(rest);
    if (bold) {
      flushLiteral();
      runs.push({
        kind: "span",
        style: "bold",
        children: parseMarkup(bold[1]!).runs,
      });
      index += bold[0].length;
      continue;
    }

    const subscript = SUBSCRIPT_RE.exec(rest);
    if (subscript) {
      flushLiteral();
      runs.push({
        kind: "span",
        style: "subscript",
        children: parseMarkup(subscript[1]!).runs,
      });
      index += subscript[0].length;
      continue;
    }

    const superscript = SUPERSCRIPT_RE.exec(rest);
    if (superscript) {
      flushLiteral();
      runs.push({
        kind: "span",
        style: "superscript",
        children: parseMarkup(superscript[1]!).runs,
      });
      index += superscript[0].length;
      continue;
    }

    const lineBreak = LINEBREAK_RE.exec(rest);
    if (lineBreak) {
      flushLiteral();
      runs.push({ kind: "line-break" });
      index += lineBreak[0].length;
      continue;
    }

    literal += markup[index]!;
    index += 1;
  }
  flushLiteral();
  return { runs };
}

/** Flatten an AST back to a plain string (used by the single-line text input). */
export function flattenMarkup(document: MarkupDocument): string {
  return document.runs.map(flattenRun).join("");
}

function flattenRun(run: MarkupRun): string {
  switch (run.kind) {
    case "text":
      return run.value ?? "";
    case "line-break":
      return " ";
    case "fraction":
      return `${flattenMarkup(run.numerator!)}/${flattenMarkup(run.denominator!)}`;
    case "span":
      return run.children?.map(flattenRun).join("") ?? "";
  }
}
