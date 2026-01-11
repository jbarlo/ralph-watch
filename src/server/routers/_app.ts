import { router } from '../trpc';
import { ticketsRouter } from './tickets';
import { progressRouter } from './progress';
import { configRouter } from './config';

/**
 * Main app router - combines all sub-routers
 */
export const appRouter = router({
  tickets: ticketsRouter,
  progress: progressRouter,
  config: configRouter,
});

/**
 * Export type definition of the API
 */
export type AppRouter = typeof appRouter;
