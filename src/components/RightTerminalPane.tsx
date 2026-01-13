'use client';

import {
  useEffect,
  useState,
  useCallback,
  useSyncExternalStore,
  useRef,
} from 'react';
import { Terminal, type TerminalHandle } from '@/components/Terminal';
import { SessionTabs } from '@/components/SessionTabs';
import type { SessionInfo } from '@/hooks/use-terminal';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiffOnTicketEventDetail } from '@/lib/ticket-ui';

const STORAGE_KEY_VISIBLE = 'ralph-terminal-visible';
const STORAGE_KEY_WIDTH = 'ralph-terminal-width';
const STORAGE_KEY_SESSION = 'ralph-terminal-session';
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

function getStoredSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY_SESSION);
  } catch {
    return null;
  }
}

function setStoredSession(sessionId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (sessionId) {
      localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
    } else {
      localStorage.removeItem(STORAGE_KEY_SESSION);
    }
  } catch {
    // localStorage unavailable
  }
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

  // Session state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() =>
    getStoredSession(),
  );
  const terminalHandleRef = useRef<TerminalHandle | null>(null);

  // Riff session state - for creating sessions with ticket context
  const [pendingRiffSession, setPendingRiffSession] = useState<{
    label: string;
    context: string;
    ticketId: number;
  } | null>(null);

  const setWidth = (value: number) => {
    setWidthSnapshot(value);
  };

  // Persist active session to localStorage
  useEffect(() => {
    setStoredSession(activeSessionId);
  }, [activeSessionId]);

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

  // Listen for riff-on-ticket events
  useEffect(() => {
    const handleRiffOnTicket = (e: CustomEvent<RiffOnTicketEventDetail>) => {
      const { ticketId, label, context } = e.detail;

      // Check if session with same ticket already exists
      const existingSession = sessions.find((s) => s.label === label);
      if (existingSession) {
        // Switch to existing session
        setActiveSessionId(existingSession.id);
        setVisibility(true);
        return;
      }

      // Open terminal and create new session with context
      setVisibility(true);
      setPendingRiffSession({ ticketId, label, context });
      setActiveSessionId(null); // Clear to create new session
    };

    window.addEventListener(
      'riff-on-ticket',
      handleRiffOnTicket as EventListener,
    );
    return () =>
      window.removeEventListener(
        'riff-on-ticket',
        handleRiffOnTicket as EventListener,
      );
  }, [sessions]);

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

  const handleSessionsUpdated = useCallback((newSessions: SessionInfo[]) => {
    setSessions(newSessions);
  }, []);

  const handleSessionCreated = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    // Clear pending riff session after it's been used
    setPendingRiffSession(null);
    // Request updated session list
    terminalHandleRef.current?.listSessions();
  }, []);

  const handleReattached = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    // Request updated session list
    terminalHandleRef.current?.listSessions();
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const handleCloseSession = useCallback(
    (sessionId: string) => {
      terminalHandleRef.current?.closeSession(sessionId);
      // If closing active session, switch to another
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setActiveSessionId(remaining[0]?.id ?? null);
      }
    },
    [activeSessionId, sessions],
  );

  const handleNewSession = useCallback(() => {
    // Clear activeSessionId to trigger new session creation
    setActiveSessionId(null);
  }, []);

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

        {/* Session tabs */}
        <SessionTabs
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onCloseSession={handleCloseSession}
          onNewSession={handleNewSession}
        />

        {/* Terminal content */}
        <div className="flex-1 min-h-0">
          <Terminal
            projectPath={projectPath}
            sessionId={activeSessionId ?? undefined}
            sessionLabel={pendingRiffSession?.label}
            sessionContext={pendingRiffSession?.context}
            className="h-full"
            handleRef={terminalHandleRef}
            onSessionCreated={handleSessionCreated}
            onReattached={handleReattached}
            onSessionsUpdated={handleSessionsUpdated}
          />
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
