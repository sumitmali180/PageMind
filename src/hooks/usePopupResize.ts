import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export const DEFAULT_POPUP_WIDTH = 420;
export const DEFAULT_POPUP_HEIGHT = 580;
export const MIN_POPUP_WIDTH = 300;
export const MAX_POPUP_WIDTH = 800;
export const MIN_POPUP_HEIGHT = 320;
export const MAX_POPUP_HEIGHT = 760;

export type ResizeDirection =
  | 'left'
  | 'right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right';

export interface PopupSize {
  width: number;
  height: number;
}

interface DragState {
  direction: ResizeDirection;
  startScreenX: number;
  startScreenY: number;
  startWidth: number;
  startHeight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Manages interactive mouse/pointer resizing for the extension popup.
 * Dimensions live only in memory so reopening the popup always resets to default.
 */
export function usePopupResize() {
  const [size, setSize] = useState<PopupSize>({
    width: DEFAULT_POPUP_WIDTH,
    height: DEFAULT_POPUP_HEIGHT,
  });
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pm-popup-width', `${size.width}px`);
    root.style.setProperty('--pm-popup-height', `${size.height}px`);
  }, [size.width, size.height]);

  const handlePointerDown = useCallback(
    (direction: ResizeDirection) => (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const startScreenX = Number.isFinite(e.screenX) ? e.screenX : e.clientX;
      const startScreenY = Number.isFinite(e.screenY) ? e.screenY : e.clientY;
      if (!Number.isFinite(startScreenX) || !Number.isFinite(startScreenY)) return;
      e.preventDefault();
      dragRef.current = {
        direction,
        startScreenX,
        startScreenY,
        startWidth: size.width,
        startHeight: size.height,
      };
      setIsResizing(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [size.height, size.width],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const currentX = Number.isFinite(e.screenX) ? e.screenX : e.clientX;
    const currentY = Number.isFinite(e.screenY) ? e.screenY : e.clientY;
    if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) return;

    const dx = currentX - drag.startScreenX;
    const dy = currentY - drag.startScreenY;

    let nextWidth = drag.startWidth;
    let nextHeight = drag.startHeight;

    if (drag.direction === 'left' || drag.direction === 'bottom-left') {
      nextWidth = drag.startWidth - dx;
    } else if (drag.direction === 'right' || drag.direction === 'bottom-right') {
      nextWidth = drag.startWidth + dx;
    }

    if (
      drag.direction === 'bottom' ||
      drag.direction === 'bottom-left' ||
      drag.direction === 'bottom-right'
    ) {
      nextHeight = drag.startHeight + dy;
    }

    setSize({
      width: clamp(nextWidth, MIN_POPUP_WIDTH, MAX_POPUP_WIDTH),
      height: clamp(nextHeight, MIN_POPUP_HEIGHT, MAX_POPUP_HEIGHT),
    });
  }, []);

  const stopResize = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsResizing(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  }, []);

  const resetSize = useCallback(() => {
    setSize({
      width: DEFAULT_POPUP_WIDTH,
      height: DEFAULT_POPUP_HEIGHT,
    });
  }, []);

  return {
    size,
    isResizing,
    handlePointerDown,
    handlePointerMove,
    stopResize,
    resetSize,
  };
}
