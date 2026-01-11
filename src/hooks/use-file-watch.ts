'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Connection status for the file watcher
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Event data from the SSE endpoint
 */
interface WatchEvent {
  timestamp: number;
  ralphDir?: string;
  message?: string;
}

/**
 * Hook for watching file changes via SSE and invalidating tRPC queries
 *
 * Connects to /api/watch SSE endpoint.
 * On 'tickets' event, invalidates tickets query.
 * On 'progress' event, invalidates progress query.
 * Automatically reconnects on disconnect.
 *
 * @returns Connection status
 */
export function useFileWatch(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Reconnect function that schedules a new connection
  const scheduleReconnect = useCallback(() => {
    reconnectTimeoutRef.current = setTimeout(() => {
      setStatus('connecting');
    }, 3000);
  }, []);

  useEffect(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Only connect when status is 'connecting'
    if (status !== 'connecting') {
      return;
    }

    const eventSource = new EventSource('/api/watch');
    eventSourceRef.current = eventSource;

    // Handle connection opened
    eventSource.addEventListener('connected', (event: MessageEvent) => {
      try {
        const data: WatchEvent = JSON.parse(event.data);
        console.log('[useFileWatch] Connected to', data.ralphDir);
        setStatus('connected');
      } catch {
        console.error('[useFileWatch] Failed to parse connected event');
      }
    });

    // Handle tickets file change
    eventSource.addEventListener('tickets', (event: MessageEvent) => {
      try {
        const data: WatchEvent = JSON.parse(event.data);
        console.log('[useFileWatch] Tickets changed at', data.timestamp);
        // Invalidate all tickets queries
        void queryClient.invalidateQueries({
          queryKey: [['tickets']],
        });
      } catch {
        console.error('[useFileWatch] Failed to parse tickets event');
      }
    });

    // Handle progress file change
    eventSource.addEventListener('progress', (event: MessageEvent) => {
      try {
        const data: WatchEvent = JSON.parse(event.data);
        console.log('[useFileWatch] Progress changed at', data.timestamp);
        // Invalidate all progress queries
        void queryClient.invalidateQueries({
          queryKey: [['progress']],
        });
      } catch {
        console.error('[useFileWatch] Failed to parse progress event');
      }
    });

    // Handle errors
    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const data: WatchEvent = JSON.parse(event.data);
        console.error('[useFileWatch] Error:', data.message);
      } catch {
        // Generic error, not a parsed event
      }
    });

    // Handle connection errors
    eventSource.onerror = () => {
      console.log('[useFileWatch] Connection error, will reconnect...');
      setStatus('disconnected');
      eventSource.close();
      scheduleReconnect();
    };

    return () => {
      eventSource.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [status, queryClient, scheduleReconnect]);

  return status;
}
