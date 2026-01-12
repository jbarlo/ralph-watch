'use client';

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { Terminal } from '@/components/Terminal';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY_VISIBLE = 'ralph-terminal-visible';
const STORAGE_KEY_WIDTH = 'ralph-terminal-width';
const DEFAULT_WIDTH = 600;
const MIN_WIDTH = 300;
const MAX_WIDTH_RATIO = 0.7; // 70vw

function getShortcutSnapshot(): string {
  if (typeof navigator === 'undefined') return 'Ctrl+`';
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? 'Cmd+`' : 'Ctrl+`';
}

function getShortcutServerSnapshot(): string {
  return 'Ctrl+`';
}

function subscribeNoop(): () => void {
  return () => {};
}

function getStoredVisibility(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_VISIBLE) === 'true';
  } catch {
    return false;
  }
}

function getStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_WIDTH);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH) {
        return parsed;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_WIDTH;
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

const widthListeners = new Set<() => void>();
let widthSnapshot = getStoredWidth();

function subscribeWidth(callback: () => void): () => void {
  widthListeners.add(callback);
  return () => widthListeners.delete(callback);
}

function getWidthSnapshot(): number {
  return widthSnapshot;
}

function getWidthServerSnapshot(): number {
  return DEFAULT_WIDTH;
}

function setWidthSnapshot(value: number): void {
  widthSnapshot = value;
  try {
    localStorage.setItem(STORAGE_KEY_WIDTH, String(value));
  } catch {
    // localStorage unavailable
  }
  widthListeners.forEach((cb) => cb());
}

/**
 * Hook to get current terminal pane width (for adjusting main content)
 */
export function useTerminalWidth(): number {
  const isVisible = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot,
  );
  const width = useSyncExternalStore(
    subscribeWidth,
    getWidthSnapshot,
    getWidthServerSnapshot,
  );
  return isVisible ? width : 0;
}

/**
 * Hook to check if terminal is visible
 */
export function useTerminalVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot,
  );
}

interface RightTerminalPaneProps {
  projectPath: string;
}

export function RightTerminalPane({ projectPath }: RightTerminalPaneProps) {
  const isVisible = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot,
  );
  const width = useSyncExternalStore(
    subscribeWidth,
    getWidthSnapshot,
    getWidthServerSnapshot,
  );
  const shortcut = useSyncExternalStore(
    subscribeNoop,
    getShortcutSnapshot,
    getShortcutServerSnapshot,
  );
  const [isDragging, setIsDragging] = useState(false);

  const setWidth = (value: number) => {
    setWidthSnapshot(value);
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
      const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.min(Math.max(newWidth, MIN_WIDTH), maxWidth));
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
          title={`Open Terminal (${shortcut})`}
        >
          <TerminalIcon className="h-4 w-4" />
          Terminal
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed top-0 right-0 bottom-0 border-l bg-background flex flex-row z-40"
      style={{ width }}
    >
      {/* Drag handle */}
      <div
        className={cn(
          'w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors',
          isDragging && 'bg-primary',
        )}
        onMouseDown={handleMouseDown}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/50">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Claude Terminal</span>
            <span className="text-xs text-muted-foreground">
              ({shortcut} to toggle)
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
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
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
    </div>
  );
}

export function TerminalToggleButton() {
  const isVisible = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot,
  );
  const shortcut = useSyncExternalStore(
    subscribeNoop,
    getShortcutSnapshot,
    getShortcutServerSnapshot,
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
      title={
        isVisible
          ? `Hide Terminal (${shortcut})`
          : `Show Terminal (${shortcut})`
      }
    >
      <TerminalIcon className="h-4 w-4" />
      <span className="hidden sm:inline">Terminal</span>
    </Button>
  );
}
