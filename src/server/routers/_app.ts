import { router } from '../trpc';

/**
 * Main app router - combines all sub-routers
 */
export const appRouter = router({
  // Sub-routers will be added here as they are created
  // e.g., tickets: ticketsRouter,
  // e.g., progress: progressRouter,
});

/**
 * Export type definition of the API
 */
export type AppRouter = typeof appRouter;
