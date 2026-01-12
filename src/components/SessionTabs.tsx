'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionInfo } from '@/hooks/use-terminal';

export interface SessionTabsProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export function SessionTabs({
  sessions,
  activeSessionId,
  onSelectSession,
  onCloseSession,
  onNewSession,
}: SessionTabsProps) {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeTabRef.current?.scrollIntoView && tabsContainerRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeSessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      if (sessions.length === 0) return;

      let targetIndex = -1;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        targetIndex = currentIndex > 0 ? currentIndex - 1 : sessions.length - 1;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        targetIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : 0;
      } else if (e.key === 'Home') {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        targetIndex = sessions.length - 1;
      }

      const targetSession = sessions[targetIndex];
      if (targetIndex >= 0 && targetSession) {
        onSelectSession(targetSession.id);
      }
    },
    [sessions, onSelectSession],
  );

  if (sessions.length === 0) {
    return (
      <div className="flex h-8 items-center border-b bg-muted/30 px-2">
        <button
          onClick={onNewSession}
          className="flex h-6 items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="h-3 w-3" />
          New Session
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-8 items-center border-b bg-muted/30">
      <div
        ref={tabsContainerRef}
        className="flex flex-1 items-center gap-0.5 overflow-x-auto px-1 scrollbar-none"
        role="tablist"
        aria-label="Terminal sessions"
      >
        {sessions.map((session, index) => {
          const isActive = session.id === activeSessionId;
          const canClose = sessions.length > 1;

          return (
            <button
              key={session.id}
              ref={isActive ? activeTabRef : null}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectSession(session.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'group relative flex h-6 min-w-0 max-w-[150px] shrink-0 items-center gap-1 rounded-t px-2 text-xs transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
              )}
            >
              <span className="truncate">{session.label || `Session`}</span>
              {canClose && (
                <span
                  role="button"
                  aria-label={`Close ${session.label || 'session'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseSession(session.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onCloseSession(session.id);
                    }
                  }}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    'ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm',
                    'opacity-0 transition-opacity group-hover:opacity-100',
                    isActive && 'opacity-60',
                    'hover:bg-destructive/20 hover:text-destructive',
                  )}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center border-l px-1">
        <button
          onClick={onNewSession}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="New session"
          title="New session"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
