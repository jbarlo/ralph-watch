'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { ProcessOutputLine } from '@/lib/process-runner';

/**
 * Connection status for the process output stream
 */
export type ProcessOutputConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected';

/**
 * Return type for useProcessOutput hook
 */
export interface UseProcessOutputResult {
  /**
   * Accumulated output lines from the process
   */
  lines: ProcessOutputLine[];
  /**
   * Whether the SSE connection is active
   */
  isConnected: boolean;
  /**
   * Exit code if process has exited, null if still running or unknown
   */
  exitCode: number | null;
  /**
   * Current connection status
   */
  connectionStatus: ProcessOutputConnectionStatus;
  /**
   * Clear accumulated lines (useful for resetting state)
   */
  clearLines: () => void;
}

// Empty stable result for when processId is null/undefined
const EMPTY_LINES: ProcessOutputLine[] = [];
const NOOP = () => {};

/**
 * Hook for subscribing to process output via SSE.
 *
 * Connects to /api/process/[id]/stream SSE endpoint.
 * Accumulates output lines in state.
 * Cleans up connection on unmount or processId change.
 *
 * @param processId - The process ID to subscribe to, or null/undefined to not connect
 * @returns Object with lines, connection status, and exit code
 */
export function useProcessOutput(
  processId: string | null | undefined,
): UseProcessOutputResult {
  const [lines, setLines] = useState<ProcessOutputLine[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ProcessOutputConnectionStatus>(() =>
      processId ? 'connecting' : 'disconnected',
    );
  const [exitCode, setExitCode] = useState<number | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const clearLines = useCallback(() => {
    setLines([]);
  }, []);

  useEffect(() => {
    // Don't connect if no processId
    if (!processId) {
      return;
    }

    /* eslint-disable react-hooks/set-state-in-effect -- Intentional: resetting state when processId changes */
    setLines([]);
    setExitCode(null);
    setConnectionStatus('connecting');
    /* eslint-enable react-hooks/set-state-in-effect */

    const url = `/api/process/${encodeURIComponent(processId)}/stream`;
    console.log('[useProcessOutput] Connecting to', url);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Handle initial connection
    eventSource.addEventListener('connected', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as {
          id: string;
          timestamp: number;
        };
        console.log('[useProcessOutput] Connected to process', data.id);
        setConnectionStatus('connected');
      } catch {
        console.error('[useProcessOutput] Failed to parse connected event');
      }
    });

    // Handle output events
    eventSource.addEventListener('output', (event: MessageEvent) => {
      try {
        const line = JSON.parse(event.data) as ProcessOutputLine;
        setLines((prev) => [...prev, line]);
      } catch {
        console.error('[useProcessOutput] Failed to parse output event');
      }
    });

    // Handle exit events
    eventSource.addEventListener('exit', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { code: number | null };
        console.log('[useProcessOutput] Process exited with code', data.code);
        setExitCode(data.code);
        setConnectionStatus('disconnected');
        eventSource.close();
      } catch {
        console.error('[useProcessOutput] Failed to parse exit event');
      }
    });

    // Handle connection errors
    eventSource.onerror = () => {
      console.log('[useProcessOutput] Connection error');
      setConnectionStatus('disconnected');
      eventSource.close();
    };

    // Cleanup on unmount or processId change
    return () => {
      console.log('[useProcessOutput] Cleaning up connection');
      eventSource.close();
      eventSourceRef.current = null;
      // Set to disconnected on cleanup - will be overridden by new connection if processId changes
      setConnectionStatus('disconnected');
    };
  }, [processId]);

  // Return stable empty values when no processId
  if (!processId) {
    return {
      lines: EMPTY_LINES,
      isConnected: false,
      exitCode: null,
      connectionStatus: 'disconnected',
      clearLines: NOOP,
    };
  }

  return {
    lines,
    isConnected: connectionStatus === 'connected',
    exitCode,
    connectionStatus,
    clearLines,
  };
}
