/**
 * SSE endpoint for streaming process output.
 * GET /api/process/[id]/stream - Subscribe to process output
 */

import { getProcessRunner } from '@/server/services/process-runner';
import type { ProcessRunner, ProcessOutputLine } from '@/lib/process-runner';

/**
 * Event types for process output streaming
 */
type ProcessStreamEventType = 'output' | 'exit' | 'connected' | 'error';

/**
 * Format an SSE message
 */
function formatSSE(event: ProcessStreamEventType, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

let _runner: ProcessRunner | null = null;

export function setRunner(runner: ProcessRunner | null): void {
  _runner = runner;
}

export function getRunner(): ProcessRunner {
  return _runner ?? getProcessRunner();
}

/**
 * SSE endpoint for process output streaming
 * GET /api/process/[id]/stream - Connect to receive process output events
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const runner = getRunner();
  const status = runner.getStatus(id);
  if (status.state === 'not_found') {
    return new Response(JSON.stringify({ error: 'Process not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let unsubscribeOutput: (() => void) | null = null;
  let unsubscribeExit: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const connectMessage = formatSSE(
        'connected',
        JSON.stringify({
          id,
          timestamp: Date.now(),
        }),
      );
      controller.enqueue(encoder.encode(connectMessage));

      unsubscribeOutput = runner.onOutput(id, (line: ProcessOutputLine) => {
        try {
          const outputMessage = formatSSE('output', JSON.stringify(line));
          controller.enqueue(encoder.encode(outputMessage));
        } catch {
          // Controller closed
        }
      });

      unsubscribeExit = runner.onExit(id, (code: number | null) => {
        try {
          const exitMessage = formatSSE('exit', JSON.stringify({ code }));
          controller.enqueue(encoder.encode(exitMessage));
          controller.close();
        } catch {
          // Already closed
        }

        if (unsubscribeOutput) {
          unsubscribeOutput();
          unsubscribeOutput = null;
        }
        if (unsubscribeExit) {
          unsubscribeExit();
          unsubscribeExit = null;
        }
      });
    },
    cancel() {
      if (unsubscribeOutput) {
        unsubscribeOutput();
        unsubscribeOutput = null;
      }
      if (unsubscribeExit) {
        unsubscribeExit();
        unsubscribeExit = null;
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
