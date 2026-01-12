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
 * Per-directory watcher management
 * Each directory gets its own watcher and client set
 */
interface DirectoryWatcher {
  watcher: FSWatcher;
  clients: Set<ReadableStreamDefaultController<Uint8Array>>;
  ralphDir: string;
}

const watchers = new Map<string, DirectoryWatcher>();

/**
 * Get or create a watcher for a specific directory
 */
function getOrCreateWatcher(ralphDir: string): DirectoryWatcher {
  const existing = watchers.get(ralphDir);
  if (existing) {
    return existing;
  }

  const ticketsPath = getRalphFilePath('tickets.json', ralphDir);
  const progressPath = getRalphFilePath('progress.txt', ralphDir);

  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

  const watcher = watch([ticketsPath, progressPath], {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on('change', (path) => {
    const filename = path.endsWith('tickets.json') ? 'tickets' : 'progress';
    const message = formatSSE(
      filename,
      JSON.stringify({ timestamp: Date.now() }),
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

  watcher.on('error', (error: unknown) => {
    console.error(`[watch] File watcher error for ${ralphDir}:`, error);
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

  console.log(`[watch] File watcher started for ${ralphDir}`);

  const directoryWatcher: DirectoryWatcher = {
    watcher,
    clients,
    ralphDir,
  };

  watchers.set(ralphDir, directoryWatcher);
  return directoryWatcher;
}

/**
 * Clean up a watcher if no clients are connected
 */
function maybeCleanupWatcher(ralphDir: string): void {
  const directoryWatcher = watchers.get(ralphDir);
  if (directoryWatcher && directoryWatcher.clients.size === 0) {
    console.log(`[watch] Cleaning up watcher for ${ralphDir}`);
    void directoryWatcher.watcher.close();
    watchers.delete(ralphDir);
  }
}

/**
 * SSE endpoint for file watching
 * GET /api/watch?dir=/path/to/project - Connect to receive file change events
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const ralphDir = url.searchParams.get('dir') ?? getRalphDir();
  const directoryWatcher = getOrCreateWatcher(ralphDir);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      directoryWatcher.clients.add(controller);

      const connectMessage = formatSSE(
        'connected',
        JSON.stringify({
          timestamp: Date.now(),
          ralphDir,
        }),
      );
      controller.enqueue(encoder.encode(connectMessage));
    },
    cancel(controller) {
      directoryWatcher.clients.delete(controller);
      console.log(
        `[watch] Client disconnected from ${ralphDir}. Active clients: ${directoryWatcher.clients.size}`,
      );
      maybeCleanupWatcher(ralphDir);
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
