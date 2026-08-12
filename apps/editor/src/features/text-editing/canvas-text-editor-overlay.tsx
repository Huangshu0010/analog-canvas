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
  const viewportInset = 8;
  const targetGap = 8;
  const minX = viewBox.x + viewportInset;
  const maxX = viewBox.x + viewBox.width - width - viewportInset;
  const minY = viewBox.y + viewportInset;
  const maxY = viewBox.y + viewBox.height - height - viewportInset;
  const x = Math.max(minX, Math.min(maxX, bounds.x - 6));
  const above = bounds.y - height - targetGap;
  const below = bounds.y + bounds.height + targetGap;
  const y =
    above >= minY
      ? above
      : below <= maxY
        ? below
        : Math.max(minY, Math.min(maxY, above));
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
    <foreignObject
      data-testid="canvas-text-editor"
      className="canvas-text-editor-overlay"
      pointerEvents="all"
      {...frame}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
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
