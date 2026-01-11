/**
 * ProcessRunner interface and types for managing spawned processes.
 * Used to track process lifecycle, capture output, and control execution.
 */

import type { Result } from './result';

// Process handle returned when a process is started
export interface ProcessHandle {
  readonly id: string;
  readonly pid: number;
}

// Process status discriminated union
export type ProcessStatusRunning = {
  readonly state: 'running';
  readonly pid: number;
};

export type ProcessStatusExited = {
  readonly state: 'exited';
  readonly code: number | null;
};

export type ProcessStatusNotFound = {
  readonly state: 'not_found';
};

export type ProcessStatus =
  | ProcessStatusRunning
  | ProcessStatusExited
  | ProcessStatusNotFound;

// Output line from a process
export interface ProcessOutputLine {
  readonly stream: 'stdout' | 'stderr';
  readonly line: string;
  readonly timestamp: number;
}

// Start options for spawning a process
export interface ProcessStartOptions {
  readonly command: string;
  readonly cwd: string;
}

// ProcessRunner interface - contract for implementations
export interface ProcessRunner {
  /**
   * Start a new process with the given command in the specified directory.
   * Returns a handle with id and pid, or an error.
   */
  start(opts: ProcessStartOptions): Promise<Result<ProcessHandle, Error>>;

  /**
   * Get the current status of a process by id.
   * Returns 'not_found' if the process id is unknown.
   */
  getStatus(id: string): ProcessStatus;

  /**
   * Kill a running process by id.
   * Returns an error if the process cannot be killed.
   */
  kill(id: string): Promise<Result<void, Error>>;

  /**
   * Subscribe to output lines from a process.
   * Returns an unsubscribe function.
   * Callback is called for each stdout/stderr line.
   */
  onOutput(id: string, cb: (line: ProcessOutputLine) => void): () => void;

  /**
   * List all currently running processes.
   */
  listRunning(): ProcessHandle[];
}

// Type guards for ProcessStatus
export function isRunning(
  status: ProcessStatus,
): status is ProcessStatusRunning {
  return status.state === 'running';
}

export function isExited(status: ProcessStatus): status is ProcessStatusExited {
  return status.state === 'exited';
}

export function isNotFound(
  status: ProcessStatus,
): status is ProcessStatusNotFound {
  return status.state === 'not_found';
}

// Helper to create ProcessStatus values
export const ProcessStatusFactory = {
  running(pid: number): ProcessStatusRunning {
    return { state: 'running', pid };
  },
  exited(code: number | null): ProcessStatusExited {
    return { state: 'exited', code };
  },
  notFound(): ProcessStatusNotFound {
    return { state: 'not_found' };
  },
} as const;
