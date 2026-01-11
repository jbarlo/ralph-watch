import { spawn } from 'child_process';
import { router, publicProcedure, getRalphDir } from '../trpc';
import { ok, err, isErr, type Result } from '@/lib/result';

/**
 * Spawn a command in the Ralph directory (fire-and-forget)
 */
function spawnCommand(command: string): Result<void, string> {
  const ralphDir = getRalphDir();

  try {
    const child = spawn(command, [], {
      cwd: ralphDir,
      shell: true,
      detached: true,
      stdio: 'ignore',
    });

    // Unref so the parent process can exit independently
    child.unref();

    return ok(undefined);
  } catch (e) {
    return err(`Failed to spawn ${command}: ${e}`);
  }
}

/**
 * tRPC router for ralph command execution
 */
export const ralphRouter = router({
  /**
   * Run next ticket (ralph-once)
   * Spawns ralph-once and returns immediately
   */
  runOnce: publicProcedure.mutation(() => {
    const result = spawnCommand('ralph-once');
    if (isErr(result)) {
      throw new Error(result.error);
    }
    return { success: true, command: 'ralph-once' };
  }),

  /**
   * Run all pending tickets (ralph)
   * Spawns ralph loop and returns immediately
   */
  runAll: publicProcedure.mutation(() => {
    const result = spawnCommand('ralph');
    if (isErr(result)) {
      throw new Error(result.error);
    }
    return { success: true, command: 'ralph' };
  }),
});
