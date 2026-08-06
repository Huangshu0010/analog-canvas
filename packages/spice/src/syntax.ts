import type { SourceSpan } from "@icm/model";

import { diagnostic } from "./diagnostics.js";
import type { SpiceDiagnostic } from "./diagnostics.js";
import type { SpiceSourceFile } from "./source-types.js";

export interface LogicalLine {
  fileId: string;
  text: string;
  rawText: string;
  sourceRef: SourceSpan;
  physicalLines: number[];
  orphanContinuation: boolean;
}

export interface RawSpiceParameter {
  name: string;
  rawText: string;
  sourceRef: SourceSpan;
}

interface StatementBase {
  rawText: string;
  sourceRef: SourceSpan;
}

export interface IncludeStatement extends StatementBase {
  kind: "include";
  requestedPath: string;
}

export interface SubcircuitStartStatement extends StatementBase {
  kind: "subckt_start";
  name: string;
  ports: string[];
  parameters: RawSpiceParameter[];
}

export interface SubcircuitEndStatement extends StatementBase {
  kind: "subckt_end";
  name?: string;
}

export interface ParameterStatement extends StatementBase {
  kind: "parameter";
  parameters: RawSpiceParameter[];
}

export interface ModelStatement extends StatementBase {
  kind: "model";
  name: string;
  modelType: string;
  rawParameters: string;
}

export interface GlobalStatement extends StatementBase {
  kind: "global";
  names: string[];
}

export type CurrentInstanceFamily =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "voltage-source"
  | "current-source"
  | "vcvs"
  | "vccs"
  | "cccs"
  | "ccvs"
  | "diode"
  | "bjt"
  | "switch"
  | "mosfet"
  | "subcircuit";

export interface InstanceStatement extends StatementBase {
  kind: "instance";
  name: string;
  family: CurrentInstanceFamily;
  nodes: string[];
  parameters: RawSpiceParameter[];
  master?: string;
  controlSource?: string;
}

export interface OpaqueSyntaxStatement extends StatementBase {
  kind: "opaque";
  probableType?: "element" | "directive" | "control";
  reason: string;
}

export type SpiceStatement =
  | IncludeStatement
  | SubcircuitStartStatement
  | SubcircuitEndStatement
  | ParameterStatement
  | ModelStatement
  | GlobalStatement
  | InstanceStatement
  | OpaqueSyntaxStatement;

export interface SpiceSyntaxFile {
  fileId: string;
  statements: SpiceStatement[];
  logicalLines: LogicalLine[];
  diagnostics: SpiceDiagnostic[];
}

interface PhysicalLine {
  content: string;
  startOffset: number;
  contentEndOffset: number;
  lineNumber: number;
}

function physicalLines(text: string): PhysicalLine[] {
  const result: PhysicalLine[] = [];
  let offset = 0;
  let lineNumber = 1;
  while (offset < text.length) {
    let cursor = offset;
    while (
      cursor < text.length &&
      text[cursor] !== "\n" &&
      text[cursor] !== "\r"
    ) {
      cursor += 1;
    }
    result.push({
      content: text.slice(offset, cursor),
      startOffset: offset,
      contentEndOffset: cursor,
      lineNumber,
    });
    if (text[cursor] === "\r" && text[cursor + 1] === "\n") {
      cursor += 2;
    } else if (cursor < text.length) {
      cursor += 1;
    }
    offset = cursor;
    lineNumber += 1;
  }
  return result;
}

function stripInlineComment(text: string): string {
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "$" || character === ";") {
      return text.slice(0, index).trimEnd();
    }
  }
  return text.trimEnd();
}

export function buildLogicalLines(source: SpiceSourceFile): LogicalLine[] {
  const physical = physicalLines(source.text);
  const logical: LogicalLine[] = [];
  let pending:
    | {
        first: PhysicalLine;
        last: PhysicalLine;
        parts: string[];
        lines: number[];
        orphanContinuation: boolean;
      }
    | undefined;

  function flush(): void {
    if (!pending) {
      return;
    }
    logical.push({
      fileId: source.id,
      text: pending.parts
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" "),
      rawText: source.text.slice(
        pending.first.startOffset,
        pending.last.contentEndOffset,
      ),
      sourceRef: {
        fileId: source.id,
        start: {
          offset: pending.first.startOffset,
          line: pending.first.lineNumber,
          column: 1,
        },
        end: {
          offset: pending.last.contentEndOffset,
          line: pending.last.lineNumber,
          column: pending.last.content.length + 1,
        },
      },
      physicalLines: pending.lines,
      orphanContinuation: pending.orphanContinuation,
    });
    pending = undefined;
  }

  for (const line of physical) {
    const trimmed = line.content.trimStart();
    if (!trimmed || trimmed.startsWith("*")) {
      continue;
    }
    const cleaned = stripInlineComment(line.content);
    if (!cleaned.trim()) {
      continue;
    }
    const continuation = cleaned.trimStart().startsWith("+");
    if (continuation) {
      const part = cleaned.trimStart().slice(1).trimStart();
      if (pending) {
        pending.last = line;
        pending.parts.push(part);
        pending.lines.push(line.lineNumber);
      } else {
        pending = {
          first: line,
          last: line,
          parts: [part],
          lines: [line.lineNumber],
          orphanContinuation: true,
        };
      }
      continue;
    }
    flush();
    pending = {
      first: line,
      last: line,
      parts: [cleaned],
      lines: [line.lineNumber],
      orphanContinuation: false,
    };
  }
  flush();
  return logical;
}

export function splitSpiceFields(text: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let parentheses = 0;
  let braces = 0;
  for (const character of text.trim()) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      current += character;
      quote = character;
      continue;
    }
    if (character === "(") parentheses += 1;
    if (character === ")") parentheses -= 1;
    if (character === "{") braces += 1;
    if (character === "}") braces -= 1;
    if (/\s/u.test(character) && parentheses === 0 && braces === 0) {
      if (current) {
        fields.push(current);
        current = "";
      }
    } else {
      current += character;
    }
  }
  if (current) {
    fields.push(current);
  }
  return fields;
}

function parametersFromTokens(
  tokens: string[],
  sourceRef: SourceSpan,
): RawSpiceParameter[] {
  const result: RawSpiceParameter[] = [];
  for (const originalToken of tokens) {
    const token = originalToken.replace(/^\(/u, "").replace(/\)$/u, "");
    if (!token || token.toLowerCase() === "params:") continue;
    const separator = token.indexOf("=");
    if (separator <= 0) continue;
    result.push({
      name: token.slice(0, separator),
      rawText: token.slice(separator + 1),
      sourceRef,
    });
  }
  return result;
}

function positionalAndParameters(
  tokens: string[],
  sourceRef: SourceSpan,
): { positional: string[]; parameters: RawSpiceParameter[] } {
  const firstParameter = tokens.findIndex(
    (token) => token.toLowerCase() === "params:" || token.includes("="),
  );
  if (firstParameter < 0) {
    return { positional: tokens, parameters: [] };
  }
  return {
    positional: tokens.slice(0, firstParameter),
    parameters: parametersFromTokens(tokens.slice(firstParameter), sourceRef),
  };
}

function opaque(
  line: LogicalLine,
  reason: string,
  probableType: OpaqueSyntaxStatement["probableType"],
  severity: "warning" | "error" = "warning",
): { statement: OpaqueSyntaxStatement; diagnostic: SpiceDiagnostic } {
  return {
    statement: {
      kind: "opaque",
      rawText: line.rawText,
      sourceRef: line.sourceRef,
      reason,
      ...(probableType ? { probableType } : {}),
    },
    diagnostic: diagnostic(
      severity === "error" ? "SPICE_SYNTAX_MALFORMED" : "SPICE_SYNTAX_OPAQUE",
      severity,
      "syntax",
      `Statement preserved as opaque: ${reason}`,
      line.sourceRef,
    ),
  };
}

function valueParameter(
  name: string,
  rawText: string | undefined,
  sourceRef: SourceSpan,
): RawSpiceParameter[] {
  return rawText ? [{ name, rawText, sourceRef }] : [];
}

function parseInstance(
  fields: string[],
  line: LogicalLine,
): { statement: SpiceStatement; diagnostic?: SpiceDiagnostic } {
  const name = fields[0] ?? "";
  const prefix = name.slice(0, 1).toUpperCase();
  const { positional, parameters } = positionalAndParameters(
    fields.slice(1),
    line.sourceRef,
  );
  const base = { name, rawText: line.rawText, sourceRef: line.sourceRef };
  const malformed = (reason: string) =>
    opaque(line, reason, "element", "error");

  const simple: Record<
    string,
    { family: CurrentInstanceFamily; nodes: number; value: string }
  > = {
    R: { family: "resistor", nodes: 2, value: "value" },
    C: { family: "capacitor", nodes: 2, value: "value" },
    L: { family: "inductor", nodes: 2, value: "value" },
    V: { family: "voltage-source", nodes: 2, value: "value" },
    I: { family: "current-source", nodes: 2, value: "value" },
    E: { family: "vcvs", nodes: 4, value: "gain" },
    G: { family: "vccs", nodes: 4, value: "gain" },
  };
  const shape = simple[prefix];
  if (shape) {
    if (positional.length < shape.nodes + 1) {
      return malformed(
        `${prefix} instance requires ${shape.nodes} nodes and a ${shape.value}`,
      );
    }
    return {
      statement: {
        kind: "instance",
        ...base,
        family: shape.family,
        nodes: positional.slice(0, shape.nodes),
        parameters: [
          ...parameters,
          ...valueParameter(
            shape.value,
            positional[shape.nodes],
            line.sourceRef,
          ),
        ],
      },
    };
  }
  if (prefix === "F" || prefix === "H") {
    if (positional.length < 4) {
      return malformed(
        `${prefix} instance requires two nodes, a control source, and gain`,
      );
    }
    return {
      statement: {
        kind: "instance",
        ...base,
        family: prefix === "F" ? "cccs" : "ccvs",
        nodes: positional.slice(0, 2),
        controlSource: positional[2]!,
        parameters: [
          ...parameters,
          ...valueParameter("gain", positional[3], line.sourceRef),
        ],
      },
    };
  }
  const modeled: Record<
    string,
    { family: CurrentInstanceFamily; minimumNodes: number }
  > = {
    D: { family: "diode", minimumNodes: 2 },
    Q: { family: "bjt", minimumNodes: 3 },
    S: { family: "switch", minimumNodes: 4 },
    M: { family: "mosfet", minimumNodes: 4 },
  };
  const modeledShape = modeled[prefix];
  if (modeledShape) {
    if (positional.length < modeledShape.minimumNodes + 1) {
      return malformed(`${prefix} instance is missing nodes or model`);
    }
    return {
      statement: {
        kind: "instance",
        ...base,
        family: modeledShape.family,
        nodes: positional.slice(0, -1),
        master: positional.at(-1)!,
        parameters,
      },
    };
  }
  if (prefix === "X") {
    if (positional.length < 2) {
      return malformed("X instance requires at least one node and a master");
    }
    return {
      statement: {
        kind: "instance",
        ...base,
        family: "subcircuit",
        nodes: positional.slice(0, -1),
        master: positional.at(-1)!,
        parameters,
      },
    };
  }
  return opaque(line, "unsupported element family", "element");
}

function parseLogicalLine(line: LogicalLine): {
  statement: SpiceStatement;
  diagnostic?: SpiceDiagnostic;
} {
  if (line.orphanContinuation) {
    return opaque(line, "orphan continuation", "element", "error");
  }
  const fields = splitSpiceFields(line.text);
  const keyword = fields[0]?.toLowerCase() ?? "";
  const rawText = line.rawText;
  const sourceRef = line.sourceRef;
  if (keyword === ".include") {
    const requestedPath = fields[1]?.replace(/^(?:"|')|(?:"|')$/gu, "");
    if (!requestedPath)
      return opaque(line, "include path is missing", "directive", "error");
    return {
      statement: { kind: "include", requestedPath, rawText, sourceRef },
    };
  }
  if (keyword === ".subckt") {
    const name = fields[1];
    if (!name)
      return opaque(line, "subckt name is missing", "directive", "error");
    const { positional, parameters } = positionalAndParameters(
      fields.slice(2),
      sourceRef,
    );
    return {
      statement: {
        kind: "subckt_start",
        name,
        ports: positional,
        parameters,
        rawText,
        sourceRef,
      },
    };
  }
  if (keyword === ".ends") {
    const name = fields[1];
    return {
      statement: {
        kind: "subckt_end",
        ...(name ? { name } : {}),
        rawText,
        sourceRef,
      },
    };
  }
  if (keyword === ".param") {
    const parameters = parametersFromTokens(fields.slice(1), sourceRef);
    if (parameters.length === 0)
      return opaque(line, "param assignment is missing", "directive", "error");
    return { statement: { kind: "parameter", parameters, rawText, sourceRef } };
  }
  if (keyword === ".model") {
    if (!fields[1] || !fields[2])
      return opaque(
        line,
        "model name or type is missing",
        "directive",
        "error",
      );
    return {
      statement: {
        kind: "model",
        name: fields[1],
        modelType: fields[2],
        rawParameters: fields.slice(3).join(" "),
        rawText,
        sourceRef,
      },
    };
  }
  if (keyword === ".global") {
    if (fields.length < 2)
      return opaque(line, "global net list is missing", "directive", "error");
    return {
      statement: { kind: "global", names: fields.slice(1), rawText, sourceRef },
    };
  }
  if (keyword.startsWith(".")) {
    return opaque(line, `unsupported directive ${keyword}`, "directive");
  }
  return parseInstance(fields, line);
}

export function parseSpiceSource(source: SpiceSourceFile): SpiceSyntaxFile {
  const logicalLines = buildLogicalLines(source);
  const statements: SpiceStatement[] = [];
  const diagnostics: SpiceDiagnostic[] = [];
  for (const line of logicalLines) {
    const parsed = parseLogicalLine(line);
    statements.push(parsed.statement);
    if (parsed.diagnostic) diagnostics.push(parsed.diagnostic);
  }
  return { fileId: source.id, statements, logicalLines, diagnostics };
}
