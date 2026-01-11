import { router } from '../trpc';
import { ticketsRouter } from './tickets';

/**
 * Main app router - combines all sub-routers
 */
export const appRouter = router({
  tickets: ticketsRouter,
});

/**
 * Export type definition of the API
 */
export type AppRouter = typeof appRouter;
