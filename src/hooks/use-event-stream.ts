'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { ProcessOutputLine } from '@/lib/process-runner';
import type { Ticket } from '@/lib/schemas';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface EventMessage {
  topic: string;
  type: string;
  data: unknown;
}

interface FileChangeData {
  file: string;
  timestamp: number;
}

interface ProcessExitData {
  code: number | null;
}

type TopicHandler = (type: string, data: unknown) => void;

export interface TicketStatusChange {
  ticket: Ticket;
  oldStatus: string;
  newStatus: string;
}

export interface UseEventStreamOptions {
  project: string;
  topics: string[];
  onTicketsChange?: () => void;
  onProgressChange?: () => void;
  onTicketStatusChange?: (change: TicketStatusChange) => void;
  getTickets?: () => Ticket[] | undefined;
  onProcessOutput?: (processId: string, line: ProcessOutputLine) => void;
  onProcessExit?: (processId: string, code: number | null) => void;
}

export interface UseEventStreamResult {
  connectionStatus: ConnectionStatus;
  subscribe: (topic: string, handler: TopicHandler) => () => void;
}

export function useEventStream(
  options: UseEventStreamOptions,
): UseEventStreamResult {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousTicketsRef = useRef<Map<number, string>>(new Map());
  const subscribersRef = useRef<Map<string, Set<TopicHandler>>>(new Map());

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const topicsKey = useMemo(
    () => options.topics.sort().join(','),
    [options.topics],
  );

  const subscribe = useCallback(
    (topic: string, handler: TopicHandler): (() => void) => {
      if (!subscribersRef.current.has(topic)) {
        subscribersRef.current.set(topic, new Set());
      }
      subscribersRef.current.get(topic)!.add(handler);

      return () => {
        const handlers = subscribersRef.current.get(topic);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            subscribersRef.current.delete(topic);
          }
        }
      };
    },
    [],
  );

  const checkTicketStatusChanges = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const ticketsData = optionsRef.current.getTickets?.();
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
          `[useEventStream] Ticket #${ticket.id} status: ${previousStatus} -> ${ticket.status}`,
        );
        optionsRef.current.onTicketStatusChange?.({
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

    const params = new URLSearchParams();
    params.set('project', options.project);
    if (topicsKey) {
      params.set('topics', topicsKey);
    }

    const url = `/api/events?${params.toString()}`;
    console.log('[useEventStream] Connecting to', url);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentionally setting status as part of connection setup
    setConnectionStatus('connecting');

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const message: EventMessage = JSON.parse(event.data);
        const { topic, type, data } = message;

        const handlers = subscribersRef.current.get(topic);
        if (handlers) {
          for (const handler of handlers) {
            handler(type, data);
          }
        }

        if (topic === 'system' && type === 'connected') {
          console.log('[useEventStream] Connected');
          setConnectionStatus('connected');

          const initialTickets = optionsRef.current.getTickets?.();
          if (initialTickets) {
            for (const ticket of initialTickets) {
              previousTicketsRef.current.set(ticket.id, ticket.status);
            }
          }
        } else if (topic === 'tickets' && type === 'change') {
          console.log(
            '[useEventStream] Tickets changed at',
            (data as FileChangeData).timestamp,
          );
          optionsRef.current.onTicketsChange?.();
          void checkTicketStatusChanges();
        } else if (topic === 'progress' && type === 'change') {
          console.log(
            '[useEventStream] Progress changed at',
            (data as FileChangeData).timestamp,
          );
          optionsRef.current.onProgressChange?.();
        } else if (topic.startsWith('process:')) {
          const processId = topic.slice('process:'.length);
          if (type === 'output') {
            optionsRef.current.onProcessOutput?.(
              processId,
              data as ProcessOutputLine,
            );
          } else if (type === 'exit') {
            optionsRef.current.onProcessExit?.(
              processId,
              (data as ProcessExitData).code,
            );
          }
        }
      } catch {
        console.error('[useEventStream] Failed to parse message');
      }
    };

    eventSource.onerror = () => {
      console.log('[useEventStream] Connection error, will reconnect...');
      setConnectionStatus('disconnected');
      eventSource.close();

      reconnectTimeoutRef.current = setTimeout(() => {
        if (eventSourceRef.current === null) {
          setConnectionStatus('connecting');
        }
      }, 3000);
    };

    return () => {
      console.log('[useEventStream] Cleaning up connection');
      eventSource.close();
      eventSourceRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [options.project, topicsKey, checkTicketStatusChanges]);

  return {
    connectionStatus,
    subscribe,
  };
}
