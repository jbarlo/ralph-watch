'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminal } from '@/hooks/use-terminal';
import { TerminalControls } from '@/components/TerminalControls';
import { Button } from '@/components/ui/button';
import { RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

interface TerminalProps {
  projectPath?: string;
  wsPort?: number;
  className?: string;
  showControls?: boolean;
  onConnectionChange?: (isConnected: boolean) => void;
}

export function Terminal({
  projectPath,
  wsPort = 3001,
  className,
  showControls,
  onConnectionChange,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const { data: config } = trpc.config.get.useQuery();
  const terminalButtons = config?.terminalButtons;

  const wsUrl =
    typeof window !== 'undefined'
      ? `ws://${window.location.hostname}:${wsPort}`
      : '';

  const handleOutput = useCallback((data: string) => {
    xtermRef.current?.write(data);
  }, []);

  const handleReady = useCallback((pid: number) => {
    xtermRef.current?.write(`\r\n[Terminal ready - PID: ${pid}]\r\n`);
  }, []);

  const handleExit = useCallback((code: number) => {
    xtermRef.current?.write(`\r\n[Process exited with code ${code}]\r\n`);
  }, []);

  const handleError = useCallback((message: string) => {
    xtermRef.current?.write(`\r\n\x1b[31m[Error: ${message}]\x1b[0m\r\n`);
  }, []);

  const handleReconnecting = useCallback((attempt: number) => {
    xtermRef.current?.write(
      `\r\n\x1b[33m[Reconnecting (attempt ${attempt})...]\x1b[0m\r\n`,
    );
  }, []);

  const {
    status,
    pid,
    exitCode,
    reconnectAttempt,
    connect,
    disconnect,
    sendInput,
    resize,
  } = useTerminal({
    wsUrl,
    cwd: projectPath,
    autoReconnect: true,
    maxReconnectAttempts: 10,
    onOutput: handleOutput,
    onReady: handleReady,
    onExit: handleExit,
    onError: handleError,
    onReconnecting: handleReconnecting,
  });

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        cursorAccent: '#1e1e2e',
        selectionBackground: '#45475a',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#cba6f7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#cba6f7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle Ctrl-C: if text selected, copy; otherwise send SIGINT
    term.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
        const hasSelection = term.hasSelection();
        if (hasSelection) {
          // Copy selected text
          navigator.clipboard.writeText(term.getSelection());
          return false; // Prevent xterm from sending \x03
        }
        // No selection - let xterm send \x03 (SIGINT)
        return true;
      }
      return true; // Let xterm handle all other keys
    });

    term.onData((data) => {
      sendInput(data);
    });

    term.onResize(({ cols, rows }) => {
      resize(cols, rows);
    });

    term.write('Press "Connect" to start a Claude terminal session...\r\n');

    const handleResize = () => {
      fitAddonRef.current?.fit();
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sendInput, resize]);

  const handleConnect = useCallback(() => {
    xtermRef.current?.clear();
    xtermRef.current?.write('Connecting to Claude...\r\n');
    connect();
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    xtermRef.current?.write('\r\n[Disconnected]\r\n');
  }, [disconnect]);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isReconnecting = isConnecting && reconnectAttempt > 0;

  useEffect(() => {
    onConnectionChange?.(isConnected);
  }, [isConnected, onConnectionChange]);

  const getStatusText = () => {
    if (isConnected && pid) return `PID: ${pid}`;
    if (isReconnecting) return `Reconnecting (attempt ${reconnectAttempt})...`;
    if (isConnecting) return 'Connecting...';
    if (status === 'disconnected') return 'Disconnected';
    if (status === 'error') return 'Error';
    return '';
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between border-b bg-background px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Claude Terminal</span>
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              status === 'connected' && 'bg-green-500',
              status === 'connecting' && 'bg-yellow-500 animate-pulse',
              status === 'disconnected' && 'bg-gray-400',
              status === 'error' && 'bg-red-500',
            )}
          />
          <span className="text-xs text-muted-foreground">
            {getStatusText()}
            {exitCode !== null && ` (exited: ${exitCode})`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isConnected && !isConnecting && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={handleConnect}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {status === 'error' ? 'Retry' : 'Connect'}
            </Button>
          )}
          {(isConnected || isConnecting) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={handleDisconnect}
            >
              <X className="mr-1 h-3 w-3" />
              Disconnect
            </Button>
          )}
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 min-h-0" />
      {showControls && (
        <TerminalControls
          onSendInput={sendInput}
          disabled={!isConnected}
          buttons={terminalButtons}
        />
      )}
    </div>
  );
}
