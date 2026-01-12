'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Ticket } from '@/lib/schemas';

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
 * Ticket status change event
 */
export interface TicketStatusChange {
  ticket: Ticket;
  oldStatus: string;
  newStatus: string;
}

/**
 * Options for the file watch hook
 */
export interface UseFileWatchOptions {
  /**
   * Callback when tickets.json changes - use to invalidate tickets queries
   */
  onTicketsChange?: () => void;
  /**
   * Callback when progress.txt changes - use to invalidate progress queries
   */
  onProgressChange?: () => void;
  /**
   * Callback when a ticket's status changes to 'completed' or 'failed'
   */
  onTicketStatusChange?: (change: TicketStatusChange) => void;
  /**
   * Callback to get fresh ticket data for status change detection
   */
  getTickets?: () => Ticket[] | undefined;
  /**
   * Project directory to watch (passed as query param to SSE endpoint)
   */
  ralphDir?: string;
}

/**
 * Hook for watching file changes via SSE and triggering callbacks
 *
 * Connects to /api/watch SSE endpoint.
 * On 'tickets' event, calls onTicketsChange callback.
 * On 'progress' event, calls onProgressChange callback.
 * Automatically reconnects on disconnect and when ralphDir changes.
 *
 * @param options - Callbacks for file changes and status changes
 * @returns Connection status
 */
export function useFileWatch(options?: UseFileWatchOptions): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousTicketsRef = useRef<Map<number, string>>(new Map());
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const checkTicketStatusChanges = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const ticketsData = optionsRef.current?.getTickets?.();
    if (!ticketsData) {
      return;
    }

    for (const ticket of ticketsData) {
      const previousStatus = previousTicketsRef.current.get(ticket.id);

      if (
        previousStatus &&
        previousStatus !== ticket.status &&
        (ticket.status === 'completed' || ticket.status === 'failed')
      ) {
        console.log(
          `[useFileWatch] Ticket #${ticket.id} status: ${previousStatus} -> ${ticket.status}`,
        );
        optionsRef.current?.onTicketStatusChange?.({
          ticket,
          oldStatus: previousStatus,
          newStatus: ticket.status,
        });
      }

      previousTicketsRef.current.set(ticket.id, ticket.status);
    }
  }, []);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    previousTicketsRef.current.clear();

    const currentDir = options?.ralphDir;
    const url = currentDir
      ? `/api/watch?dir=${encodeURIComponent(currentDir)}`
      : '/api/watch';

    console.log('[useFileWatch] Connecting to', url);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentionally setting status as part of connection setup
    setStatus('connecting');

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (event: MessageEvent) => {
      try {
        const data: WatchEvent = JSON.parse(event.data);
        console.log('[useFileWatch] Connected to', data.ralphDir);
        setStatus('connected');

        const initialTickets = optionsRef.current?.getTickets?.();
        if (initialTickets) {
          for (const ticket of initialTickets) {
            previousTicketsRef.current.set(ticket.id, ticket.status);
          }
        }
      } catch {
        console.error('[useFileWatch] Failed to parse connected event');
      }
    });

    eventSource.addEventListener('tickets', (event: MessageEvent) => {
      try {
        const data: WatchEvent = JSON.parse(event.data);
        console.log('[useFileWatch] Tickets changed at', data.timestamp);
        optionsRef.current?.onTicketsChange?.();
        void checkTicketStatusChanges();
      } catch {
        console.error('[useFileWatch] Failed to parse tickets event');
      }
    });

    eventSource.addEventListener('progress', (event: MessageEvent) => {
      try {
        const data: WatchEvent = JSON.parse(event.data);
        console.log('[useFileWatch] Progress changed at', data.timestamp);
        optionsRef.current?.onProgressChange?.();
      } catch {
        console.error('[useFileWatch] Failed to parse progress event');
      }
    });

    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const data: WatchEvent = JSON.parse(event.data);
        console.error('[useFileWatch] Error:', data.message);
      } catch {
        // Non-JSON error event
      }
    });

    eventSource.onerror = () => {
      console.log('[useFileWatch] Connection error, will reconnect...');
      setStatus('disconnected');
      eventSource.close();

      reconnectTimeoutRef.current = setTimeout(() => {
        if (eventSourceRef.current === null) {
          setStatus('connecting');
        }
      }, 3000);
    };

    return () => {
      console.log('[useFileWatch] Cleaning up connection');
      eventSource.close();
      eventSourceRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [options?.ralphDir, checkTicketStatusChanges]);

  return status;
}
