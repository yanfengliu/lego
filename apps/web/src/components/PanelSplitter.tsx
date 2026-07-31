import { useEffect, useRef } from "react";

export interface PanelSplitterProps {
  /** Which panel the splitter resizes; the left one grows rightwards. */
  readonly side: "left" | "right";
  readonly width: number;
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly onWidthChange: (width: number) => void;
  readonly label: string;
}

const KEYBOARD_STEP_PX = 16;

/**
 * A draggable divider between a side panel and the workspace. Pointer capture
 * keeps the drag alive over the WebGL canvas, which would otherwise swallow the
 * move events and strand the splitter mid-drag.
 */
export function PanelSplitter({
  side,
  width,
  minWidth,
  maxWidth,
  onWidthChange,
  label,
}: PanelSplitterProps) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onWidthChangeRef = useRef(onWidthChange);

  useEffect(() => {
    onWidthChangeRef.current = onWidthChange;
  }, [onWidthChange]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = event.clientX - drag.startX;
      const next = drag.startWidth + (side === "left" ? delta : -delta);
      onWidthChangeRef.current(Math.min(maxWidth, Math.max(minWidth, Math.round(next))));
    };
    const handleUp = () => {
      dragRef.current = null;
      document.body.classList.remove("is-resizing-panels");
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [side, minWidth, maxWidth]);

  return (
    <div
      className="panel-splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        dragRef.current = { startX: event.clientX, startWidth: width };
        document.body.classList.add("is-resizing-panels");
      }}
      onDoubleClick={() => onWidthChange(Math.round((minWidth + maxWidth) / 3))}
      onKeyDown={(event) => {
        const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (direction === 0) return;
        event.preventDefault();
        const step = direction * KEYBOARD_STEP_PX * (side === "left" ? 1 : -1);
        onWidthChange(Math.min(maxWidth, Math.max(minWidth, width + step)));
      }}
    >
      <span aria-hidden="true" />
    </div>
  );
}
