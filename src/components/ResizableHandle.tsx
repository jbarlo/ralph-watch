'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { UseResizablePanelReturn } from '@/hooks/use-resizable-panel';

interface ResizableHandleProps {
  panel: UseResizablePanelReturn;
  /** 'left' means dragging from the left edge (resizes to the right), 'right' means dragging from right edge (resizes to the left) */
  edge: 'left' | 'right';
  className?: string;
}

export function ResizableHandle({
  panel,
  edge,
  className,
}: ResizableHandleProps) {
  const { isDragging, setIsDragging, setWidth, isCollapsed, storedWidth } =
    panel;
  const handleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      let newWidth: number;

      if (edge === 'left') {
        // Dragging left edge: moving left increases width, moving right decreases
        newWidth = startWidthRef.current - deltaX;
      } else {
        // Dragging right edge: moving right increases width, moving left decreases
        newWidth = startWidthRef.current + deltaX;
      }
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setIsDragging, setWidth, edge]);

  if (isCollapsed) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = storedWidth;
    setIsDragging(true);
  };

  return (
    <div
      ref={handleRef}
      className={cn(
        'w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0',
        isDragging && 'bg-primary',
        className,
      )}
      onMouseDown={handleMouseDown}
    />
  );
}
