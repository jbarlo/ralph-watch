import { router } from '../trpc';
import { ticketsRouter } from './tickets';
import { progressRouter } from './progress';

/**
 * Main app router - combines all sub-routers
 */
export const appRouter = router({
  tickets: ticketsRouter,
  progress: progressRouter,
});

/**
 * Export type definition of the API
 */
export type AppRouter = typeof appRouter;
