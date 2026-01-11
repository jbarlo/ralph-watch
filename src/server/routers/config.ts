import { router, publicProcedure } from '../trpc';

/**
 * Config router - exposes configuration values to the client
 */
export const configRouter = router({
  /**
   * Get the current Ralph project directory path
   */
  getProjectPath: publicProcedure.query(({ ctx }) => {
    return ctx.ralphDir;
  }),
});
