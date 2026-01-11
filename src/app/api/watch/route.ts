import { watch, type FSWatcher } from 'chokidar';
import { getRalphDir, getRalphFilePath } from '@/server/trpc';

/**
 * Event types that can be sent to clients
 */
type WatchEventType = 'tickets' | 'progress' | 'connected' | 'error';

/**
 * Format an SSE message
 */
function formatSSE(event: WatchEventType, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

/**
 * Global file watcher instance (singleton per process)
 * We use a single watcher and broadcast to all connected clients
 */
let globalWatcher: FSWatcher | null = null;
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

/**
 * Initialize the global file watcher if not already running
 */
function initWatcher(): void {
  if (globalWatcher) return;

  const ticketsPath = getRalphFilePath('tickets.json');
  const progressPath = getRalphFilePath('progress.txt');

  globalWatcher = watch([ticketsPath, progressPath], {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  globalWatcher.on('change', (path) => {
    const filename = path.endsWith('tickets.json') ? 'tickets' : 'progress';
    const message = formatSSE(
      filename,
      JSON.stringify({ timestamp: Date.now() }),
    );
    const encoded = new TextEncoder().encode(message);

    // Broadcast to all connected clients
    for (const controller of clients) {
      try {
        controller.enqueue(encoded);
      } catch {
        // Client disconnected, will be cleaned up
        clients.delete(controller);
      }
    }
  });

  globalWatcher.on('error', (error: unknown) => {
    console.error('[watch] File watcher error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const message = formatSSE(
      'error',
      JSON.stringify({ message: errorMessage }),
    );
    const encoded = new TextEncoder().encode(message);

    for (const controller of clients) {
      try {
        controller.enqueue(encoded);
      } catch {
        clients.delete(controller);
      }
    }
  });

  console.log(`[watch] File watcher started for ${getRalphDir()}`);
}

/**
 * SSE endpoint for file watching
 * GET /api/watch - Connect to receive file change events
 */
export async function GET(): Promise<Response> {
  // Initialize watcher on first connection
  initWatcher();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Register this client
      clients.add(controller);

      // Send initial connected event
      const connectMessage = formatSSE(
        'connected',
        JSON.stringify({
          timestamp: Date.now(),
          ralphDir: getRalphDir(),
        }),
      );
      controller.enqueue(encoder.encode(connectMessage));
    },
    cancel(controller) {
      // Clean up when client disconnects
      clients.delete(controller);
      console.log(
        `[watch] Client disconnected. Active clients: ${clients.size}`,
      );
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
