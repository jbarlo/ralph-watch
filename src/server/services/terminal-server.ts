import * as pty from 'node-pty';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

const ALLOW_REMOTE =
  process.env.RALPH_ENABLE_REMOTE_TERMINAL ===
  'yes-i-understand-this-is-dangerous';

const DEFAULT_PORT = 3001;
const CLAUDE_COMMAND = process.env.CLAUDE_COMMAND || 'claude';
const MAX_SESSIONS = 10;
const ORPHAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

console.log(`Using CLAUDE_COMMAND: ${CLAUDE_COMMAND}`);

interface TerminalSession {
  id: string;
  pty: pty.IPty;
  cwd: string;
  label: string;
  context?: string;
  createdAt: number;
  lastAccessed: number;
  connectedClients: Set<WebSocket>;
}

interface TerminalMessage {
  type: 'input' | 'resize' | 'list_sessions' | 'close_session';
  data?: string;
  cols?: number;
  rows?: number;
  sessionId?: string;
}

interface SessionInfo {
  id: string;
  label: string;
  pid: number;
  createdAt: number;
}

const sessions = new Map<string, TerminalSession>();

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function escapeForShell(text: string): string {
  return text.replace(/'/g, "'\\''");
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

function cleanupOrphanedSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (
      session.connectedClients.size === 0 &&
      now - session.lastAccessed > ORPHAN_TIMEOUT_MS
    ) {
      console.log(`Cleaning up orphaned session ${id} (${session.label})`);
      session.pty.kill();
      sessions.delete(id);
    }
  }
}

function getSessionInfoList(): SessionInfo[] {
  return Array.from(sessions.values()).map((session) => ({
    id: session.id,
    label: session.label,
    pid: session.pty.pid,
    createdAt: session.createdAt,
  }));
}

function closeSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  for (const client of session.connectedClients) {
    client.send(JSON.stringify({ type: 'session_closed', sessionId }));
    client.close(1000, 'Session closed');
  }

  session.pty.kill();
  sessions.delete(sessionId);
  console.log(`Closed session ${sessionId} (${session.label})`);
  return true;
}

export function createTerminalServer(port: number = DEFAULT_PORT) {
  const wss = new WebSocketServer({ port });

  const cleanupInterval = setInterval(
    cleanupOrphanedSessions,
    CLEANUP_INTERVAL_MS,
  );

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

    const url = new URL(req.url || '', 'http://localhost');
    const searchParams = url.searchParams;

    const cwd =
      searchParams.get('cwd') || process.env.RALPH_DIR || process.cwd();
    const requestedSession = searchParams.get('session');
    const newSession = searchParams.get('newSession') === 'true';
    const label = searchParams.get('label') || 'Main';
    const context = searchParams.get('context') || undefined;

    let session: TerminalSession | undefined;

    if (requestedSession && sessions.has(requestedSession) && !newSession) {
      session = sessions.get(requestedSession)!;
      session.lastAccessed = Date.now();
      session.connectedClients.add(ws);
      console.log(`Reattaching to session ${session.id} (${session.label})`);
      ws.send(
        JSON.stringify({
          type: 'ready',
          pid: session.pty.pid,
          sessionId: session.id,
          reattached: true,
        }),
      );
    } else {
      if (sessions.size >= MAX_SESSIONS) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: `Maximum sessions (${MAX_SESSIONS}) reached. Close a session first.`,
          }),
        );
        ws.close(1013, 'Max sessions reached');
        return;
      }

      const sessionId = generateSessionId();
      const defaultCols = 80;
      const defaultRows = 24;

      let ptyProcess: pty.IPty;

      try {
        const cmd = context
          ? `${CLAUDE_COMMAND} -p '${escapeForShell(context)}'`
          : CLAUDE_COMMAND;

        ptyProcess = pty.spawn('/bin/sh', ['-c', cmd], {
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

      session = {
        id: sessionId,
        pty: ptyProcess,
        cwd,
        label,
        context,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        connectedClients: new Set([ws]),
      };

      sessions.set(sessionId, session);
      console.log(`Created new session ${sessionId} (${label})`);

      ws.send(
        JSON.stringify({
          type: 'ready',
          pid: ptyProcess.pid,
          sessionId,
          reattached: false,
        }),
      );

      ptyProcess.onData((data: string) => {
        for (const client of session!.connectedClients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'output', data }));
          }
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        console.log(
          `Claude exited with code ${exitCode} (session ${sessionId})`,
        );
        for (const client of session!.connectedClients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'exit', code: exitCode }));
            client.close(1000, 'Process exited');
          }
        }
        sessions.delete(sessionId);
      });
    }

    const currentSession = session;

    ws.on('message', (rawMessage: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const message = JSON.parse(rawMessage.toString()) as TerminalMessage;

        switch (message.type) {
          case 'input':
            if (message.data && currentSession) {
              currentSession.pty.write(message.data);
            }
            break;

          case 'resize':
            if (message.cols && message.rows && currentSession) {
              currentSession.pty.resize(message.cols, message.rows);
            }
            break;

          case 'list_sessions':
            ws.send(
              JSON.stringify({
                type: 'sessions',
                sessions: getSessionInfoList(),
              }),
            );
            break;

          case 'close_session':
            if (message.sessionId) {
              const success = closeSession(message.sessionId);
              ws.send(
                JSON.stringify({
                  type: 'close_session_result',
                  sessionId: message.sessionId,
                  success,
                }),
              );
            }
            break;
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`Terminal connection closed for ${ip}`);
      if (currentSession) {
        currentSession.connectedClients.delete(ws);
        currentSession.lastAccessed = Date.now();
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (currentSession) {
        currentSession.connectedClients.delete(ws);
        currentSession.lastAccessed = Date.now();
      }
    });
  });

  wss.on('close', () => {
    clearInterval(cleanupInterval);
    for (const session of sessions.values()) {
      session.pty.kill();
    }
    sessions.clear();
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
