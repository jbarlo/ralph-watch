/**
 * ProcessRunner implementation using child_process.spawn.
 * Manages spawned processes, captures output, and tracks lifecycle.
 */

import { spawn, type ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { ok, err, type Result } from '@/lib/result';
import {
  type ProcessRunner,
  type ProcessHandle,
  type ProcessStatus,
  type ProcessOutputLine,
  type ProcessStartOptions,
  ProcessStatusFactory,
} from '@/lib/process-runner';

// Internal process record
interface ProcessRecord {
  child: ChildProcess;
  handle: ProcessHandle;
  output: ProcessOutputLine[];
  exitCode: number | null;
  exited: boolean;
  outputCallbacks: Set<(line: ProcessOutputLine) => void>;
}

// Simple ID generator using timestamp + random
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Resolves the command path for ralph commands using RALPH_BIN env var.
 * If RALPH_BIN is set and command starts with 'ralph', prepends the bin path.
 * E.g., 'ralph-once' becomes '/path/to/bin/ralph-once'
 *
 * Exported for testing.
 */
export function resolveCommand(command: string): string {
  const ralphBin = process.env.RALPH_BIN;

  if (!ralphBin) {
    return command;
  }

  // Trim and extract the first word (command name)
  const trimmedCommand = command.trim();
  const firstSpaceIndex = trimmedCommand.indexOf(' ');
  const commandName =
    firstSpaceIndex === -1
      ? trimmedCommand
      : trimmedCommand.substring(0, firstSpaceIndex);
  const commandArgs =
    firstSpaceIndex === -1 ? '' : trimmedCommand.substring(firstSpaceIndex);

  // Check if this is a ralph command
  if (commandName.startsWith('ralph')) {
    // Ensure RALPH_BIN doesn't have trailing slash
    const binPath = ralphBin.endsWith('/') ? ralphBin.slice(0, -1) : ralphBin;
    return `${binPath}/${commandName}${commandArgs}`;
  }

  return command;
}

/**
 * Creates a new ProcessRunner instance.
 * Each instance maintains its own map of running processes.
 */
export function createProcessRunner(): ProcessRunner {
  const processes = new Map<string, ProcessRecord>();

  function start(
    opts: ProcessStartOptions,
  ): Promise<Result<ProcessHandle, Error>> {
    return new Promise((resolve) => {
      const id = generateId();

      try {
        // Resolve command path (handles RALPH_BIN for ralph commands)
        const resolvedCommand = resolveCommand(opts.command);

        // Parse command - split by whitespace for simple commands
        // For more complex commands, use shell
        const child = spawn(resolvedCommand, {
          cwd: opts.cwd,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        // Handle spawn error
        if (!child.pid) {
          child.on('error', (error) => {
            resolve(err(error));
          });
          // If no immediate pid and no error yet, wait a tick
          setImmediate(() => {
            if (!child.pid && !child.killed) {
              resolve(
                err(new Error('Failed to spawn process: no PID assigned')),
              );
            }
          });
          return;
        }

        const handle: ProcessHandle = { id, pid: child.pid };
        const record: ProcessRecord = {
          child,
          handle,
          output: [],
          exitCode: null,
          exited: false,
          outputCallbacks: new Set(),
        };

        processes.set(id, record);

        // Setup stdout reader
        if (child.stdout) {
          const stdoutReader = createInterface({ input: child.stdout });
          stdoutReader.on('line', (line) => {
            const outputLine: ProcessOutputLine = {
              stream: 'stdout',
              line,
              timestamp: Date.now(),
            };
            record.output.push(outputLine);
            record.outputCallbacks.forEach((cb) => cb(outputLine));
          });
        }

        // Setup stderr reader
        if (child.stderr) {
          const stderrReader = createInterface({ input: child.stderr });
          stderrReader.on('line', (line) => {
            const outputLine: ProcessOutputLine = {
              stream: 'stderr',
              line,
              timestamp: Date.now(),
            };
            record.output.push(outputLine);
            record.outputCallbacks.forEach((cb) => cb(outputLine));
          });
        }

        // Handle process exit
        child.on('exit', (code) => {
          record.exited = true;
          record.exitCode = code;
        });

        // Handle process error (after spawn)
        child.on('error', (error) => {
          record.exited = true;
          // If not already exited normally, treat as error exit
          if (record.exitCode === null) {
            record.exitCode = -1;
          }
          const outputLine: ProcessOutputLine = {
            stream: 'stderr',
            line: `Process error: ${error.message}`,
            timestamp: Date.now(),
          };
          record.output.push(outputLine);
          record.outputCallbacks.forEach((cb) => cb(outputLine));
        });

        resolve(ok(handle));
      } catch (error) {
        resolve(err(error instanceof Error ? error : new Error(String(error))));
      }
    });
  }

  function getStatus(id: string): ProcessStatus {
    const record = processes.get(id);
    if (!record) {
      return ProcessStatusFactory.notFound();
    }

    if (record.exited) {
      return ProcessStatusFactory.exited(record.exitCode);
    }

    return ProcessStatusFactory.running(record.handle.pid);
  }

  function kill(id: string): Promise<Result<void, Error>> {
    return new Promise((resolve) => {
      const record = processes.get(id);
      if (!record) {
        resolve(err(new Error(`Process not found: ${id}`)));
        return;
      }

      if (record.exited) {
        resolve(err(new Error(`Process already exited: ${id}`)));
        return;
      }

      try {
        const killed = record.child.kill('SIGTERM');
        if (!killed) {
          // Try SIGKILL as fallback
          record.child.kill('SIGKILL');
        }
        resolve(ok(undefined));
      } catch (error) {
        resolve(err(error instanceof Error ? error : new Error(String(error))));
      }
    });
  }

  function onOutput(
    id: string,
    cb: (line: ProcessOutputLine) => void,
  ): () => void {
    const record = processes.get(id);
    if (!record) {
      // Return no-op unsubscribe for unknown processes
      return () => {};
    }

    // Replay existing output
    record.output.forEach((line) => cb(line));

    // Register callback for future output
    record.outputCallbacks.add(cb);

    // Return unsubscribe function
    return () => {
      record.outputCallbacks.delete(cb);
    };
  }

  function listRunning(): ProcessHandle[] {
    const running: ProcessHandle[] = [];
    processes.forEach((record) => {
      if (!record.exited) {
        running.push(record.handle);
      }
    });
    return running;
  }

  return {
    start,
    getStatus,
    kill,
    onOutput,
    listRunning,
  };
}

// Singleton instance for server-side use
let _instance: ProcessRunner | null = null;

export function getProcessRunner(): ProcessRunner {
  if (!_instance) {
    _instance = createProcessRunner();
  }
  return _instance;
}
