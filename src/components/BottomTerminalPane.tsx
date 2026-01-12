'use client';

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { Terminal } from '@/components/Terminal';
import { Button } from '@/components/ui/button';
import {
  ChevronUp,
  ChevronDown,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY_VISIBLE = 'ralph-terminal-visible';
const STORAGE_KEY_HEIGHT = 'ralph-terminal-height';
const DEFAULT_HEIGHT = 300;
const MIN_HEIGHT = 100;
const MAX_HEIGHT_RATIO = 0.6; // 60vh

function getStoredVisibility(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_VISIBLE) === 'true';
  } catch {
    return false;
  }
}

function getStoredHeight(): number {
  if (typeof window === 'undefined') return DEFAULT_HEIGHT;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HEIGHT);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_HEIGHT) {
        return parsed;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_HEIGHT;
}

const visibilityListeners = new Set<() => void>();
let visibilitySnapshot = getStoredVisibility();

function subscribeVisibility(callback: () => void): () => void {
  visibilityListeners.add(callback);
  return () => visibilityListeners.delete(callback);
}

function getVisibilitySnapshot(): boolean {
  return visibilitySnapshot;
}

function getVisibilityServerSnapshot(): boolean {
  return false;
}

function setVisibility(value: boolean): void {
  visibilitySnapshot = value;
  try {
    localStorage.setItem(STORAGE_KEY_VISIBLE, String(value));
  } catch {
    // localStorage unavailable
  }
  visibilityListeners.forEach((cb) => cb());
}

const heightListeners = new Set<() => void>();
let heightSnapshot = getStoredHeight();

function subscribeHeight(callback: () => void): () => void {
  heightListeners.add(callback);
  return () => heightListeners.delete(callback);
}

function getHeightSnapshot(): number {
  return heightSnapshot;
}

function getHeightServerSnapshot(): number {
  return DEFAULT_HEIGHT;
}

function setHeightSnapshot(value: number): void {
  heightSnapshot = value;
  try {
    localStorage.setItem(STORAGE_KEY_HEIGHT, String(value));
  } catch {
    // localStorage unavailable
  }
  heightListeners.forEach((cb) => cb());
}

/**
 * Hook to get current terminal pane height (for adding content padding)
 */
export function useTerminalHeight(): number {
  const isVisible = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot,
  );
  const height = useSyncExternalStore(
    subscribeHeight,
    getHeightSnapshot,
    getHeightServerSnapshot,
  );
  return isVisible ? height : 0;
}

interface BottomTerminalPaneProps {
  projectPath: string;
}

export function BottomTerminalPane({ projectPath }: BottomTerminalPaneProps) {
  const isVisible = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot,
  );
  const height = useSyncExternalStore(
    subscribeHeight,
    getHeightSnapshot,
    getHeightServerSnapshot,
  );
  const [isDragging, setIsDragging] = useState(false);

  const setHeight = (value: number) => {
    setHeightSnapshot(value);
  };

  // Keyboard shortcut: Cmd/Ctrl + `
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        setVisibility(!visibilitySnapshot);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Drag resize handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
      const newHeight = window.innerHeight - e.clientY;
      setHeight(Math.min(Math.max(newHeight, MIN_HEIGHT), maxHeight));
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
  }, [isDragging]);

  const toggleTerminal = () => setVisibility(!isVisible);
  const closeTerminal = () => setVisibility(false);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={toggleTerminal}
          size="sm"
          className="gap-2 shadow-lg"
          title="Open Terminal (Cmd+`)"
        >
          <TerminalIcon className="h-4 w-4" />
          Terminal
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t bg-background flex flex-col z-40"
      style={{ height }}
    >
      {/* Drag handle */}
      <div
        className={cn(
          'h-1 cursor-row-resize bg-border hover:bg-primary/50 transition-colors',
          isDragging && 'bg-primary',
        )}
        onMouseDown={handleMouseDown}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/50">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Claude Terminal</span>
          <span className="text-xs text-muted-foreground">
            (Cmd+` to toggle)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={toggleTerminal}
            title={isVisible ? 'Collapse' : 'Expand'}
          >
            {isVisible ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={closeTerminal}
            title="Close Terminal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Terminal content */}
      <div className="flex-1 min-h-0">
        <Terminal projectPath={projectPath} className="h-full" />
      </div>
    </div>
  );
}

export function TerminalToggleButton() {
  const isVisible = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot,
  );

  const toggleTerminal = () => {
    setVisibility(!isVisible);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTerminal}
      className="gap-2"
      title={isVisible ? 'Hide Terminal (Cmd+`)' : 'Show Terminal (Cmd+`)'}
    >
      <TerminalIcon className="h-4 w-4" />
      <span className="hidden sm:inline">Terminal</span>
    </Button>
  );
}
