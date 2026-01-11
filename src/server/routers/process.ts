import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { getProcessRunner } from '../services/process-runner';
import { isErr } from '@/lib/result';
import type {
  ProcessRunner,
  ProcessHandle,
  ProcessStatus,
} from '@/lib/process-runner';

/**
 * Default ProcessRunner instance (singleton).
 * Can be overridden for testing.
 */
let _processRunner: ProcessRunner | null = null;

/**
 * Get the ProcessRunner instance.
 * Uses singleton from process-runner service by default.
 */
export function getRunner(): ProcessRunner {
  if (!_processRunner) {
    _processRunner = getProcessRunner();
  }
  return _processRunner;
}

/**
 * Set a custom ProcessRunner (for testing).
 */
export function setRunner(runner: ProcessRunner | null): void {
  _processRunner = runner;
}

/**
 * tRPC router for process management.
 * Provides procedures to start, monitor, and kill spawned processes.
 */
export const processRouter = router({
  /**
   * Start a new process with the given command.
   * Runs in ctx.ralphDir as working directory.
   * Returns the process handle (id + pid) or throws on error.
   */
  start: publicProcedure
    .input(
      z.object({
        command: z.string().min(1, 'Command is required'),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ProcessHandle> => {
      const runner = getRunner();
      const result = await runner.start({
        command: input.command,
        cwd: ctx.ralphDir,
      });

      if (isErr(result)) {
        throw new Error(`Failed to start process: ${result.error.message}`);
      }

      return result.value;
    }),

  /**
   * Get the current status of a process by id.
   * Returns ProcessStatus (running/exited/not_found).
   */
  status: publicProcedure
    .input(
      z.object({
        id: z.string().min(1, 'Process ID is required'),
      }),
    )
    .query(({ input }): ProcessStatus => {
      const runner = getRunner();
      return runner.getStatus(input.id);
    }),

  /**
   * Kill a running process by id.
   * Returns success or throws on error.
   */
  kill: publicProcedure
    .input(
      z.object({
        id: z.string().min(1, 'Process ID is required'),
      }),
    )
    .mutation(async ({ input }): Promise<{ success: true }> => {
      const runner = getRunner();
      const result = await runner.kill(input.id);

      if (isErr(result)) {
        throw new Error(`Failed to kill process: ${result.error.message}`);
      }

      return { success: true };
    }),

  /**
   * List all currently running processes.
   * Returns array of ProcessHandle objects.
   */
  list: publicProcedure.query((): ProcessHandle[] => {
    const runner = getRunner();
    return runner.listRunning();
  }),
});
