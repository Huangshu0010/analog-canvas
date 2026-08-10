import type { Rect } from "@icm/model";

import { RichTextEditor } from "./rich-text-editor";
import type { TextEditingSession } from "./text-editing";

type TextEditingUpdate = Partial<
  Pick<TextEditingSession, "content" | "sizeScale">
>;

export interface CanvasTextEditorOverlayProps {
  session: TextEditingSession;
  bounds: Rect;
  viewBox: Rect;
  disabled: boolean;
  onUpdate(change: TextEditingUpdate): void;
  onCommit(): void;
  onCancel(): void;
  onDelete(): void;
  onReverseCurrentArrow?(): void;
}

export function resolveCanvasTextEditorFrame(
  bounds: Rect,
  viewBox: Rect,
  sizeScale: number,
): Rect {
  const width = Math.min(Math.max(420, bounds.width + 12), viewBox.width - 16);
  const height = Math.min(
    Math.max(110, bounds.height + 68, 78 + 15.116 * sizeScale * 1.3),
    viewBox.height - 16,
  );
  const x = Math.max(
    viewBox.x + 8,
    Math.min(viewBox.x + viewBox.width - width - 8, bounds.x - 6),
  );
  const y = Math.max(
    viewBox.y + 8,
    Math.min(viewBox.y + viewBox.height - height - 8, bounds.y - 58),
  );
  return { x, y, width, height };
}

export function CanvasTextEditorOverlay({
  session,
  bounds,
  viewBox,
  disabled,
  onUpdate,
  onCommit,
  onCancel,
  onDelete,
  onReverseCurrentArrow,
}: CanvasTextEditorOverlayProps) {
  const frame = resolveCanvasTextEditorFrame(
    bounds,
    viewBox,
    session.sizeScale,
  );

  return (
    <foreignObject data-testid="canvas-text-editor" {...frame}>
      <RichTextEditor
        targetKey={`${session.owner}:${session.id}`}
        content={session.content}
        disabled={disabled}
        sizeScale={session.sizeScale}
        onChange={(content) => onUpdate({ content })}
        onSizeChange={(sizeScale) => onUpdate({ sizeScale })}
        onCommit={onCommit}
        onCancel={onCancel}
        onDelete={onDelete}
        {...(onReverseCurrentArrow ? { onReverseCurrentArrow } : {})}
      />
    </foreignObject>
  );
}
