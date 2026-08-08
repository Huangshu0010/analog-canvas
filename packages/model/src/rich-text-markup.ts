// ADR 0010 WP-R3/P0-1: the shared, reversible markup <-> RichText AST
// converter. Lives in the model so the editor, renderer, and Agent all use one
// implementation, and editing is lossless for ANY valid AST (parseMarkup,
// migration, direct JSON, future importers).
//
// Grammar (reversible):
//   \n                -> line-break
//   \\                -> literal backslash
//   \{                -> literal {
//   \}                -> literal }
//   _{...}            -> subscript span (body may contain one nested {..})
//   ^{...}            -> superscript span
//   \it{...}          -> italic span
//   \bf{...}          -> bold span
//   \frac{num}{den}   -> fraction
//   any other \x      -> preserved verbatim (e.g. \Omega stays \Omega)
//   any other text    -> literal text
//
// Unparseable input is preserved as literal text (never dropped).

// The model's RichTextRun is inferred from a recursive Zod builder and is too
// loose to switch on; define the exact structural union here so parsing and
// serialization are type-safe. It is structurally identical to the persisted
// AST.
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

    // Escaped characters anywhere in the stream: \n is a line break; \\, \{,
    // \} are literal characters; any other \x is preserved verbatim.
    if (rest[0] === "\\" && rest.length >= 2) {
      const escaped = rest[1]!;
      if (escaped === "n") {
        flushLiteral();
        runs.push({ kind: "line-break" });
        index += 2;
        continue;
      }
      if (escaped === "\\" || escaped === "{" || escaped === "}") {
        literal += escaped;
        index += 2;
        continue;
      }
    }

    literal += markup[index]!;
    index += 1;
  }
  flushLiteral();
  return { runs };
}

function escapeText(value: string): string {
  let result = "";
  for (const char of value) {
    if (char === "\\") result += "\\\\";
    else if (char === "{") result += "\\{";
    else if (char === "}") result += "\\}";
    else result += char;
  }
  return result;
}

/**
 * Serialize an AST back to reversible markup. For ANY valid AST,
 * parseMarkup(serializeMarkup(ast)) structurally equals ast, because every
 * literal backslash/brace in a text run is escaped and line breaks use \n.
 */
export function serializeMarkup(document: MarkupDocument): string {
  return document.runs.map(serializeRun).join("");
}

function serializeRun(run: MarkupRun): string {
  switch (run.kind) {
    case "text":
      return escapeText(run.value ?? "");
    case "line-break":
      return "\\n";
    case "fraction":
      return `\\frac{${serializeMarkup(run.numerator!)}}{${serializeMarkup(run.denominator!)}}`;
    case "span": {
      const children = serializeMarkup({ runs: run.children ?? [] });
      switch (run.style) {
        case "italic":
          return `\\it{${children}}`;
        case "bold":
          return `\\bf{${children}}`;
        case "subscript":
          return `_{${children}}`;
        case "superscript":
          return `^{${children}}`;
        default:
          return children;
      }
    }
  }
}

/** Flatten an AST back to a plain, lossy string (search/accessibility only). */
export function flattenRichText(document: MarkupDocument): string {
  return document.runs.map(flattenRun).join("");
}

function flattenRun(run: MarkupRun): string {
  switch (run.kind) {
    case "text":
      return run.value ?? "";
    case "line-break":
      return " ";
    case "fraction":
      return `${flattenRichText(run.numerator!)}/${flattenRichText(run.denominator!)}`;
    case "span":
      return run.children?.map(flattenRun).join("") ?? "";
  }
}

/**
 * Normalize a RichText AST: merge adjacent text runs so structurally
 * equivalent documents compare equal. parseMarkup(serializeMarkup(ast))
 * may split a literal into one text run (parseMarkup coalesces), so equality
 * checks between a constructed AST and a round-tripped one use this.
 */
export function normalizeRichText(document: MarkupDocument): MarkupDocument {
  const normalized: MarkupRun[] = [];
  for (const run of document.runs) {
    if (run.kind === "text") {
      const previous = normalized.at(-1);
      if (previous?.kind === "text") {
        normalized[normalized.length - 1] = {
          ...previous,
          value: (previous.value ?? "") + (run.value ?? ""),
        };
        continue;
      }
      if ((run.value ?? "") === "") continue;
      normalized.push(run);
      continue;
    }
    if (run.kind === "span") {
      normalized.push({
        ...run,
        children: normalizeRichText({ runs: run.children ?? [] }).runs,
      });
      continue;
    }
    normalized.push(run);
  }
  return { runs: normalized };
}
