'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SessionInfo {
  id: string;
  label: string;
  pid: number;
  createdAt: number;
}

interface TerminalMessage {
  type: 'ready' | 'output' | 'exit' | 'error' | 'sessions';
  data?: string;
  pid?: number;
  code?: number;
  message?: string;
  sessionId?: string;
  reattached?: boolean;
  sessions?: SessionInfo[];
}

interface UseTerminalOptions {
  wsUrl: string;
  cwd?: string;
  sessionId?: string;
  sessionLabel?: string;
  sessionContext?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  onOutput?: (data: string) => void;
  onReady?: (pid: number) => void;
  onExit?: (code: number) => void;
  onError?: (message: string) => void;
  onReconnecting?: (attempt: number, delay: number) => void;
  onSessionCreated?: (sessionId: string) => void;
  onReattached?: (sessionId: string) => void;
}

interface UseTerminalReturn {
  status: ConnectionStatus;
  pid: number | null;
  exitCode: number | null;
  reconnectAttempt: number;
  currentSessionId: string | null;
  sessions: SessionInfo[];
  connect: () => void;
  disconnect: () => void;
  sendInput: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  listSessions: () => void;
  closeSession: (sessionId: string) => void;
}

const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useTerminal({
  wsUrl,
  cwd,
  sessionId,
  sessionLabel,
  sessionContext,
  autoReconnect = false,
  maxReconnectAttempts = 10,
  onOutput,
  onReady,
  onExit,
  onError,
  onReconnecting,
  onSessionCreated,
  onReattached,
}: UseTerminalOptions): UseTerminalReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [pid, setPid] = useState<number | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const manualDisconnectRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const attemptRef = useRef(0);
  const doConnectRef = useRef<(attempt: number) => void>(() => {});

  const callbacksRef = useRef({
    onOutput,
    onReady,
    onExit,
    onError,
    onReconnecting,
    onSessionCreated,
    onReattached,
  });

  useEffect(() => {
    callbacksRef.current = {
      onOutput,
      onReady,
      onExit,
      onError,
      onReconnecting,
      onSessionCreated,
      onReattached,
    };
  });

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const doConnect = useCallback(
    (attempt: number) => {
      attemptRef.current = attempt;

      if (wsRef.current) {
        wsRef.current.close();
      }

      clearReconnectTimeout();
      manualDisconnectRef.current = false;
      setStatus('connecting');

      if (attempt === 0) {
        setExitCode(null);
        setPid(null);
        setReconnectAttempt(0);
        wasConnectedRef.current = false;
      }

      const url = new URL(wsUrl);
      if (cwd) {
        url.searchParams.set('cwd', cwd);
      }
      if (sessionId) {
        url.searchParams.set('session', sessionId);
      }
      if (sessionLabel) {
        url.searchParams.set('label', sessionLabel);
      }
      if (sessionContext) {
        url.searchParams.set('context', sessionContext);
      }

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setReconnectAttempt(0);
        wasConnectedRef.current = true;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as TerminalMessage;

          switch (message.type) {
            case 'ready':
              if (message.pid !== undefined) {
                setPid(message.pid);
                callbacksRef.current.onReady?.(message.pid);
              }
              if (message.sessionId) {
                setCurrentSessionId(message.sessionId);
                if (message.reattached) {
                  callbacksRef.current.onReattached?.(message.sessionId);
                } else {
                  callbacksRef.current.onSessionCreated?.(message.sessionId);
                }
              }
              break;

            case 'output':
              if (message.data) {
                callbacksRef.current.onOutput?.(message.data);
              }
              break;

            case 'exit':
              if (message.code !== undefined) {
                setExitCode(message.code);
                callbacksRef.current.onExit?.(message.code);
              }
              break;

            case 'error':
              setStatus('error');
              callbacksRef.current.onError?.(
                message.message || 'Unknown error',
              );
              break;

            case 'sessions':
              if (message.sessions) {
                setSessions(message.sessions);
              }
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        setStatus('error');
        callbacksRef.current.onError?.('WebSocket connection error');
      };

      ws.onclose = () => {
        wsRef.current = null;

        if (manualDisconnectRef.current) {
          setStatus('disconnected');
          return;
        }

        const currentAttempt = attemptRef.current;

        if (autoReconnect && wasConnectedRef.current) {
          if (currentAttempt >= maxReconnectAttempts) {
            setStatus('error');
            callbacksRef.current.onError?.(
              `Failed to reconnect after ${maxReconnectAttempts} attempts`,
            );
            return;
          }

          const nextAttempt = currentAttempt + 1;
          const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, currentAttempt),
            MAX_RECONNECT_DELAY,
          );

          setReconnectAttempt(nextAttempt);
          callbacksRef.current.onReconnecting?.(nextAttempt, delay);

          reconnectTimeoutRef.current = setTimeout(() => {
            doConnectRef.current(nextAttempt);
          }, delay);
        } else {
          setStatus('disconnected');
        }
      };
    },
    [
      wsUrl,
      cwd,
      sessionId,
      sessionLabel,
      sessionContext,
      autoReconnect,
      maxReconnectAttempts,
      clearReconnectTimeout,
    ],
  );

  useEffect(() => {
    doConnectRef.current = doConnect;
  }, [doConnect]);

  const connect = useCallback(() => {
    doConnect(0);
  }, [doConnect]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    clearReconnectTimeout();
    setReconnectAttempt(0);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [clearReconnectTimeout]);

  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }, []);

  const listSessions = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'list_sessions' }));
    }
  }, []);

  const closeSession = useCallback((targetSessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'close_session', sessionId: targetSessionId }),
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearReconnectTimeout]);

  return {
    status,
    pid,
    exitCode,
    reconnectAttempt,
    currentSessionId,
    sessions,
    connect,
    disconnect,
    sendInput,
    resize,
    listSessions,
    closeSession,
  };
}
