import { readFile } from 'fs/promises';
import { router, publicProcedure, getRalphFilePath } from '../trpc';
import { tryCatchAsync, isErr } from '@/lib/result';

/**
 * tRPC router for progress.txt operations
 */
export const progressRouter = router({
  /**
   * Read progress.txt content
   * Returns empty string if file is missing
   */
  read: publicProcedure.query(async () => {
    const filePath = getRalphFilePath('progress.txt');

    const result = await tryCatchAsync(async () => {
      const content = await readFile(filePath, 'utf-8');
      return content;
    });

    if (isErr(result)) {
      // Return empty string if file doesn't exist or can't be read
      return '';
    }

    return result.value;
  }),
});
