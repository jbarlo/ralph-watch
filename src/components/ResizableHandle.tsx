'use client';

import { useEffect } from 'react';
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
  const { isDragging, setIsDragging, setWidth, isCollapsed } = panel;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth: number;
      if (edge === 'left') {
        newWidth = window.innerWidth - e.clientX;
      } else {
        newWidth = e.clientX;
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

  return (
    <div
      className={cn(
        'w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0',
        isDragging && 'bg-primary',
        className,
      )}
      onMouseDown={panel.startDrag}
    />
  );
}
