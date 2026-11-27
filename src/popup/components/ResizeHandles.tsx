import React from 'react';
import { ResizeDirection } from '@/hooks/usePopupResize';

interface ResizeHandlesProps {
  onPointerDown: (
    direction: ResizeDirection,
  ) => (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onReset: () => void;
}

const HANDLES: Array<{
  direction: ResizeDirection;
  className: string;
  label: string;
}> = [
  {
    direction: 'left',
    className: 'pm-resize-handle pm-resize-left',
    label: 'Resize popup horizontally from left edge',
  },
  {
    direction: 'right',
    className: 'pm-resize-handle pm-resize-right',
    label: 'Resize popup horizontally from right edge',
  },
  {
    direction: 'bottom',
    className: 'pm-resize-handle pm-resize-bottom',
    label: 'Resize popup vertically from bottom edge',
  },
  {
    direction: 'bottom-left',
    className: 'pm-resize-handle pm-resize-corner pm-resize-bottom-left',
    label: 'Resize popup from bottom-left corner',
  },
  {
    direction: 'bottom-right',
    className: 'pm-resize-handle pm-resize-corner pm-resize-bottom-right',
    label: 'Resize popup from bottom-right corner',
  },
];

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onReset,
}) => {
  return (
    <>
      {HANDLES.map((h) => (
        <div
          key={h.direction}
          className={h.className}
          role="separator"
          aria-label={h.label}
          title="Drag to resize · Double-click to reset"
          onPointerDown={onPointerDown(h.direction)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onReset}
        />
      ))}
    </>
  );
};

