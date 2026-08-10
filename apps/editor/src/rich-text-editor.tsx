import { useEffect, useRef } from "react";

import { normalizeRichText } from "@icm/model";
import type { RichTextDocument } from "@icm/model";

type EditableRun =
  | { kind: "text"; value: string }
  | { kind: "line-break" }
  | {
      kind: "span";
      style: "italic" | "bold" | "subscript" | "superscript";
      children: EditableRun[];
    }
  | {
      kind: "fraction";
      numerator: { runs: EditableRun[] };
      denominator: { runs: EditableRun[] };
    };

type EditableDocument = { runs: EditableRun[] };

export interface RichTextEditorProps {
  targetKey: string;
  content: RichTextDocument;
  disabled?: boolean;
  sizeScale: number;
  onChange(content: RichTextDocument): void;
  onSizeChange(sizeScale: number): void;
  onCommit(): void;
  onCancel(): void;
  onDelete(): void;
  onReverseCurrentArrow?(): void;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toEditableHtml(document: EditableDocument): string {
  const render = (run: EditableRun): string => {
    switch (run.kind) {
      case "text":
        return escapeHtml(run.value);
      case "line-break":
        return "<br>";
      case "span": {
        const children = run.children.map(render).join("");
        const tag =
          run.style === "italic"
            ? "em"
            : run.style === "bold"
              ? "strong"
              : run.style === "subscript"
                ? "sub"
                : "sup";
        return `<${tag}>${children}</${tag}>`;
      }
      case "fraction":
        return `<span data-rich-fraction="true" contenteditable="false"><span data-fraction-numerator="true">${toEditableHtml(run.numerator)}</span><span class="rich-text-fraction-rule">/</span><span data-fraction-denominator="true">${toEditableHtml(run.denominator)}</span></span>`;
    }
  };
  return document.runs.map(render).join("");
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE;
}

function readChildren(element: Element): EditableRun[] {
  const runs: EditableRun[] = [];
  for (const child of element.childNodes) runs.push(...readNode(child));
  return runs;
}

function readNode(node: Node): EditableRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? [{ kind: "text", value: node.textContent }] : [];
  }
  if (!isElement(node)) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return [{ kind: "line-break" }];
  if (node.dataset.richFraction === "true") {
    const numerator = node.querySelector("[data-fraction-numerator]");
    const denominator = node.querySelector("[data-fraction-denominator]");
    if (numerator && denominator) {
      return [
        {
          kind: "fraction",
          numerator: { runs: readChildren(numerator) },
          denominator: { runs: readChildren(denominator) },
        },
      ];
    }
  }
  const children = readChildren(node);
  if (tag === "strong" || tag === "b") {
    return [{ kind: "span", style: "bold", children }];
  }
  if (tag === "em" || tag === "i") {
    return [{ kind: "span", style: "italic", children }];
  }
  if (tag === "sub") {
    return [{ kind: "span", style: "subscript", children }];
  }
  if (tag === "sup") {
    return [{ kind: "span", style: "superscript", children }];
  }
  if (tag === "div" || tag === "p") {
    return [...children, { kind: "line-break" }];
  }
  return children;
}

function editableDocument(element: HTMLElement): RichTextDocument {
  const document = { runs: readChildren(element) } as EditableDocument;
  if (document.runs.length === 0) {
    return { runs: [{ kind: "text", value: " " }] } as RichTextDocument;
  }
  return normalizeRichText(document) as unknown as RichTextDocument;
}

export function RichTextEditor({
  targetKey,
  content,
  disabled = false,
  sizeScale,
  onChange,
  onSizeChange,
  onCommit,
  onCancel,
  onDelete,
  onReverseCurrentArrow,
}: RichTextEditorProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const selectionRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    if (editableRef.current) {
      editableRef.current.innerHTML = toEditableHtml(
        content as unknown as EditableDocument,
      );
      editableRef.current.focus();
    }
  }, [targetKey]);

  const sync = (): void => {
    if (editableRef.current) onChange(editableDocument(editableRef.current));
  };

  const rememberSelection = (): void => {
    const editable = editableRef.current;
    const selection = window.getSelection();
    if (
      !editable ||
      !selection ||
      selection.rangeCount === 0 ||
      !editable.contains(selection.anchorNode) ||
      !editable.contains(selection.focusNode)
    ) {
      return;
    }
    selectionRangeRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = (): void => {
    const range = selectionRangeRef.current;
    const selection = window.getSelection();
    if (!range || !selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const command = (name: "bold" | "italic" | "subscript" | "superscript") => {
    if (disabled || !editableRef.current) return;
    editableRef.current.focus();
    restoreSelection();
    document.execCommand(name);
    rememberSelection();
    sync();
  };

  return (
    <div
      className="rich-text-editor-shell"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="rich-text-floating-toolbar"
        role="toolbar"
        aria-label="Text formatting"
      >
        <button
          type="button"
          aria-label="Bold"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("bold")}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          aria-label="Italic"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("italic")}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          aria-label="Subscript"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("subscript")}
        >
          x<sub>2</sub>
        </button>
        <button
          type="button"
          aria-label="Superscript"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("superscript")}
        >
          x<sup>2</sup>
        </button>
        <span className="rich-text-toolbar-separator" />
        <button
          type="button"
          aria-label="Decrease text size"
          disabled={disabled || sizeScale <= 0.5}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            onSizeChange(Math.max(0.5, Math.round((sizeScale - 0.1) * 10) / 10))
          }
        >
          A-
        </button>
        <button
          type="button"
          aria-label="Increase text size"
          disabled={disabled || sizeScale >= 3}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            onSizeChange(Math.min(3, Math.round((sizeScale + 0.1) * 10) / 10))
          }
        >
          A+
        </button>
        <button
          type="button"
          aria-label="Apply text changes"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCommit}
        >
          Apply
        </button>
        <button
          type="button"
          aria-label="Delete text"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onDelete}
        >
          Delete
        </button>
        {onReverseCurrentArrow ? (
          <button
            type="button"
            aria-label="Reverse current arrow"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onReverseCurrentArrow}
          >
            Reverse arrow
          </button>
        ) : null}
      </div>
      <div
        ref={editableRef}
        className="rich-text-editable"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label="Canvas text editor"
        aria-multiline="true"
        style={{ fontSize: `${15.116 * sizeScale}px` }}
        onInput={sync}
        onSelect={rememberSelection}
        onKeyUp={rememberSelection}
        onPointerUp={rememberSelection}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "Enter" && event.ctrlKey) {
            event.preventDefault();
            onCommit();
          } else if (event.ctrlKey && event.key.toLowerCase() === "b") {
            event.preventDefault();
            command("bold");
          } else if (event.ctrlKey && event.key.toLowerCase() === "i") {
            event.preventDefault();
            command("italic");
          }
        }}
      />
    </div>
  );
}
