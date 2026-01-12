import * as pty from 'node-pty';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

const ALLOW_REMOTE =
  process.env.RALPH_ENABLE_REMOTE_TERMINAL ===
  'yes-i-understand-this-is-dangerous';

const DEFAULT_PORT = 3001;
const CLAUDE_COMMAND = process.env.CLAUDE_COMMAND || 'claude';

console.log(`Using CLAUDE_COMMAND: ${CLAUDE_COMMAND}`);

interface TerminalMessage {
  type: 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

function isLocalAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost'
  );
}

export function createTerminalServer(port: number = DEFAULT_PORT) {
  const wss = new WebSocketServer({ port });

  console.log(`Terminal WebSocket server listening on port ${port}`);
  if (!ALLOW_REMOTE) {
    console.log('Terminal is localhost-only');
  } else {
    console.warn('WARNING: Remote terminal access enabled!');
  }

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = req.socket.remoteAddress;
    const isLocal = isLocalAddress(ip);

    if (!isLocal && !ALLOW_REMOTE) {
      ws.close(1008, 'Terminal only available on localhost');
      console.warn(`Rejected terminal connection from ${ip}`);
      return;
    }

    console.log(`Terminal connection from ${ip}`);

    const cwd =
      typeof req.url === 'string'
        ? new URL(req.url, 'http://localhost').searchParams.get('cwd') ||
          process.env.RALPH_DIR ||
          process.cwd()
        : process.env.RALPH_DIR || process.cwd();

    const defaultCols = 80;
    const defaultRows = 24;

    let ptyProcess: pty.IPty | null = null;

    try {
      // Use shell to handle aliases, npx commands, etc.
      ptyProcess = pty.spawn('/bin/sh', ['-c', CLAUDE_COMMAND], {
        name: 'xterm-256color',
        cols: defaultCols,
        rows: defaultRows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to spawn claude';
      console.error('Failed to spawn claude:', message);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: `Failed to spawn claude: ${message}`,
        }),
      );
      ws.close(1011, 'Failed to spawn terminal');
      return;
    }

    ws.send(JSON.stringify({ type: 'ready', pid: ptyProcess.pid }));

    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`Claude exited with code ${exitCode}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
        ws.close(1000, 'Process exited');
      }
    });

    ws.on('message', (rawMessage: Buffer | ArrayBuffer | Buffer[]) => {
      if (!ptyProcess) return;

      try {
        const message = JSON.parse(rawMessage.toString()) as TerminalMessage;

        switch (message.type) {
          case 'input':
            if (message.data) {
              ptyProcess.write(message.data);
            }
            break;

          case 'resize':
            if (message.cols && message.rows) {
              ptyProcess.resize(message.cols, message.rows);
            }
            break;
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`Terminal connection closed for ${ip}`);
      if (ptyProcess) {
        ptyProcess.kill();
        ptyProcess = null;
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (ptyProcess) {
        ptyProcess.kill();
        ptyProcess = null;
      }
    });
  });

  return wss;
}

export function getTerminalPort(): number {
  const envPort = process.env.TERMINAL_WS_PORT;
  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      return parsed;
    }
  }
  return DEFAULT_PORT;
}
