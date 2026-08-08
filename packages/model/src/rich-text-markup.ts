// ADR 0010: shared, bounded markup <-> RichText AST conversion. Persisted
// RichText is the truth; markup is only a reversible editing/input syntax.

export type MarkupRun =
  | { kind: "text"; value: string }
  | { kind: "line-break" }
  | {
      kind: "span";
      style: "italic" | "bold" | "subscript" | "superscript";
      children: MarkupRun[];
    }
  | {
      kind: "fraction";
      numerator: MarkupDocument;
      denominator: MarkupDocument;
    };

export interface MarkupDocument {
  runs: MarkupRun[];
}

const MAX_COMMAND_DEPTH = 4;

type ParsedBody = {
  document: MarkupDocument;
  closed: boolean;
};

class MarkupParser {
  private index = 0;

  public constructor(private readonly source: string) {}

  public parse(): MarkupDocument {
    return this.parseRuns(0, false).document;
  }

  private parseRuns(depth: number, stopAtClosingBrace: boolean): ParsedBody {
    const runs: MarkupRun[] = [];
    let literal = "";

    const flushLiteral = (): void => {
      if (literal.length === 0) return;
      runs.push({ kind: "text", value: literal });
      literal = "";
    };
    const pushRun = (run: MarkupRun): void => {
      flushLiteral();
      runs.push(run);
    };

    while (this.index < this.source.length) {
      if (stopAtClosingBrace && this.source[this.index] === "}") {
        this.index += 1;
        flushLiteral();
        return { document: { runs }, closed: true };
      }

      if (this.consume("\\backslash{}")) {
        literal += "\\";
        continue;
      }
      if (this.consume("\\n")) {
        pushRun({ kind: "line-break" });
        continue;
      }
      if (this.consume("\\\\")) {
        literal += "\\";
        continue;
      }
      if (this.consume("\\{")) {
        literal += "{";
        continue;
      }
      if (this.consume("\\}")) {
        literal += "}";
        continue;
      }

      if (depth < MAX_COMMAND_DEPTH) {
        const structured =
          this.tryFraction(depth) ??
          this.trySpan("\\it{", "italic", depth) ??
          this.trySpan("\\bf{", "bold", depth) ??
          this.trySpan("_{", "subscript", depth) ??
          this.trySpan("^{", "superscript", depth);
        if (structured) {
          if (structured.kind === "text") literal += structured.value;
          else pushRun(structured);
          continue;
        }
      }

      literal += this.source[this.index]!;
      this.index += 1;
    }

    flushLiteral();
    return { document: { runs }, closed: !stopAtClosingBrace };
  }

  private trySpan(
    prefix: string,
    style: Extract<MarkupRun, { kind: "span" }>["style"],
    depth: number,
  ): MarkupRun | null {
    if (!this.source.startsWith(prefix, this.index)) return null;
    const start = this.index;
    this.index += prefix.length;
    const body = this.parseRuns(depth + 1, true);
    const source = this.source.slice(start, this.index);
    if (!body.closed || body.document.runs.length === 0) {
      return { kind: "text", value: source };
    }
    return { kind: "span", style, children: body.document.runs };
  }

  private tryFraction(depth: number): MarkupRun | null {
    const prefix = "\\frac{";
    if (!this.source.startsWith(prefix, this.index)) return null;
    const start = this.index;
    this.index += prefix.length;
    const numerator = this.parseRuns(depth + 1, true);
    if (
      !numerator.closed ||
      numerator.document.runs.length === 0 ||
      this.source[this.index] !== "{"
    ) {
      return { kind: "text", value: this.source.slice(start, this.index) };
    }
    this.index += 1;
    const denominator = this.parseRuns(depth + 1, true);
    const source = this.source.slice(start, this.index);
    if (!denominator.closed || denominator.document.runs.length === 0) {
      return { kind: "text", value: source };
    }
    return {
      kind: "fraction",
      numerator: numerator.document,
      denominator: denominator.document,
    };
  }

  private consume(token: string): boolean {
    if (!this.source.startsWith(token, this.index)) return false;
    this.index += token.length;
    return true;
  }
}

/** Parse bounded input markup. Malformed/empty commands remain literal text. */
export function parseMarkup(markup: string): MarkupDocument {
  return new MarkupParser(markup).parse();
}

function escapeText(value: string): string {
  return [...value]
    .map((character) => {
      if (character === "\\") return "\\\\";
      if (character === "{") return "\\{";
      if (character === "}") return "\\}";
      return character;
    })
    .join("");
}

/** Serialize every schema-valid RichText AST into reversible markup. */
export function serializeMarkup(document: MarkupDocument): string {
  return document.runs.map(serializeRun).join("");
}

function serializeRun(run: MarkupRun): string {
  switch (run.kind) {
    case "text":
      return escapeText(run.value);
    case "line-break":
      return "\\n";
    case "fraction":
      return `\\frac{${serializeMarkup(run.numerator)}}{${serializeMarkup(run.denominator)}}`;
    case "span": {
      const children = serializeMarkup({ runs: run.children });
      switch (run.style) {
        case "italic":
          return `\\it{${children}}`;
        case "bold":
          return `\\bf{${children}}`;
        case "subscript":
          return `_{${children}}`;
        case "superscript":
          return `^{${children}}`;
      }
    }
  }
}

/** Lossy plain-text projection for search and accessibility only. */
export function flattenRichText(document: MarkupDocument): string {
  return document.runs.map(flattenRun).join("");
}

function flattenRun(run: MarkupRun): string {
  switch (run.kind) {
    case "text":
      return run.value;
    case "line-break":
      return "\n";
    case "fraction":
      return `${flattenRichText(run.numerator)}/${flattenRichText(run.denominator)}`;
    case "span":
      return run.children.map(flattenRun).join("");
  }
}

/** Canonicalize text-run boundaries recursively before structural equality. */
export function normalizeRichText(document: MarkupDocument): MarkupDocument {
  const normalized: MarkupRun[] = [];
  const append = (run: MarkupRun): void => {
    if (run.kind === "text") {
      if (run.value.length === 0) return;
      const previous = normalized.at(-1);
      if (previous?.kind === "text") {
        previous.value += run.value;
      } else {
        normalized.push({ ...run });
      }
      return;
    }
    if (run.kind === "span") {
      normalized.push({
        ...run,
        children: normalizeRichText({ runs: run.children }).runs,
      });
      return;
    }
    if (run.kind === "fraction") {
      normalized.push({
        ...run,
        numerator: normalizeRichText(run.numerator),
        denominator: normalizeRichText(run.denominator),
      });
      return;
    }
    normalized.push(run);
  };
  document.runs.forEach(append);
  return { runs: normalized };
}
