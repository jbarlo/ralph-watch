import { router } from '../trpc';
import { ticketsRouter } from './tickets';
import { progressRouter } from './progress';
import { configRouter } from './config';
import { ralphRouter } from './ralph';

/**
 * Main app router - combines all sub-routers
 */
export const appRouter = router({
  tickets: ticketsRouter,
  progress: progressRouter,
  config: configRouter,
  ralph: ralphRouter,
});

/**
 * Export type definition of the API
 */
export type AppRouter = typeof appRouter;
