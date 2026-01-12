/**
 * Unified SSE endpoint for all real-time events.
 * GET /api/events?project=encodedPath&topics=tickets,progress,process:id1,process:id2
 *
 * Topics:
 * - 'tickets': file change events for tickets.json
 * - 'progress': file change events for progress.txt
 * - 'process:{id}': output and exit events for a process
 *
 * Event format: { topic: string, type: string, data: any }
 */

import { watch, type FSWatcher } from 'chokidar';
import { getRalphDir, getRalphFilePath } from '@/server/trpc';
import { getProcessRunner } from '@/server/services/process-runner';
import type { ProcessRunner, ProcessOutputLine } from '@/lib/process-runner';

interface EventMessage {
  topic: string;
  type: string;
  data: unknown;
}

function formatSSE(message: EventMessage): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}

interface DirectoryWatcher {
  watcher: FSWatcher;
  clients: Set<{
    controller: ReadableStreamDefaultController<Uint8Array>;
    watchTickets: boolean;
    watchProgress: boolean;
  }>;
  ralphDir: string;
}

const watchers = new Map<string, DirectoryWatcher>();

function getOrCreateWatcher(ralphDir: string): DirectoryWatcher {
  const existing = watchers.get(ralphDir);
  if (existing) {
    return existing;
  }

  const ticketsPath = getRalphFilePath('tickets.json', ralphDir);
  const progressPath = getRalphFilePath('progress.txt', ralphDir);

  const clients = new Set<{
    controller: ReadableStreamDefaultController<Uint8Array>;
    watchTickets: boolean;
    watchProgress: boolean;
  }>();

  const watcher = watch([ticketsPath, progressPath], {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on('change', (path) => {
    const isTickets = path.endsWith('tickets.json');
    const topic = isTickets ? 'tickets' : 'progress';
    const message = formatSSE({
      topic,
      type: 'change',
      data: {
        file: isTickets ? 'tickets.json' : 'progress.txt',
        timestamp: Date.now(),
      },
    });
    const encoded = new TextEncoder().encode(message);

    for (const client of clients) {
      if (
        (isTickets && client.watchTickets) ||
        (!isTickets && client.watchProgress)
      ) {
        try {
          client.controller.enqueue(encoded);
        } catch {
          clients.delete(client);
        }
      }
    }
  });

  watcher.on('error', (error: unknown) => {
    console.error(`[events] File watcher error for ${ralphDir}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const message = formatSSE({
      topic: 'error',
      type: 'error',
      data: { message: errorMessage },
    });
    const encoded = new TextEncoder().encode(message);

    for (const client of clients) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        clients.delete(client);
      }
    }
  });

  console.log(`[events] File watcher started for ${ralphDir}`);

  const directoryWatcher: DirectoryWatcher = {
    watcher,
    clients,
    ralphDir,
  };

  watchers.set(ralphDir, directoryWatcher);
  return directoryWatcher;
}

function maybeCleanupWatcher(ralphDir: string): void {
  const directoryWatcher = watchers.get(ralphDir);
  if (directoryWatcher && directoryWatcher.clients.size === 0) {
    console.log(`[events] Cleaning up watcher for ${ralphDir}`);
    void directoryWatcher.watcher.close();
    watchers.delete(ralphDir);
  }
}

let _runner: ProcessRunner | null = null;

export function setRunner(runner: ProcessRunner | null): void {
  _runner = runner;
}

export function getRunner(): ProcessRunner {
  return _runner ?? getProcessRunner();
}

function parseTopics(topicsParam: string | null): Set<string> {
  if (!topicsParam) {
    return new Set();
  }
  return new Set(
    topicsParam
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  );
}

function getProcessIdsFromTopics(topics: Set<string>): string[] {
  const processIds: string[] = [];
  for (const topic of topics) {
    if (topic.startsWith('process:')) {
      const id = topic.slice('process:'.length);
      if (id) {
        processIds.push(id);
      }
    }
  }
  return processIds;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const projectParam = url.searchParams.get('project');
  const topicsParam = url.searchParams.get('topics');

  const ralphDir = projectParam ?? getRalphDir();
  const topics = parseTopics(topicsParam);
  const processIds = getProcessIdsFromTopics(topics);

  const watchTickets = topics.has('tickets');
  const watchProgress = topics.has('progress');

  const encoder = new TextEncoder();
  const runner = getRunner();

  const unsubscribers: Array<() => void> = [];
  let clientRecord: {
    controller: ReadableStreamDefaultController<Uint8Array>;
    watchTickets: boolean;
    watchProgress: boolean;
  } | null = null;
  let directoryWatcher: DirectoryWatcher | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const connectMessage = formatSSE({
        topic: 'system',
        type: 'connected',
        data: {
          timestamp: Date.now(),
          ralphDir,
          topics: Array.from(topics),
        },
      });
      controller.enqueue(encoder.encode(connectMessage));

      if (watchTickets || watchProgress) {
        directoryWatcher = getOrCreateWatcher(ralphDir);
        clientRecord = {
          controller,
          watchTickets,
          watchProgress,
        };
        directoryWatcher.clients.add(clientRecord);
      }

      for (const processId of processIds) {
        const status = runner.getStatus(processId);

        if (status.state === 'not_found') {
          const errorMessage = formatSSE({
            topic: `process:${processId}`,
            type: 'error',
            data: { message: 'Process not found' },
          });
          controller.enqueue(encoder.encode(errorMessage));
          continue;
        }

        const bufferedOutput = runner.getOutput(processId);
        if (bufferedOutput.length > 0) {
          const replayStartMessage = formatSSE({
            topic: `process:${processId}`,
            type: 'replay-start',
            data: { count: bufferedOutput.length },
          });
          controller.enqueue(encoder.encode(replayStartMessage));

          for (const line of bufferedOutput) {
            const outputMessage = formatSSE({
              topic: `process:${processId}`,
              type: 'output',
              data: line,
            });
            controller.enqueue(encoder.encode(outputMessage));
          }

          const replayEndMessage = formatSSE({
            topic: `process:${processId}`,
            type: 'replay-end',
            data: { count: bufferedOutput.length },
          });
          controller.enqueue(encoder.encode(replayEndMessage));
        }

        const seenTimestamps = new Set(bufferedOutput.map((l) => l.timestamp));
        const unsubOutput = runner.onOutput(
          processId,
          (line: ProcessOutputLine) => {
            if (seenTimestamps.has(line.timestamp)) {
              return;
            }
            try {
              const outputMessage = formatSSE({
                topic: `process:${processId}`,
                type: 'output',
                data: line,
              });
              controller.enqueue(encoder.encode(outputMessage));
            } catch {
              // Controller closed
            }
          },
        );
        unsubscribers.push(unsubOutput);

        const unsubExit = runner.onExit(processId, (code: number | null) => {
          try {
            const exitMessage = formatSSE({
              topic: `process:${processId}`,
              type: 'exit',
              data: { code },
            });
            controller.enqueue(encoder.encode(exitMessage));
          } catch {
            // Controller closed
          }
        });
        unsubscribers.push(unsubExit);
      }
    },
    cancel() {
      for (const unsub of unsubscribers) {
        unsub();
      }
      unsubscribers.length = 0;

      if (directoryWatcher && clientRecord) {
        directoryWatcher.clients.delete(clientRecord);
        console.log(
          `[events] Client disconnected from ${ralphDir}. Active clients: ${directoryWatcher.clients.size}`,
        );
        maybeCleanupWatcher(ralphDir);
      }
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
