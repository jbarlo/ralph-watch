'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
   * Callback when a ticket's status changes to 'completed' or 'failed'
   */
  onTicketStatusChange?: (change: TicketStatusChange) => void;
}

/**
 * Hook for watching file changes via SSE and invalidating tRPC queries
 *
 * Connects to /api/watch SSE endpoint.
 * On 'tickets' event, invalidates tickets query.
 * On 'progress' event, invalidates progress query.
 * Automatically reconnects on disconnect.
 *
 * @param options - Optional callbacks for status changes
 * @returns Connection status
 */
export function useFileWatch(options?: UseFileWatchOptions): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Track previous ticket states to detect status changes
  const previousTicketsRef = useRef<Map<number, string>>(new Map());

  // Store options in a ref to avoid stale closures - updated in effect
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // Reconnect function that schedules a new connection
  const scheduleReconnect = useCallback(() => {
    reconnectTimeoutRef.current = setTimeout(() => {
      setStatus('connecting');
    }, 3000);
  }, []);

  /**
   * Check for ticket status changes and trigger callback if needed
   */
  const checkTicketStatusChanges = useCallback(async () => {
    // Wait a bit for the query to refetch
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Get fresh ticket data from cache
    const ticketsData = queryClient.getQueryData<Ticket[]>([
      ['tickets'],
      'list',
    ]);

    if (!ticketsData) {
      return;
    }

    // Check for status changes
    for (const ticket of ticketsData) {
      const previousStatus = previousTicketsRef.current.get(ticket.id);

      // Only notify if status changed TO completed or failed
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

      // Update tracked state
      previousTicketsRef.current.set(ticket.id, ticket.status);
    }
  }, [queryClient]);

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

        // Initialize previous tickets from cache
        const initialTickets = queryClient.getQueryData<Ticket[]>([
          ['tickets'],
          'list',
        ]);
        if (initialTickets) {
          for (const ticket of initialTickets) {
            previousTicketsRef.current.set(ticket.id, ticket.status);
          }
        }
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
        // Check for status changes after queries refetch
        void checkTicketStatusChanges();
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
  }, [status, queryClient, scheduleReconnect, checkTicketStatusChanges]);

  return status;
}
