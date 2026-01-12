'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface TerminalMessage {
  type: 'ready' | 'output' | 'exit' | 'error';
  data?: string;
  pid?: number;
  code?: number;
  message?: string;
}

interface UseTerminalOptions {
  wsUrl: string;
  cwd?: string;
  onOutput?: (data: string) => void;
  onReady?: (pid: number) => void;
  onExit?: (code: number) => void;
  onError?: (message: string) => void;
}

interface UseTerminalReturn {
  status: ConnectionStatus;
  pid: number | null;
  exitCode: number | null;
  connect: () => void;
  disconnect: () => void;
  sendInput: (data: string) => void;
  resize: (cols: number, rows: number) => void;
}

export function useTerminal({
  wsUrl,
  cwd,
  onOutput,
  onReady,
  onExit,
  onError,
}: UseTerminalOptions): UseTerminalReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [pid, setPid] = useState<number | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef({ onOutput, onReady, onExit, onError });

  useEffect(() => {
    callbacksRef.current = { onOutput, onReady, onExit, onError };
  });

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');
    setExitCode(null);
    setPid(null);

    const url = new URL(wsUrl);
    if (cwd) {
      url.searchParams.set('cwd', cwd);
    }

    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
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
            callbacksRef.current.onError?.(message.message || 'Unknown error');
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
      setStatus('disconnected');
      wsRef.current = null;
    };
  }, [wsUrl, cwd]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

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

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    status,
    pid,
    exitCode,
    connect,
    disconnect,
    sendInput,
    resize,
  };
}
